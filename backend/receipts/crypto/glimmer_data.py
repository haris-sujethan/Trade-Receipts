"""Glimmer's training and test files (SPEC.md 7.8): prompts, bubble maps and fine-tuning answers.

One record per snapshot above the activity floor, in the same splits as the baselines (train May
11–14, tune May 15, test May 16, later checks Aug 12 and Sep 15 before 6 hours).

Fine-tuning answers (stage 1) are written from the trees, not by hand:
- the rug chance is the trees' calibrated estimate made without seeing that day (out of fold by
  launch day), so Glimmer starts calibrated instead of learning 0% and 100%;
- the reasons are the signals that raised and lowered that estimate most, by the trees'
  per-signal contributions (SHAP).
Reinforcement learning (stage 2) then trains Glimmer against the real outcomes. Every number in
an answer is copied from its prompt, so answers pass the numbers audit by construction.

    data/glimmer/records.jsonl     every record: id, split, prompt, answer, label, tree estimate
    data/glimmer/images/<id>.png   its bubble map
"""

import json
import math
import os
from concurrent.futures import ProcessPoolExecutor

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

from receipts.config import settings
from receipts.crypto import baselines, dataset, prompt, signals

ROOT = settings.data_dir / "glimmer"
RECORDS = ROOT / "records.jsonl"
IMAGES = ROOT / "images"
P = prompt  # formatters shared with the prompt, so cited numbers match it exactly

# How the fine-tuning answers say each signal. Each phrase uses the prompt's own formatting.
PHRASES = {
    "team_share": lambda s: f"the team still holds {P._pct(s['team_share'])} of supply",
    "team_peak_share": lambda s: f"the team held {P._pct(s['team_peak_share'])} at its peak",
    "team_sold_share": lambda s: f"the team has sold {P._pct(s['team_sold_share'])} of its peak holdings",
    "team_sells_into_buys": lambda s: f"{P._pct(s['team_sells_into_buys'])} of team sells came within 10s of an outside buy",
    "team_sell_volume_share": lambda s: f"the team is {P._pct(s['team_sell_volume_share'])} of sell volume",
    "team_volume_share": lambda s: f"the team is {P._pct(s['team_volume_share'])} of volume",
    "team_wallets": lambda s: f"the team has {P._num(s['team_wallets'])} wallets",
    "creator_buy_share": lambda s: f"the creator bought {P._pct(s['creator_buy_share'])} in the create transaction",
    "supply_bought_slot0": lambda s: f"{P._pct(s['supply_bought_slot0'])} of supply was bought in the launch block",
    "bundle_supply_share": lambda s: f"{P._num(s['bundle_wallets'])} bundle wallets bought {P._pct(s['bundle_supply_share'])}",
    "same_size_buy_share": lambda s: f"{P._pct(s['same_size_buy_share'])} of buys share an exact size with 2+ others",
    "round_size_buy_share": lambda s: f"{P._pct(s['round_size_buy_share'])} of buys are round amounts",
    "snipers": lambda s: f"there are {P._num(s['snipers'])} snipers",
    "sniper_held_share": lambda s: f"snipers still hold {P._pct(s['sniper_held_share'])}",
    "sniper_sold_share": lambda s: f"snipers have sold {P._pct(s['sniper_sold_share'])} of what they bought",
    "top10_share": lambda s: f"the top 10 holders own {P._pct(s['top10_share'])}",
    "top_holder_share": lambda s: f"the top holder owns {P._pct(s['top_holder_share'])}",
    "top_cluster_share": lambda s: f"the largest linked cluster holds {P._pct(s['top_cluster_share'])}",
    "holder_gini": lambda s: f"balance inequality is {P._num(s['holder_gini'])}",
    "holder_entropy": lambda s: f"there are {P._num(s['holders'])} holders",
    "holders": lambda s: f"there are {P._num(s['holders'])} holders",
    "fresh_buyer_share": lambda s: f"{P._pct(s['fresh_buyer_share'])} of traced buyers are fresh wallets",
    "funded_last_hour_share": lambda s: f"{P._pct(s['funded_last_hour_share'])} of traced buyers were funded within an hour of buying",
    "independent_buyers": lambda s: f"there are {P._num(s['independent_buyers'])} independent buyers",
    "independent_per_100_sol": lambda s: f"there are {P._num(s['independent_per_100_sol'])} independent buyers per 100 SOL of market cap",
    "independent_buy_share": lambda s: f"independent buyers made {P._pct(s['independent_buy_share'])} of buying",
    "experienced_holder_share": lambda s: f"{P._pct(s['experienced_holder_share'])} of holders traded 3+ tokens in the past day",
    "recycled_wallets": lambda s: f"{P._num(s['recycled_wallets'])} buyers were team in an earlier rug",
    "wash_volume_share": lambda s: f"wash trading is {P._pct(s['wash_volume_share'])} of volume",
    "buy_sell_ratio": lambda s: f"the buy/sell volume ratio is {P._num(s['buy_sell_ratio'])}",
    "fall_from_peak": lambda s: f"the price has given back {P._pct(s['fall_from_peak'])} of its rise",
    "mcap_sol": lambda s: f"the market cap is {P._sol(s['mcap_sol'])}",
    "peak_mcap_sol": lambda s: f"the market cap peaked at {P._sol(s['peak_mcap_sol'])}",
    "volume_sol": lambda s: f"volume is {P._sol(s['volume_sol'])}",
    "curve_progress": lambda s: "it has graduated" if s["graduated"] else f"the bonding curve is {P._pct(s['curve_progress'])} filled",
    "progress_per_minute": lambda s: "it has graduated" if s["graduated"] else f"the bonding curve is {P._pct(s['curve_progress'])} filled after {P._secs(s['age_s'])}",
    "graduated": lambda s: "it has graduated" if s["graduated"] else "it is still on the bonding curve",
    "mayhem": lambda s: "it is a Mayhem mode token" if s["mayhem"] else "it is a standard-mode token",
    "agent_volume_share": lambda s: f"the Mayhem agent is {P._pct(s['agent_volume_share'])} of volume",
    "max_dip": lambda s: f"the deepest dip was {P._pct(s['max_dip'])}",
    "green_candle_share": lambda s: f"{P._pct(s['green_candle_share'])} of one-minute candles are green",
    "creator_rugs_24h": lambda s: f"the creator rugged {P._num(s['creator_rugs_24h'])} tokens in the past day",
    "creator_launches_24h": lambda s: f"the creator launched {P._num(s['creator_launches_24h'])} tokens in the past day",
    "group_rugs_24h": lambda s: f"wallets sharing the creator's funder rugged {P._num(s['group_rugs_24h'])} tokens in the past day",
    "trades_per_trader": lambda s: f"there are {P._num(s['trades_per_trader'])} trades per trader",
    "first_independent_s": lambda s: (f"the first independent buyer came at {P._secs(s['first_independent_s'])}"
                                      if not math.isnan(s["first_independent_s"]) else "no independent buyer has arrived"),
    "age_s": lambda s: f"it is {P._secs(s['age_s'])} old",
}


def _answer(sig: dict, contrib: dict[str, float], p: float) -> str:
    """The trees' estimate first, then the signals that raised and lowered it most.

    The reasons explain the estimate, not the outcome, so an answer never argues against its own
    number. The rug chance is a whole percent from 1 to 99: never 0, which would read as safe.
    """
    def phrases(keys, limit):
        seen, out = set(), []
        for k in keys:
            text = PHRASES[k](sig)
            if text not in seen and "n/a" not in text:
                seen.add(text)
                out.append(text)
            if len(out) == limit:
                break
        return out
    keys = [k for k in contrib if k in PHRASES and k != "age_s"]
    up = phrases(sorted((k for k in keys if contrib[k] > 0), key=lambda k: -contrib[k]), 3)
    down = phrases(sorted((k for k in keys if contrib[k] < 0), key=lambda k: contrib[k]), 2)
    lines = []
    if up:
        lines.append("Raising the rug chance: " + "; ".join(up) + ".")
    if down:
        lines.append("Lowering it: " + "; ".join(down) + ".")
    chance = int(min(99, max(1, round(100 * p))))
    return f"{prompt.ANSWER} {chance}%\n" + " ".join(lines)


def tree_estimates(df: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Calibrated tree estimates and per-signal contributions, out of fold by launch day.

    Train days: each predicted by trees trained on the other train days. Every other day: by trees
    trained on all train days. Calibration is fit on the train days' out-of-fold estimates.
    """
    params = dict(objective="binary", learning_rate=0.03, num_leaves=31, min_data_in_leaf=50, feature_fraction=0.8,
                  bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, seed=7, verbose=-1, deterministic=True)
    rounds = json.loads(baselines.REPORT.read_text())["lightgbm_rounds"]
    labeled = df[baselines.LABEL].notna()
    y = (df[baselines.LABEL] == "rugged").astype(int)
    raw = np.full(len(df), np.nan)
    contrib = np.zeros((len(df), len(cols)))
    train_days = baselines.SPLITS["train"]
    folds = [(d, [x for x in train_days if x != d]) for d in train_days] + [(None, train_days)]
    for held_out, fit_days in folds:
        fit = (df.launch_day.isin(fit_days) & labeled).to_numpy()
        target = (df.launch_day == held_out).to_numpy() if held_out else ~df.launch_day.isin(train_days).to_numpy()
        booster = lgb.train(params, lgb.Dataset(baselines.matrix(df[fit], cols), y[fit]), num_boost_round=rounds)
        X = baselines.matrix(df[target], cols)
        raw[target] = booster.predict(X)
        contrib[target] = booster.predict(X, pred_contrib=True)[:, :-1]
    oof = df.launch_day.isin(train_days).to_numpy() & labeled.to_numpy()
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.01, y_max=0.99).fit(raw[oof], y[oof])
    return iso.predict(raw), contrib


def _split(row) -> str | None:
    for name, days in baselines.SPLITS.items():
        if row.launch_day in days:
            return name
    if row.block in baselines.LATER and row.launch_day == baselines.LATER[row.block] and row.age_s < 6 * 3600:
        return f"later_{row.block}"
    return None


def _work(args) -> list[dict]:
    block, mints, wanted = args
    b = dataset.block(block)
    out = []
    for tok in signals._tokens_for(b, mints):
        for age in signals.AGES:
            key = f"{tok.mint}_{age}"
            if key not in wanted:
                continue
            res = signals.snapshot(tok, age, context=True)
            if res is None:
                continue
            sig, ctx = res
            prompt.bubble_map(tok, ctx).save(IMAGES / f"{key}.png", optimize=True)
            out.append({"id": key, "prompt": prompt.text(tok, sig, ctx), "signals": sig})
    return out


def build(workers: int | None = None) -> dict[str, int]:
    df = baselines.load()
    cols = baselines.feature_columns(df)
    df["split"] = [_split(r) for r in df[["launch_day", "block", "age_s"]].itertuples(index=False)]
    df = df[df.split.notna()].reset_index(drop=True)
    p, contrib = tree_estimates(df, cols)
    df["tree_p"] = p
    IMAGES.mkdir(parents=True, exist_ok=True)
    tasks = []
    for block, g in df.groupby("block"):
        mints = sorted(g.mint.unique())
        wanted = set(g.mint + "_" + g.age_s.astype(str))
        tasks += [(block, mints[i:i + 300], wanted) for i in range(0, len(mints), 300)]
    built: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=workers or max(1, (os.cpu_count() or 2) - 2)) as pool:
        for part in pool.map(_work, tasks):
            for r in part:
                built[r["id"]] = r
    counts: dict[str, int] = {}
    with RECORDS.open("w") as f:
        for i, row in df.iterrows():
            key = f"{row.mint}_{row.age_s}"
            r = built.get(key)
            if r is None:
                continue
            label = row[baselines.LABEL] if row.split in baselines.SPLITS else row[baselines.LATER_LABEL]
            label = None if pd.isna(label) else label
            rugged = label == "rugged"
            c = dict(zip(cols, contrib[i]))
            f.write(json.dumps({
                "id": key, "split": row.split, "mint": row.mint, "age_s": int(row.age_s), "mayhem": bool(row.mayhem),
                "label": label, "rugged": bool(rugged), "tree_p": round(float(row.tree_p), 4),
                "prompt": r["prompt"], "image": f"images/{key}.png",
                # answers carry the outcome, so only the training and tuning days get one
                "answer": _answer(r["signals"], c, float(row.tree_p)) if row.split in ("train", "tune") else None,
            }) + "\n")
            counts[row.split] = counts.get(row.split, 0) + 1
    return counts


PACKAGE = ROOT / "kaggle"
# Upper bounds; the Kaggle jobs take the first N of each file, sized to the GPU hours left.
SIZES = {"sft": 2400, "sft_val": 300, "rl": 2400, "calibration": 1000, "later_aug": 1000, "later_sep": 1000}


def package(seed: int = 7) -> dict[str, int]:
    """The private Kaggle dataset: training, calibration and test files with their bubble maps.

    Fine-tuning and reinforcement learning use different tokens, so RL sees new examples. The test
    file is every labeled May 16 snapshot; the later checks are samples of labeled Aug 12 and Sep 15
    snapshots taken before 6 hours.
    """
    import random
    import shutil

    recs = [json.loads(line) for line in RECORDS.open()]
    rng = random.Random(seed)
    by_split: dict[str, list[dict]] = {}
    for r in recs:
        if isinstance(r["label"], str):  # labeled (records built before the fix wrote NaN)
            by_split.setdefault(r["split"], []).append(r)
    for rows in by_split.values():
        rng.shuffle(rows)
    train_tokens = sorted({r["mint"] for r in by_split["train"]})
    rng.shuffle(train_tokens)
    sft_tokens = set(train_tokens[: len(train_tokens) // 2])
    files = {
        "sft": [r for r in by_split["train"] if r["mint"] in sft_tokens][: SIZES["sft"]],
        "rl": [r for r in by_split["train"] if r["mint"] not in sft_tokens][: SIZES["rl"]],
        "sft_val": by_split["tune"][: SIZES["sft_val"]],
        "calibration": by_split["tune"][SIZES["sft_val"]: SIZES["sft_val"] + SIZES["calibration"]],
        "test": by_split["test"],
        "later_aug": by_split["later_aug"][: SIZES["later_aug"]],
        "later_sep": by_split["later_sep"][: SIZES["later_sep"]],
    }
    shutil.rmtree(PACKAGE, ignore_errors=True)
    (PACKAGE / "images").mkdir(parents=True)
    counts = {}
    for name, rows in files.items():
        with (PACKAGE / f"{name}.jsonl").open("w") as f:
            for r in rows:
                keep = {k: r[k] for k in ("id", "mint", "age_s", "mayhem", "label", "rugged", "tree_p", "prompt", "image")}
                if name in ("sft", "sft_val"):
                    keep["answer"] = r["answer"]
                f.write(json.dumps(keep) + "\n")
                shutil.copy(ROOT / r["image"], PACKAGE / r["image"])
        counts[name] = len(rows)
    (PACKAGE / "system.txt").write_text(prompt.SYSTEM)
    (PACKAGE / "dataset-metadata.json").write_text(json.dumps({
        "title": "rug-check-glimmer-data", "id": "harissujethan/rug-check-glimmer-data",
        "licenses": [{"name": "other"}],
    }, indent=2))
    return counts

"""The baselines the rug model has to beat (SPEC.md 7.8, 7.9): a checklist score and LightGBM.

Data: snapshots above the activity floor. Target: the team rugged within the label window.
Split by launch date, never by token: train on May 11–14, tune on May 15 (early stopping and
calibration), test once on May 16 launches that have a full day of data after them. Aug 12 and
Sep 15 are later checks against the 6-hour label, the longest their data allows, so they test
ranking and the 6-hour rug rate, not the 24-hour calibration.

Pooled scores overstate skill. Rug rates fall steeply with age (77% at 1 minute, 13% at 6 hours
on May 16), and Mayhem mode tokens almost never rug by the label's definition (8% vs 84% for
standard tokens in May), so a model scores well just by knowing the age and the mode. The
headline is `fair_auc`: the AUC within each mode at each age, averaged by size. An age-only
reference (each age's training rug rate) is reported too.

    data/models/baselines/lightgbm.txt
    data/reports/baselines.json
"""

import datetime as dt
import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

from receipts.config import settings
from receipts.crypto import dataset, signals

LABEL = f"label_{signals.LABEL_HOURS}h"
LATER_LABEL = "label_6h"
SPLITS = {
    "train": [dt.date(2026, 5, d) for d in (11, 12, 13, 14)],
    "tune": [dt.date(2026, 5, 15)],
    "test": [dt.date(2026, 5, 16)],
}
LATER = {"aug": dt.date(2026, 8, 12), "sep": dt.date(2026, 9, 15)}
VERDICTS = (0.25, 0.60)  # Unlikely below, Possible between, Likely at or above (SPEC.md 7.2)
HIGH = 0.80
NOT_FEATURES = {"mint", "snapshot_ts", "above_floor", "rug_after_s", "block", "launch_day"}
MODEL_DIR = settings.data_dir / "models" / "baselines"
REPORT = settings.data_dir / "reports" / "baselines.json"

# The checklist: red flags of the kind rug checkers show today, with thresholds fixed in advance
# (not tuned). The score is how many are raised; calibration turns it into a rug chance.
CHECKLIST = {
    "top 10 holders own over 30%": lambda d: d.top10_share > 0.30,
    "one wallet owns over 5%": lambda d: d.top_holder_share > 0.05,
    "creator bought over 5% at launch": lambda d: d.creator_buy_share > 0.05,
    "bundled launch (over 10% bought in the launch block)": lambda d: d.supply_bought_slot0 > 0.10,
    "10+ snipers": lambda d: d.snipers >= 10,
    "snipers still hold over 10%": lambda d: d.sniper_held_share > 0.10,
    "over 30% of buyers are fresh wallets": lambda d: d.fresh_buyer_share > 0.30,
    "creator rugged before in the past day": lambda d: d.creator_rugs_24h > 0,
    "linked wallets hold over 20%": lambda d: d.top_cluster_share > 0.20,
    "over 20% of volume is wash trading": lambda d: d.wash_volume_share > 0.20,
}


def load() -> pd.DataFrame:
    frames = []
    for name in ("may", "aug", "sep"):
        s = pd.read_parquet(dataset.block(name).path("snapshots"))
        s["block"] = name
        frames.append(s)
    df = pd.concat(frames, ignore_index=True)
    df = df[df.above_floor].copy()
    df["launch_day"] = pd.to_datetime(df.snapshot_ts - df.age_s, unit="s").dt.date
    return df


def feature_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in NOT_FEATURES and not c.startswith("label_")]


def matrix(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    return df[cols].astype(float)


def checklist(df: pd.DataFrame) -> pd.Series:
    return sum(rule(df).fillna(False).astype(int) for rule in CHECKLIST.values())


def metrics(y: np.ndarray, p: np.ndarray) -> dict:
    out = {"n": int(len(y)), "rug_rate": round(float(y.mean()), 4)}
    if len(set(y)) < 2:
        return out
    out["auc"] = round(float(roc_auc_score(y, p)), 4)
    out["brier"] = round(float(brier_score_loss(y, p)), 4)
    out["log_loss"] = round(float(log_loss(y, np.clip(p, 1e-4, 1 - 1e-4))), 4)
    high = p >= HIGH
    out["at_80_plus"] = {"n": int(high.sum()), "rugged": round(float(y[high].mean()), 4) if high.any() else None}
    bands = {"Unlikely rug": p < VERDICTS[0], "Possible rug": (p >= VERDICTS[0]) & (p < VERDICTS[1]),
             "Likely rug": p >= VERDICTS[1]}
    out["verdicts"] = {k: {"n": int(m.sum()), "rugged": round(float(y[m].mean()), 4) if m.any() else None}
                       for k, m in bands.items()}
    bins = np.clip((p * 10).astype(int), 0, 9)
    out["calibration"] = [
        {"bin": f"{b / 10:.1f}-{(b + 1) / 10:.1f}", "n": int((bins == b).sum()),
         "mean_p": round(float(p[bins == b].mean()), 4), "rugged": round(float(y[bins == b].mean()), 4)}
        for b in range(10) if (bins == b).any()
    ]
    return out


def by_age(df: pd.DataFrame, y: np.ndarray, p: np.ndarray) -> dict:
    out = {}
    for age in sorted(df.age_s.unique()):
        m = (df.age_s == age).to_numpy()
        r = metrics(y[m], p[m])
        out[f"{age // 60}m"] = {k: r.get(k) for k in ("n", "rug_rate", "auc", "brier")}
    return out


def by_mode_age(df: pd.DataFrame, y: np.ndarray, p: np.ndarray) -> tuple[list[dict], float | None]:
    """AUC within each mode and age, and their size-weighted mean (cells with both outcomes)."""
    cells, total, weighted = [], 0, 0.0
    for (mode, age), idx in df.groupby(["mayhem", "age_s"]).indices.items():
        yy, pp = y[idx], p[idx]
        cell = {"mode": "mayhem" if mode else "standard", "age": f"{age // 60}m", "n": int(len(idx)),
                "rug_rate": round(float(yy.mean()), 4)}
        if len(set(yy)) == 2:
            cell["auc"] = round(float(roc_auc_score(yy, pp)), 4)
            total += len(idx)
            weighted += cell["auc"] * len(idx)
        cells.append(cell)
    return cells, (round(weighted / total, 4) if total else None)


def run() -> dict:
    df = load()
    cols = feature_columns(df)
    split = {k: df[df.launch_day.isin(days) & df[LABEL].notna()] for k, days in SPLITS.items()}
    y = {k: (v[LABEL] == "rugged").to_numpy(int) for k, v in split.items()}

    # LightGBM: early stopping on the tune day, then isotonic calibration on the same day.
    params = dict(objective="binary", learning_rate=0.03, num_leaves=31, min_data_in_leaf=50,
                  feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0,
                  seed=7, verbose=-1, deterministic=True)
    train = lgb.Dataset(matrix(split["train"], cols), y["train"])
    tune = lgb.Dataset(matrix(split["tune"], cols), y["tune"], reference=train)
    booster = lgb.train(params, train, num_boost_round=3000, valid_sets=[tune],
                        callbacks=[lgb.early_stopping(100, verbose=False)])
    raw = {k: booster.predict(matrix(v, cols), num_iteration=booster.best_iteration) for k, v in split.items()}
    iso_tree = IsotonicRegression(out_of_bounds="clip", y_min=0.001, y_max=0.999).fit(raw["tune"], y["tune"])

    # Checklist: flags counted, calibrated on the tune day.
    score = {k: checklist(v).to_numpy(float) for k, v in split.items()}
    iso_check = IsotonicRegression(out_of_bounds="clip", y_min=0.001, y_max=0.999).fit(score["tune"], y["tune"])

    # Age only: each age's rug rate in training.
    age_rate = split["train"].assign(y=y["train"]).groupby("age_s").y.mean()

    def predict(name: str, frame: pd.DataFrame) -> np.ndarray:
        if name == "lightgbm":
            return iso_tree.predict(booster.predict(matrix(frame, cols), num_iteration=booster.best_iteration))
        if name == "checklist":
            return iso_check.predict(checklist(frame).to_numpy(float))
        return frame.age_s.map(age_rate).to_numpy(float)

    report: dict = {
        "label": LABEL, "splits": {k: [d.isoformat() for d in v] for k, v in SPLITS.items()},
        "sizes": {k: {"snapshots": int(len(v)), "tokens": int(v.mint.nunique())} for k, v in split.items()},
        "features": len(cols), "lightgbm_rounds": int(booster.best_iteration),
        "checklist": list(CHECKLIST), "models": {},
    }
    test = split["test"]
    for name in ("lightgbm", "checklist", "age_only"):
        p = predict(name, test)
        cells, fair = by_mode_age(test, y["test"], p)
        entry = {"fair_auc": fair, "test": metrics(y["test"], p), "test_by_age": by_age(test, y["test"], p),
                 "test_by_mode_age": cells, "later": {}}
        for block, day in LATER.items():
            # snapshots taken before the 6-hour mark (at 6 hours there's nothing left in that window)
            later = df[(df.block == block) & (df.launch_day == day) & df[LATER_LABEL].notna() & (df.age_s < 6 * 3600)]
            yl = (later[LATER_LABEL] == "rugged").to_numpy(int)
            pl = predict(name, later)
            entry["later"][f"{block} ({LATER_LABEL})"] = {k: v for k, v in metrics(yl, pl).items() if k in ("n", "rug_rate", "auc")}
            entry["later"][f"{block} ({LATER_LABEL})"]["fair_auc"] = by_mode_age(later, yl, pl)[1]
        report["models"][name] = entry
    gain = booster.feature_importance("gain")
    report["lightgbm_top_signals"] = [
        {"signal": cols[i], "gain_share": round(float(gain[i] / gain.sum()), 4)} for i in np.argsort(-gain)[:20]
    ]
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(MODEL_DIR / "lightgbm.txt"), num_iteration=booster.best_iteration)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, default=str))
    return report

"""The rug check's signals at each snapshot age (SPEC.md 7.3, 7.7).

A snapshot rebuilds a token as it stood at a fixed age after launch, from what had happened by
then: its trades, the wallet links visible by then, and wallet history from before the launch.
Funding is read only for the wallets a live check would trace at that moment: the creator, the
first 50 buyers and the 50 biggest holders so far.

Snapshots taken after the token rugged are skipped: they would teach the model to spot rugs after
the fact. Every snapshot carries `above_floor` (the activity floor) so the floor can be tuned.

Holdings come from pump.fun trades, so they're complete on the bonding curve but partial after
graduation, when tokens also trade on other exchanges; `graduated` says which.

Not computable from the BigQuery pull yet: priority fees and tips (the Fees family), token
transfers between wallets (only inferred, as `hidden_supply_share`), and pitch-vs-chain claims,
which need a clip.

    data/pump/dataset/<block>/snapshots.parquet
"""

import math
import os
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass

import numpy as np
import pandas as pd
import pyarrow.compute as pc
import pyarrow.dataset as pads

from receipts.crypto import dataset, programs, roles

# 1, 5, 15 and 30 minutes, then 1 and 6 hours. A 24-hour snapshot has nothing left to predict
# inside a 24-hour label window.
AGES = (60, 300, 900, 1800, 3600, 21600)
LABEL_HOURS = 24
FLOOR_INDEPENDENT = 20
FLOOR_MCAP_SOL = 60  # the "$10k" floor, held in SOL since the pull has no SOL price; tuned on May 15
TRACE_BUYERS = 50
TRACE_HOLDERS = 50
OVER_SHARE = 0.04  # "any wallet or cluster at 4–5% or more"
FRESH_SECONDS = 86400  # funded within a day before its first trade here, with no trade history
INTO_BUY_SECONDS = 10  # a team sell this soon after an outside buy is "selling into" it
ROUND_TRIP_SECONDS = 60
CHUNK = 400  # tokens per worker task


@dataclass
class Token:
    mint: str
    creator: str
    launch_ts: int
    launch_slot: int
    start_mcap: float
    mayhem: bool
    cashback: bool
    rug_ts: float  # nan if it never rugged in the pulled data
    labels: dict  # hours -> label
    creator_ctx: dict
    t: np.ndarray
    slot: np.ndarray
    code: np.ndarray  # wallet index into `names`
    names: np.ndarray
    is_buy: np.ndarray
    tokens: np.ndarray  # raw token units
    sol: np.ndarray  # quote moved, in SOL
    gross_sol: np.ndarray  # with fees, what the trader typed for a buy
    mcap: np.ndarray  # SOL, nan where the trade doesn't set the price
    curve_tokens: np.ndarray  # curve's virtual token reserves after the trade, nan off the curve
    in_create: np.ndarray
    venue_pool: np.ndarray
    early: list  # roles.Wallet for each wallet that traded in the first day
    index: dict  # wallet -> position in `names`
    # per wallet, aligned with `names`
    funded_ts: np.ndarray
    funded_by_hub: np.ndarray
    first_seen: np.ndarray
    tokens_24h: np.ndarray
    pnl_24h: np.ndarray
    team_rugs: np.ndarray
    edges: list


def _gini(x: np.ndarray) -> float:
    if len(x) == 0 or x.sum() <= 0:
        return math.nan
    x = np.sort(x)
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1).dot(x) / (n * x.sum()))


def _entropy(x: np.ndarray) -> float:
    if len(x) < 2 or x.sum() <= 0:
        return math.nan
    p = x / x.sum()
    return float(-(p * np.log(p)).sum() / math.log(len(x)))


def _ffill(a: np.ndarray) -> np.ndarray:
    idx = np.where(~np.isnan(a), np.arange(len(a)), 0)
    np.maximum.accumulate(idx, out=idx)
    out = a[idx]
    return out


def snapshot(tok: Token, age: int, context: bool = False):
    """The signals for one token at one age, or None if it had rugged by then.

    With `context`, returns (signals, context): the per-wallet arrays and roles behind the
    signals, for building Glimmer's input (prompt.py) from exactly the same view of the token.
    """
    T = tok.launch_ts + age
    if not math.isnan(tok.rug_ts) and tok.rug_ts <= T:
        return None
    n = int(np.searchsorted(tok.t, T, side="right"))
    W = len(tok.names)
    code, is_buy, tokens, sol = tok.code[:n], tok.is_buy[:n], tok.tokens[:n], tok.sol[:n]
    t = tok.t[:n]
    agent = tok.names == programs.MAYHEM_AGENT

    bought = np.bincount(code, weights=np.where(is_buy, tokens, 0), minlength=W)
    sold = np.bincount(code, weights=np.where(is_buy, 0, tokens), minlength=W)
    sol_in = np.bincount(code, weights=np.where(is_buy, sol, 0), minlength=W)
    sol_out = np.bincount(code, weights=np.where(is_buy, 0, sol), minlength=W)
    n_buys = np.bincount(code, weights=is_buy.astype(float), minlength=W)
    n_sells = np.bincount(code, weights=(~is_buy).astype(float), minlength=W)
    # Holdings from pump.fun trades. After graduation tokens also trade on other exchanges and move
    # between wallets, so a router bot's net can pass the whole supply; cap it there.
    held = np.clip(bought - sold, 0, programs.TOTAL_SUPPLY)
    buyer = (n_buys > 0) & ~agent
    first_buy = np.full(W, np.inf)
    np.minimum.at(first_buy, code[is_buy], t[is_buy])

    # Who a live check would trace now: the creator, the first buyers and the biggest holders.
    order = np.argsort(first_buy[buyer], kind="stable")
    buyer_idx = np.flatnonzero(buyer)
    traced_idx = set(buyer_idx[order[:TRACE_BUYERS]].tolist())
    holder_idx = np.flatnonzero(held > 0)
    traced_idx |= set(holder_idx[np.argsort(-held[holder_idx], kind="stable")[:TRACE_HOLDERS]].tolist())
    traced = {tok.names[i] for i in traced_idx} | {tok.creator}

    edges = [e for e in tok.edges if e[2] <= T and e[0] in traced and (e[3] == "funded" or e[1] in traced)]
    r = roles.assign(tok.creator, tok.launch_ts, tok.early, edges, cutoff=T)

    def mask(wallets) -> np.ndarray:
        m = np.zeros(W, bool)
        m[[tok.index[w] for w in wallets if w in tok.index]] = True
        return m

    team = mask(r.team)
    likely = mask(r.likely_team)
    snipers = mask(r.snipers)
    sniper_bots = mask(r.sniper_bots)
    bundle = mask(r.bundle)
    wash = (n_buys >= 3) & (n_sells >= 3) & (np.abs(bought - sold) <= 0.1 * np.maximum(bought, 1)) & ~agent

    is_traced = mask(traced)
    funded_ts = np.where(is_traced, tok.funded_ts, np.nan)
    funded_by_hub = is_traced & tok.funded_by_hub
    tokens_24h, pnl_24h, team_rugs = tok.tokens_24h, tok.pnl_24h, tok.team_rugs
    fresh = ~np.isnan(funded_ts) & (funded_ts >= tok.first_seen - FRESH_SECONDS) & (tokens_24h == 0)
    independent = buyer & ~team & ~likely & ~snipers & ~wash & ~fresh

    supply = programs.TOTAL_SUPPLY
    out: dict = {"mint": tok.mint, "age_s": age, "snapshot_ts": T}

    # Market
    mcap = _ffill(tok.mcap[:n]) if n else np.array([])
    price = float(mcap[-1]) if n else math.nan
    peak = float(np.nanmax(mcap)) if n and not np.all(np.isnan(mcap)) else math.nan
    out["mcap_sol"] = price
    out["peak_mcap_sol"] = peak
    out["fall_from_peak"] = 1 - (price - tok.start_mcap) / (peak - tok.start_mcap) if peak > tok.start_mcap else 0.0
    for label, secs in (("mcap_slot0_sol", None), ("mcap_1m_sol", 60), ("mcap_5m_sol", 300)):
        if secs is None:
            k = int(np.searchsorted(tok.slot[:n], tok.launch_slot, side="right"))
        else:
            k = int(np.searchsorted(t, tok.launch_ts + secs, side="right")) if secs <= age else 0
        out[label] = float(mcap[k - 1]) if k else math.nan
    out["volume_sol"] = float(sol.sum())
    out["trades"] = n
    out["buyers"] = int(buyer.sum())
    out["sellers"] = int(((n_sells > 0) & ~agent).sum())
    out["buy_sell_ratio"] = float(sol_in.sum() / sol_out.sum()) if sol_out.sum() > 0 else math.nan
    out["trades_per_trader"] = n / max(1, int(((n_buys + n_sells) > 0).sum()))

    # Speed
    curve = tok.curve_tokens[:n]
    on_curve = ~np.isnan(curve)
    graduated_at = tok.venue_pool[:n].argmax() if tok.venue_pool[:n].any() else -1
    out["graduated"] = bool(graduated_at >= 0)
    out["curve_progress"] = (
        1.0 if graduated_at >= 0
        else float((programs.CURVE_START_TOKENS - curve[on_curve][-1]) / programs.CURVE_SALE_TOKENS) if on_curve.any()
        else math.nan
    )
    out["minutes_to_graduate"] = float((t[graduated_at] - tok.launch_ts) / 60) if graduated_at >= 0 else math.nan
    out["progress_per_minute"] = out["curve_progress"] / (age / 60) if not math.isnan(out["curve_progress"]) else math.nan

    # Launch and bundling
    slot_rel = tok.slot[:n] - tok.launch_slot
    out["supply_bought_slot0"] = float(tokens[is_buy & (slot_rel == 0)].sum() / supply)
    out["supply_bought_slots0_2"] = float(tokens[is_buy & (slot_rel <= 2)].sum() / supply)
    out["creator_buy_share"] = float(tokens[is_buy & tok.in_create[:n]].sum() / supply)
    out["bundle_wallets"] = int(bundle.sum())
    out["bundle_supply_share"] = min(1.0, float(bought[bundle].sum() / supply))
    buys = is_buy & ~agent[code]
    gross = tok.gross_sol[:n][buys]
    if len(gross):
        sizes, inverse, counts = np.unique(np.round(gross, 3), return_inverse=True, return_counts=True)
        repeat = counts[inverse] >= 3
        out["same_size_buy_share"] = float(repeat.mean())
        out["top_same_size_buys"] = int(counts.max())
        out["round_size_buy_share"] = float((np.abs(gross * 10 - np.round(gross * 10)) < 0.005).mean())
    else:
        out["same_size_buy_share"] = out["round_size_buy_share"] = math.nan
        out["top_same_size_buys"] = 0
    ind_first = first_buy[independent]
    out["first_independent_s"] = float(ind_first.min() - tok.launch_ts) if len(ind_first) else math.nan
    out["snipers"] = int(snipers.sum())
    out["sniper_bots"] = int(sniper_bots.sum())
    out["sniper_bought_share"] = min(1.0, float(bought[snipers].sum() / supply))
    out["sniper_held_share"] = float(held[snipers].sum() / supply)
    out["sniper_sold_share"] = float(sold[snipers].sum() / bought[snipers].sum()) if bought[snipers].sum() > 0 else math.nan

    # Supply control
    team_delta = np.where(team[code], np.where(is_buy, tokens, -tokens), 0)
    team_pos = np.cumsum(team_delta)
    team_peak = float(team_pos.max()) if n else 0.0
    out["team_wallets"] = int(team.sum())
    out["team_share"] = float(held[team].sum() / supply)
    out["team_peak_share"] = max(team_peak, 0) / supply
    out["team_sold_share"] = float(np.clip(1 - team_pos[-1] / team_peak, 0, 1)) if team_peak > 0 else math.nan
    out["likely_team_wallets"] = int(likely.sum())
    out["likely_team_share"] = float(held[likely].sum() / supply)
    holders = held[held > 0]
    top = np.sort(holders)[::-1]
    out["holders"] = int(len(holders))
    out["top_holder_share"] = float(top[0] / supply) if len(top) else 0.0
    out["top10_share"] = float(top[:10].sum() / supply)
    cluster_of = tok.names.copy()
    for w, c in (r.likely_group | r.cluster).items():
        if w in tok.index:
            cluster_of[tok.index[w]] = c
    cluster_of[team] = "team"
    linked_wallet = cluster_of != tok.names
    cl, cl_inv = np.unique(cluster_of, return_inverse=True)
    cl_held = np.bincount(cl_inv, weights=held, minlength=len(cl))
    cl_top = np.sort(cl_held)[::-1]
    out["top_cluster_share"] = float(cl_top[0] / supply) if len(cl_top) else 0.0
    out["top3_clusters_share"] = float(cl_top[:3].sum() / supply)
    out["wallets_over_4pct"] = int((held >= OVER_SHARE * supply).sum())
    out["clusters_over_4pct"] = int((cl_held >= OVER_SHARE * supply).sum())
    out["linked_clusters"] = int(len({c for c in r.cluster.values()}))
    out["hidden_supply_share"] = float(np.maximum(sold - bought, 0).sum() / supply)

    # Balance shape
    out["holder_gini"] = _gini(holders)
    out["holder_entropy"] = _entropy(holders)
    big = holders[holders >= 0.001 * supply]
    if len(big):
        bins = np.round(np.log(big) / math.log(1.01)).astype(np.int64)
        out["same_balance_holders"] = int(np.unique(bins, return_counts=True)[1].max())
    else:
        out["same_balance_holders"] = 0

    # Wallet quality
    traced_buyers = buyer & is_traced
    out["fresh_buyer_share"] = float(fresh[traced_buyers].mean()) if traced_buyers.any() else math.nan
    funded_recently = ~np.isnan(funded_ts) & (funded_ts >= first_buy - 3600)
    out["funded_last_hour_share"] = float(funded_recently[traced_buyers].mean()) if traced_buyers.any() else math.nan
    out["independent_buyers"] = int(independent.sum())
    out["independent_per_100_sol"] = out["independent_buyers"] / (price / 100) if price > 0 else math.nan
    is_holder = held > 0
    out["experienced_holder_share"] = float((tokens_24h[is_holder] >= 3).mean()) if is_holder.any() else math.nan
    out["profitable_holder_share"] = float((pnl_24h[is_holder] > 0).mean()) if is_holder.any() else math.nan
    out["experienced_buyer_share"] = float((tokens_24h[buyer] >= 3).mean()) if buyer.any() else math.nan
    recycled = (team_rugs > 0) & buyer
    out["recycled_wallets"] = int(recycled.sum())
    out["recycled_supply_share"] = min(1.0, float(bought[recycled].sum() / supply))
    out["team_recycled_wallets"] = int((recycled & team).sum())

    # Trading behavior
    team_sell = ~is_buy & team[code]
    outside_buy = is_buy & ~team[code] & ~likely[code] & ~agent[code]
    if team_sell.any() and outside_buy.any():
        buy_times = t[outside_buy]
        sells_t = t[team_sell]
        k = np.searchsorted(buy_times, sells_t, side="right")
        prev = np.where(k > 0, buy_times[np.maximum(k - 1, 0)], -np.inf)
        out["team_sells_into_buys"] = float((sells_t - prev <= INTO_BUY_SECONDS).mean())
    else:
        out["team_sells_into_buys"] = 0.0 if team_sell.any() else math.nan
    total_sold_sol = sol_out.sum()
    out["team_sell_volume_share"] = float(sol_out[team].sum() / total_sold_sol) if total_sold_sol > 0 else math.nan
    out["team_volume_share"] = float((sol_in[team].sum() + sol_out[team].sum()) / sol.sum()) if sol.sum() > 0 else math.nan
    out["wash_wallets"] = int(wash.sum())
    out["wash_volume_share"] = float((sol_in[wash].sum() + sol_out[wash].sum()) / sol.sum()) if sol.sum() > 0 else math.nan
    gaps = np.diff(t[~agent[code]])
    out["timing_cv"] = float(gaps.std() / gaps.mean()) if len(gaps) >= 10 and gaps.mean() > 0 else math.nan
    out["agent_volume_share"] = float((sol_in[agent].sum() + sol_out[agent].sum()) / sol.sum()) if sol.sum() > 0 else 0.0
    # Linked wallets trading against each other: a buy right after a sell by another wallet in its cluster.
    cl_code = cl_inv[code]
    linked = linked_wallet[code]
    trips = 0
    if linked.any():
        last_sell: dict[int, tuple[float, int]] = {}
        for i in np.flatnonzero(linked):
            c = cl_code[i]
            if not is_buy[i]:
                last_sell[c] = (t[i], code[i])
            elif c in last_sell and t[i] - last_sell[c][0] <= ROUND_TRIP_SECONDS and last_sell[c][1] != code[i]:
                trips += 1
    out["linked_round_trips"] = trips

    # Chart shape: one-minute candles
    minute = ((t - tok.launch_ts) // 60).astype(np.int64)
    if n:
        last_in_minute = np.r_[minute[1:] != minute[:-1], True]
        closes = mcap[last_in_minute]
        opens = np.r_[tok.start_mcap, closes[:-1]]
        valid = (closes > 0) & (opens > 0)  # nan compares false
        out["candles"] = int(valid.sum())
        out["green_candle_share"] = float((closes[valid] > opens[valid]).mean()) if valid.any() else math.nan
        running = np.fmax.accumulate(np.where(np.isnan(mcap), -np.inf, mcap))
        dips = 1 - mcap / running
        out["max_dip"] = float(np.nanmax(dips)) if np.isfinite(running).any() else math.nan
        if valid.sum() >= 5:
            y = np.log(closes[valid])
            x = minute[last_in_minute][valid].astype(float)
            out["climb_r2"] = float(np.corrcoef(x, y)[0, 1] ** 2) if y.std() > 0 and x.std() > 0 else math.nan
        else:
            out["climb_r2"] = math.nan
    else:
        out.update(candles=0, green_candle_share=math.nan, max_dip=math.nan, climb_r2=math.nan)
    total_in = sol_in.sum()
    out["independent_buy_share"] = float(sol_in[independent].sum() / total_in) if total_in > 0 else math.nan

    # Creator and team funding
    out.update(tok.creator_ctx)
    team_traced = team & is_traced
    out["team_funded_by_exchange_share"] = float(funded_by_hub[team_traced].mean()) if team_traced.any() else math.nan
    out["mayhem"] = tok.mayhem
    out["cashback"] = tok.cashback

    out["above_floor"] = out["independent_buyers"] >= FLOOR_INDEPENDENT or (price >= FLOOR_MCAP_SOL)
    for hours, label in tok.labels.items():
        out[f"label_{hours}h"] = label
    out["rug_after_s"] = float(tok.rug_ts - T) if not math.isnan(tok.rug_ts) else math.nan
    if not context:
        return out
    ctx = dict(
        T=T, n=n, roles=r, edges=edges, held=held, bought=bought, sold=sold, sol_in=sol_in, sol_out=sol_out,
        first_buy=first_buy, team=team, likely=likely, snipers=snipers, sniper_bots=sniper_bots, bundle=bundle,
        wash=wash, fresh=fresh, independent=independent, agent=agent, is_traced=is_traced, funded_ts=funded_ts,
        funded_by_hub=funded_by_hub, cluster_of=cluster_of, mcap=mcap,
    )
    return out, ctx


def _tokens_for(b: dataset.Block, mints: list[str]) -> list[Token]:
    """Load everything `snapshot` needs for a set of tokens."""
    lo, hi = mints[0], mints[-1]
    wanted = set(mints)

    def read(table, cols=None):
        ds = pads.dataset(b.path(table), format="parquet")
        df = ds.to_table(columns=cols, filter=(pc.field("mint") >= lo) & (pc.field("mint") <= hi)).to_pandas()
        return df[df.mint.isin(wanted)]

    tokens = read("tokens").set_index("mint")
    trades = read("trades").sort_values(["mint", "slot", "in_create_tx", "ix_index"], ascending=[True, True, False, True])
    wallets = read("wallets").merge(read("reputation"), on=["mint", "wallet"], how="left")
    edges = read("edges")
    creators = read("creators").set_index("mint")
    labels = read("labels", ["mint", "hours", "label", "rug_ts"])
    label_map = {m: dict(zip(g.hours, g.label)) for m, g in labels.groupby("mint")}
    rug_map = labels.groupby("mint").rug_ts.first().to_dict()
    w_groups = dict(list(wallets.groupby("mint")))
    e_groups = dict(list(edges.groupby("mint")))
    out = []
    for mint, g in trades.groupby("mint", sort=False):
        k = tokens.loc[mint]
        names, code = np.unique(g.wallet.to_numpy(), return_inverse=True)
        names = names.astype(object)
        ws = w_groups.get(mint, pd.DataFrame(columns=wallets.columns)).set_index("wallet")
        early = [
            roles.Wallet(w, None if pd.isna(slot) else int(slot), None if pd.isna(ts) else int(ts), int(habit))
            for w, slot, ts, habit in zip(ws.index, ws.first_buy_slot, ws.first_buy_ts, ws.snipes_24h)
        ]
        info = ws.reindex(names)
        e = e_groups.get(mint)
        rug_ts = rug_map.get(mint)
        out.append(Token(
            mint=mint, creator=k.creator, launch_ts=int(k.launch_ts), launch_slot=int(k.launch_slot),
            start_mcap=float(k.start_mcap), mayhem=bool(k.mayhem), cashback=bool(k.cashback),
            rug_ts=math.nan if rug_ts is None or pd.isna(rug_ts) else float(rug_ts),
            labels=label_map.get(mint, {}),
            creator_ctx=creators.loc[mint].to_dict() if mint in creators.index else {},
            t=g.block_time.to_numpy(np.int64), slot=g.slot.to_numpy(np.int64), code=code, names=names,
            is_buy=g.is_buy.to_numpy(bool), tokens=g.token_amount.to_numpy(float),
            sol=g.quote_amount.to_numpy(float) / 1e9, gross_sol=(g.quote_amount + g.fee).to_numpy(float) / 1e9,
            mcap=g.mcap.to_numpy(float, na_value=np.nan), curve_tokens=g.curve_tokens.to_numpy(float, na_value=np.nan),
            in_create=g.in_create_tx.to_numpy(bool), venue_pool=(g.venue == "pumpswap").to_numpy(bool),
            early=early, index={w: i for i, w in enumerate(names)},
            funded_ts=info.funded_ts.to_numpy(float, na_value=np.nan),
            funded_by_hub=info.funded_by_hub.fillna(False).to_numpy(bool),
            first_seen=info.first_ts.to_numpy(float, na_value=np.nan),
            tokens_24h=info.tokens_24h.fillna(0).to_numpy(float),
            pnl_24h=info.pnl_24h_sol.fillna(0).to_numpy(float),
            team_rugs=info.team_rugs_24h.fillna(0).to_numpy(float),
            edges=[] if e is None else list(zip(e.w1, e.w2, e.ts, e.kind)),
        ))
    return out


def _work(args) -> list[dict]:
    name, mints = args
    b = dataset.block(name)
    rows = []
    for tok in _tokens_for(b, mints):
        for age in AGES:
            row = snapshot(tok, age)
            if row is not None:
                rows.append(row)
    return rows


def build(name: str, workers: int | None = None) -> dict[str, int]:
    """Snapshots for every SOL-quoted token in the block. Returns counts."""
    b = dataset.block(name)
    tokens = pads.dataset(b.path("tokens"), format="parquet").to_table(columns=["mint", "sol_quoted"]).to_pandas()
    mints = sorted(tokens[tokens.sol_quoted].mint)
    chunks = [(name, mints[i:i + CHUNK]) for i in range(0, len(mints), CHUNK)]
    rows: list[dict] = []
    with ProcessPoolExecutor(max_workers=workers or max(1, (os.cpu_count() or 2) - 2)) as pool:
        for part in pool.map(_work, chunks):
            rows.extend(part)
    df = pd.DataFrame(rows)
    df.to_parquet(b.path("snapshots"), index=False)
    return {
        "tokens": len(mints),
        "skipped_not_sol": int((~tokens.sol_quoted).sum()),
        "snapshots": len(df),
        "above_floor": int(df.above_floor.sum()) if len(df) else 0,
    }

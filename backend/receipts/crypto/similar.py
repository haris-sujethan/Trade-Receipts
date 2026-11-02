"""Similar past tokens (SPEC.md 7.11): the 5 launches nearest to a token in signal space at the
same age, with how each one ended.

Nearness is measured on the signals the trees lean on most, each turned into its percentile
within the pool, so no one signal's scale dominates. Only launches before the token count, so a
check of a past token never shows what came after it.
"""

import functools
import math

import numpy as np
import pandas as pd

from receipts.crypto import baselines

SIGNALS = 15  # the trees' most important signals, by gain
EXPLORER = "https://solscan.io/token/{mint}"


@functools.lru_cache(maxsize=1)
def _pool() -> tuple[pd.DataFrame, list[str]]:
    df = baselines.load()
    df = df[df[baselines.LABEL].notna()].copy()
    df["launch_ts"] = df.snapshot_ts - df.age_s
    booster, cols, _ = baselines.tree_model()
    gain = booster.feature_importance("gain")
    top = [cols[i] for i in np.argsort(-gain) if cols[i] != "age_s"][:SIGNALS]
    return df, top


def similar(sig: dict, launch_ts: int, n: int = 5) -> list[dict]:
    df, top = _pool()
    age = int(sig["age_s"])
    nearest_age = min(df.age_s.unique(), key=lambda a: abs(a - age))
    pool = df[(df.age_s == nearest_age) & (df.launch_ts < launch_ts) & (df.mint != sig.get("mint"))
              & (df.mayhem == bool(sig.get("mayhem")))]
    if pool.empty:
        return []
    x = pool[top].astype(float)
    q = np.array([[float(sig.get(c)) if sig.get(c) is not None else math.nan for c in top]])
    ranks = x.rank(pct=True)
    # the token's percentile in each signal: the share of the pool at or below its value
    mine = np.array([(x[c] <= q[0, j]).mean() if not math.isnan(q[0, j]) else math.nan for j, c in enumerate(top)])
    diff = (ranks.to_numpy() - mine) ** 2
    dist = np.sqrt(np.nanmean(np.where(np.isnan(diff), 0.25, diff), axis=1))
    out = []
    for i in np.argsort(dist)[:n]:
        row = pool.iloc[i]
        out.append({"mint": row.mint, "ended": row[baselines.LABEL],
                    "rugged_after_s": None if pd.isna(row.get("rug_after_s")) else int(row.age_s + row.rug_after_s),
                    "mcap_sol": round(float(row.mcap_sol), 1), "holders": int(row.holders),
                    "team_share": round(float(row.team_share), 4), "distance": round(float(dist[i]), 3),
                    "link": EXPLORER.format(mint=row.mint)})
    return out

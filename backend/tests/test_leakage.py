"""The leakage test (SPEC.md 7.8): a snapshot's signals never read anything after its time.

For real tokens from the pulled data, each snapshot is computed twice: from everything in the
dataset, and from a copy with every trade and wallet link after the snapshot removed. The signals
must match exactly; only the label columns may differ. Skipped when the dataset isn't built.
"""

import dataclasses
import math

import numpy as np
import pyarrow.parquet as pq
import pytest

from receipts.crypto import dataset, signals

BLOCK = "sep"
ARRAYS = ("t", "slot", "code", "is_buy", "tokens", "sol", "gross_sol", "mcap", "curve_tokens", "in_create", "venue_pool")
TARGETS = {"rug_after_s"}


def _cut(tok: signals.Token, T: int) -> signals.Token:
    """The token as a live check at T would see it: later trades, links and wallets erased."""
    n = int(np.searchsorted(tok.t, T, side="right"))
    later = ~(tok.first_seen <= T)
    return dataclasses.replace(
        tok,
        **{name: getattr(tok, name)[:n] for name in ARRAYS},
        edges=[e for e in tok.edges if e[2] <= T],
        early=[w for w in tok.early if w.first_buy_ts is not None and w.first_buy_ts <= T],
        funded_ts=np.where(later, np.nan, tok.funded_ts),
        funded_by_hub=np.where(later, False, tok.funded_by_hub),
        tokens_24h=np.where(later, 0, tok.tokens_24h),
        pnl_24h=np.where(later, 0, tok.pnl_24h),
        team_rugs=np.where(later, 0, tok.team_rugs),
    )


def _same(a, b) -> bool:
    if isinstance(a, float) and isinstance(b, float):
        return (math.isnan(a) and math.isnan(b)) or a == b
    return a == b


@pytest.mark.skipif(not dataset.block(BLOCK).path("snapshots").exists(), reason="dataset not built")
def test_snapshots_ignore_the_future():
    b = dataset.block(BLOCK)
    mints = sorted(pq.read_table(b.path("tokens"), columns=["mint"]).column(0).to_pylist())
    sample = mints[:: max(1, len(mints) // 150)][:150]
    checked = 0
    for tok in signals._tokens_for(b, sorted(sample)):
        for age in signals.AGES:
            full = signals.snapshot(tok, age)
            if full is None:
                continue
            cut = signals.snapshot(_cut(tok, tok.launch_ts + age), age)
            diffs = [k for k in full if not k.startswith("label_") and k not in TARGETS and not _same(full[k], cut[k])]
            assert not diffs, f"{tok.mint} at {age}s reads the future: {diffs}"
            checked += 1
    assert checked > 50

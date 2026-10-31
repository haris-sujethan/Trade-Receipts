"""Pull blocks of consecutive days, carrying earlier launches forward while they're active.

BigQuery's `Instructions` table has pump.fun's inner instructions (where its events live) only
in some stretches (`data/reports/inner_coverage_hourly.json`). Blocks follow those stretches:

    May 11 11:00 – May 17 11:00 UTC   six continuous days
    May 28 07:00 – May 29 08:00 UTC
    Aug 12 04:00 – Aug 13 02:00 UTC
    Sep 15 01:00 – Sep 15 17:00 UTC

Each day's query keeps that day's launches plus the earlier launches in the block that look
active enough to matter (a loose pre-floor, well below the real activity floor), and the
PumpSwap pools they graduated into.
"""

import datetime as dt

import duckdb

from receipts.crypto import programs, pull, store
from receipts.crypto.bq import GuardedBigQuery

BLOCKS = {
    "may": (dt.date(2026, 5, 11), dt.date(2026, 5, 17)),
    "may-late": (dt.date(2026, 5, 28), dt.date(2026, 5, 29)),
    "aug": (dt.date(2026, 8, 12), dt.date(2026, 8, 13)),
    "sep": (dt.date(2026, 9, 15), dt.date(2026, 9, 15)),
}
# Loose on purpose: the activity floor (20 independent buyers or $10k) is applied later.
PRE_FLOOR_BUYERS = 10
PRE_FLOOR_MCAP_SOL = 40


def _days(start: dt.date, end: dt.date) -> list[dt.date]:
    return [start + dt.timedelta(n) for n in range((end - start).days + 1)]


def carried(days: list[dt.date]) -> tuple[list[str], list[str]]:
    """Mints launched on `days` that passed the pre-floor or graduated, and their PumpSwap pools."""
    if not days:
        return [], []
    con = duckdb.connect()
    parts = lambda kind: [str(store.kind_dir(kind, d) / "*.parquet") for d in days]
    for kind in ("launches", "trades", "migrations", "pools"):
        con.execute(f"CREATE VIEW {kind} AS SELECT * FROM read_parquet({parts(kind)!r}, union_by_name = true)")
    mints = [r[0] for r in con.execute(f"""
        WITH curve AS (
          SELECT t.mint,
                 count(DISTINCT t.wallet) FILTER (WHERE t.is_buy) AS buyers,
                 max(CASE WHEN t.quote_mint = '{programs.WSOL}'
                          THEN CAST(t.quote_reserves AS DOUBLE) / CAST(t.token_reserves AS DOUBLE) * 1e6 END) AS peak_mcap_sol
          FROM trades AS t JOIN launches AS l USING (mint)
          WHERE t.venue = 'curve'
          GROUP BY t.mint
        )
        SELECT mint FROM curve WHERE buyers >= {PRE_FLOOR_BUYERS} OR peak_mcap_sol >= {PRE_FLOOR_MCAP_SOL}
        UNION SELECT m.mint FROM migrations AS m JOIN launches USING (mint)
    """).fetchall()]
    pools = [r[0] for r in con.execute("""
        SELECT pool FROM migrations WHERE mint IN (SELECT unnest(?))
        UNION SELECT pool FROM pools WHERE base_mint IN (SELECT unnest(?))
    """, [mints, mints]).fetchall()]
    return mints, pools


def pull_block(start: dt.date, end: dt.date, bq: GuardedBigQuery | None = None) -> None:
    bq = bq or GuardedBigQuery()
    done: list[dt.date] = []
    for day in _days(start, end):
        mints, pools = carried(done)
        print(f"{day}: carrying {len(mints):,} earlier mints and {len(pools):,} pools", flush=True)
        if not store.raw_path(day).exists():
            store.save_raw(day, pull.pull_day(bq, day, mints=mints, pools=pools))
        print(f"{day}: {store.decode_day(day)}", flush=True)
        done.append(day)

"""Copycats and name search (SPEC.md 7.1): other pump.fun tokens launched with the same ticker or
name, listed by how active they were, so the user can tell which one a shill meant. The agent
lists them and asks; it never picks one silently.

Reads the launch history the BigQuery pull kept (every pump.fun launch on the pulled days, May to
September 2026), with each token's market cap and holders from its latest snapshot before the
time asked about. Tokens launched after the history ends aren't in it, so `covered` says whether
a search can be trusted for a given time.
"""

import functools
import re

import duckdb
import pandas as pd

from receipts.crypto import dataset, store

WINDOW = 7 * 86400  # launches in the week before
SHOWN = 5
# Token names are written by anyone. Names with slurs are hidden wherever the app shows a name.
BLOCKED = re.compile(r"nigg|f+a+g+|retard|\bkike|\bchink|\bspic\b|tranny|\bwetback", re.I)


def clean_name(name: str | None) -> str | None:
    return "(name hidden)" if name and BLOCKED.search(name) else name


@functools.lru_cache(maxsize=1)
def _data() -> tuple[duckdb.DuckDBPyConnection, int]:
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE launches AS SELECT mint, name, symbol, block_time AS launch_ts
                    FROM read_parquet('{store.ROOT}/launches/*/*.parquet', union_by_name = true)
                    QUALIFY row_number() OVER (PARTITION BY mint ORDER BY block_time) = 1""")
    snaps = pd.concat([pd.read_parquet(dataset.block(b).path("snapshots"), columns=["mint", "snapshot_ts", "mcap_sol", "holders"])
                       for b in ("may", "aug", "sep")], ignore_index=True)
    con.register("snapshots", snaps)
    end = con.execute("SELECT max(launch_ts) FROM launches").fetchall()[0][0]
    return con, end


def covered(as_of: int) -> bool:
    """Whether the launch history reaches this time."""
    return as_of <= _data()[1] + 86400


def search(query: str, as_of: int, exclude: str | None = None) -> dict:
    """Tokens whose ticker or name is `query` (case and a leading $ ignored), launched in the week
    before `as_of`, the most active first."""
    con, _ = _data()
    q = query.strip().lstrip("$").lower()
    rows = con.execute(f"""
        WITH c AS (
          SELECT * FROM launches
          WHERE (lower(symbol) = ? OR lower(name) = ?) AND launch_ts <= ? AND launch_ts >= ? - {WINDOW}
            AND mint IS DISTINCT FROM ?
        ),
        latest AS (
          SELECT s.mint, arg_max(s.mcap_sol, s.snapshot_ts) AS mcap_sol, arg_max(s.holders, s.snapshot_ts) AS holders
          FROM snapshots AS s JOIN c USING (mint) WHERE s.snapshot_ts <= ? GROUP BY s.mint
        )
        SELECT c.mint, c.name, c.symbol, ? - c.launch_ts AS age_s, l.mcap_sol, l.holders
        FROM c LEFT JOIN latest AS l USING (mint)
        ORDER BY l.mcap_sol DESC NULLS LAST, c.launch_ts DESC
    """, [q, q, as_of, as_of, exclude, as_of, as_of]).df()
    tokens = [{"mint": r.mint, "name": clean_name(r.name), "symbol": clean_name(r.symbol), "age_s": int(r.age_s),
               "mcap_sol": None if pd.isna(r.mcap_sol) else round(float(r.mcap_sol), 1),
               "holders": None if pd.isna(r.holders) else int(r.holders)} for r in rows.head(SHOWN).itertuples()]
    return {"total": len(rows), "tokens": tokens}

"""Where wallets got their SOL: System program transfers, up to two hops back (SPEC.md 7.4).

The wallets traced are each sampled token's creator, its first buyers and its biggest holders.
Their list is uploaded to a table in the sandbox project (free), and one query scans the System
program's instructions for the window once:
- hop 1: transfers into those wallets;
- hop 2: transfers into the wallets that funded them, except busy senders;
- busy senders: wallets that sent to very many others in the window (exchange hot wallets,
  bots, services). The rug check never links wallets through them.

System program rows come already decoded: `instruction_type` is 'transfer' and `params` holds
source, destination and lamports as JSON values (`data` and `accounts` are empty; checked Oct 31).
Signatures aren't pulled (they'd triple the cost); evidence links come from Helius on demand.
"""

import datetime as dt
import io

import duckdb
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
from google.cloud import bigquery

from receipts.config import settings
from receipts.crypto import programs, store
from receipts.crypto.bq import GuardedBigQuery
from receipts.crypto.pull import TABLE

DATASET = "pipeline"
WALLETS_TABLE = "funding_wallets"
FIRST_BUYERS = 50
TOP_HOLDERS = 50
# The starting activity floor, measured on raw buyers and SOL market cap; the real floor
# (independent buyers) needs these funding links first.
FLOOR_BUYERS = 20
FLOOR_MCAP_SOL = 60
BUSY_RECEIVERS = 200  # a sender that paid this many distinct wallets in the window is busy
# block -> (first and last day of transfers, launch days whose wallets are traced)
BLOCKS = {
    "may": (dt.date(2026, 5, 9), dt.date(2026, 5, 17), [dt.date(2026, 5, 11) + dt.timedelta(n) for n in range(6)]),
    "aug": (dt.date(2026, 8, 10), dt.date(2026, 8, 13), [dt.date(2026, 8, 12)]),
    "sep": (dt.date(2026, 9, 13), dt.date(2026, 9, 15), [dt.date(2026, 9, 15)]),
}
ROOT = settings.data_dir / "pump" / "funding"

def wallets(days: list[dt.date]) -> pa.Table:
    """Creators of every launch, plus first buyers and top holders of tokens at the starting floor."""
    con = duckdb.connect()
    for kind in ("launches", "trades"):
        paths = [str(store.kind_dir(kind, d) / "*.parquet") for d in days]
        con.execute(f"CREATE VIEW {kind} AS SELECT * FROM read_parquet({paths!r}, union_by_name = true)")
    return con.sql(f"""
        WITH curve AS (
          SELECT t.*, l.creator, l.block_time AS launched
          FROM trades AS t JOIN launches AS l USING (mint)
          WHERE t.venue = 'curve' AND t.block_time < l.block_time + 86400
        ),
        floor AS (
          SELECT mint FROM curve GROUP BY mint
          HAVING count(DISTINCT wallet) FILTER (WHERE is_buy) >= {FLOOR_BUYERS}
              OR max(CASE WHEN quote_mint = '{programs.WSOL}'
                          THEN CAST(quote_reserves AS DOUBLE) / CAST(token_reserves AS DOUBLE) * 1e6 END) >= {FLOOR_MCAP_SOL}
        ),
        first_buys AS (
          SELECT mint, wallet, min(slot * 10000 + ix_index) AS first_at FROM curve
          WHERE is_buy AND mint IN (SELECT mint FROM floor) GROUP BY mint, wallet
        ),
        first_buyers AS (
          SELECT wallet FROM first_buys QUALIFY row_number() OVER (PARTITION BY mint ORDER BY first_at, wallet) <= {FIRST_BUYERS}
        ),
        positions AS (
          SELECT mint, wallet,
                 sum(CASE WHEN is_buy THEN CAST(token_amount AS DOUBLE) ELSE -CAST(token_amount AS DOUBLE) END) AS held
          FROM curve WHERE mint IN (SELECT mint FROM floor) GROUP BY mint, wallet
        ),
        top_holders AS (
          SELECT wallet FROM positions WHERE held > 0
          QUALIFY row_number() OVER (PARTITION BY mint ORDER BY held DESC, wallet) <= {TOP_HOLDERS}
        )
        SELECT DISTINCT wallet AS address FROM (
          SELECT creator AS wallet FROM launches
          UNION ALL SELECT wallet FROM first_buyers
          UNION ALL SELECT wallet FROM top_holders
        )
    """).to_arrow_table()


def upload_wallets(bq: GuardedBigQuery, table: pa.Table) -> str:
    """Load the wallet list into the sandbox project (load jobs are free). Returns the table id."""
    client = bq.client
    dataset = bigquery.Dataset(f"{client.project}.{DATASET}")
    dataset.location = "us-central1"  # where the public Solana dataset lives
    client.create_dataset(dataset, exists_ok=True)
    table_id = f"{client.project}.{DATASET}.{WALLETS_TABLE}"
    sink = io.BytesIO()
    pq.write_table(table, sink)
    sink.seek(0)
    client.load_table_from_file(
        sink, table_id,
        job_config=bigquery.LoadJobConfig(source_format=bigquery.SourceFormat.PARQUET, write_disposition="WRITE_TRUNCATE"),
    ).result()
    return table_id


def funding_sql(wallets_table: str, sample_percent: float | None = None) -> str:
    """The funding query; `sample_percent` reads a small TABLESAMPLE instead, to test it cheaply."""
    source = f"`{TABLE}`" + (f" TABLESAMPLE SYSTEM ({sample_percent} PERCENT)" if sample_percent else "")
    return f"""
WITH transfers AS (
  SELECT UNIX_SECONDS(block_timestamp) AS ts,
         JSON_VALUE((SELECT value FROM UNNEST(params) WHERE key = 'source')) AS src,
         JSON_VALUE((SELECT value FROM UNNEST(params) WHERE key = 'destination')) AS dst,
         SAFE_CAST(JSON_VALUE((SELECT value FROM UNNEST(params) WHERE key = 'lamports')) AS INT64) AS lamports
  FROM {source}
  WHERE DATE(block_timestamp) BETWEEN @start AND @end
    AND program_id = '{programs.SYSTEM}'
    AND instruction_type = 'transfer'
),
tr AS (SELECT * FROM transfers WHERE lamports IS NOT NULL AND src != dst),
busy AS (SELECT src, COUNT(DISTINCT dst) AS receivers FROM tr GROUP BY src HAVING receivers >= @busy),
hop1 AS (SELECT tr.* FROM tr JOIN `{wallets_table}` AS w ON tr.dst = w.address),
funders AS (
  SELECT DISTINCT hop1.src FROM hop1 LEFT JOIN busy USING (src) WHERE busy.src IS NULL
)
SELECT 1 AS hop, ts, src, dst, lamports, NULL AS receivers FROM hop1
UNION ALL
SELECT 2, tr.ts, tr.src, tr.dst, tr.lamports, NULL FROM tr JOIN funders ON tr.dst = funders.src
UNION ALL
SELECT 0, NULL, src, NULL, NULL, receivers FROM busy
"""


def pull_funding(start: dt.date, end: dt.date, launch_days: list[dt.date], *, cap_gib: float = 250) -> dict:
    """Trace funding for the wallets in `launch_days`' tokens over [start, end]; saves Parquet files."""
    bq = GuardedBigQuery()
    table = wallets(launch_days)
    print(f"tracing {table.num_rows:,} wallets", flush=True)
    wallets_table = upload_wallets(bq, table)
    params = [
        bigquery.ScalarQueryParameter("start", "DATE", start),
        bigquery.ScalarQueryParameter("end", "DATE", end),
        bigquery.ScalarQueryParameter("busy", "INT64", BUSY_RECEIVERS),
    ]
    rows = bq.query(funding_sql(wallets_table), params, label=f"funding-{start}-{end}", cap_bytes=int(cap_gib * 2**30))
    ROOT.mkdir(parents=True, exist_ok=True)
    name = f"{start.isoformat()}_{end.isoformat()}"
    counts = {}
    for value, label in ((0, "busy"), (1, "hop1"), (2, "hop2")):
        part = rows.filter(pc.equal(rows.column("hop"), value))
        pq.write_table(part, ROOT / f"{label}_{name}.parquet")
        counts[label] = part.num_rows
    pq.write_table(table, ROOT / f"wallets_{name}.parquet")
    counts["wallets"] = table.num_rows
    return counts

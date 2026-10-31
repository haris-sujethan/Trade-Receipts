"""Wallet history: every wallet's launches and trades across the pulled data (SPEC.md 7.7).

One row per wallet and token, with when the wallet first and last touched it and what it
bought and sold. Step 3 joins token outcomes onto it for reputation signals ("team in 3 past
rugs"), counting only what had happened before the snapshot being built. The history only
reaches as far back as the pulled data, and live scoring builds the same window from Helius,
so training and serving see the same thing.

    data/pump/wallet_history.parquet
"""

import duckdb

from receipts.crypto import store

PATH = store.ROOT / "wallet_history.parquet"


def build() -> dict[str, int]:
    con = duckdb.connect()
    con.execute(f"CREATE VIEW launches AS SELECT * FROM read_parquet('{store.ROOT}/launches/*/*.parquet', union_by_name = true)")
    con.execute(f"CREATE VIEW trades AS SELECT * FROM read_parquet('{store.ROOT}/trades/*/*.parquet', union_by_name = true)")
    con.execute(f"CREATE VIEW migrations AS SELECT * FROM read_parquet('{store.ROOT}/migrations/*/*.parquet', union_by_name = true)")
    con.execute(f"CREATE VIEW pools AS SELECT * FROM read_parquet('{store.ROOT}/pools/*/*.parquet', union_by_name = true)")
    con.execute(f"""
        COPY (
          WITH pool_mints AS (
            SELECT pool, mint FROM migrations
            UNION SELECT pool, base_mint FROM pools
          ),
          resolved AS (
            SELECT coalesce(t.mint, p.mint) AS mint, t.* EXCLUDE (mint)
            FROM trades AS t LEFT JOIN pool_mints AS p ON t.pool = p.pool
          ),
          traded AS (
            SELECT wallet, mint,
                   min(block_time) AS first_ts, max(block_time) AS last_ts,
                   count(*) FILTER (WHERE is_buy) AS buys,
                   count(*) FILTER (WHERE NOT is_buy) AS sells,
                   sum(CAST(quote_amount AS DOUBLE)) FILTER (WHERE is_buy) AS quote_spent,
                   sum(CAST(quote_amount AS DOUBLE)) FILTER (WHERE NOT is_buy) AS quote_received,
                   sum(CAST(token_amount AS DOUBLE)) FILTER (WHERE is_buy) AS tokens_bought,
                   sum(CAST(token_amount AS DOUBLE)) FILTER (WHERE NOT is_buy) AS tokens_sold,
                   bool_or(venue = 'pumpswap') AS traded_after_graduation
            FROM resolved WHERE mint IS NOT NULL
            GROUP BY wallet, mint
          ),
          created AS (SELECT creator AS wallet, mint, block_time AS created_ts FROM launches)
          SELECT coalesce(t.wallet, c.wallet) AS wallet,
                 coalesce(t.mint, c.mint) AS mint,
                 c.created_ts IS NOT NULL AS is_creator,
                 l.block_time AS launched_ts,
                 least(coalesce(t.first_ts, c.created_ts), coalesce(c.created_ts, t.first_ts)) AS first_ts,
                 t.last_ts, coalesce(t.buys, 0) AS buys, coalesce(t.sells, 0) AS sells,
                 t.quote_spent, t.quote_received, t.tokens_bought, t.tokens_sold,
                 coalesce(t.traded_after_graduation, false) AS traded_after_graduation
          FROM traded AS t
          FULL JOIN created AS c ON t.wallet = c.wallet AND t.mint = c.mint
          LEFT JOIN launches AS l ON l.mint = coalesce(t.mint, c.mint)
          ORDER BY wallet, first_ts
        ) TO '{PATH}' (FORMAT parquet)
    """)
    row = con.execute(f"""
        SELECT count(*), count(DISTINCT wallet), count(DISTINCT mint), count(*) FILTER (WHERE launched_ts IS NULL)
        FROM read_parquet('{PATH}')
    """).fetchone()
    return {"rows": row[0], "wallets": row[1], "tokens": row[2], "tokens_launched_outside_pull": row[3]}

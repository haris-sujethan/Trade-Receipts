"""Rugged, faded or survived: each token's outcome (SPEC.md 7.6, ADR 0001).

A token is rugged when its team sold at least half of its peak holdings and the price gave back
at least 90% of its rise since launch, both within the label window. On the bonding curve the
price can never fall below the launch price, so the fall is measured above it: a token that ran
from 28 SOL to 100 SOL and back to 30 has fallen 97%. After graduation the launch price is small
next to the pool's, so this is close to the plain fall from the peak.

Likely-team wallets count as team here only when they sell alongside it: at least half of the
tokens their group sold went within 10 minutes of a team sell.

Faded: no rug, and the price collapsed anyway or trading died out. Survived: at least 5 wallets
still trading in the window's last hour, and less than a 90% fall at its end.

The team comes from everything in the block (roles.assign with no cutoff). `rug_ts` is searched
over all pulled data, not just one window, to measure how long rugs take.
"""

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from receipts.crypto import dataset, programs, roles

RUG_SOLD = 0.5
RUG_FALL = 0.9
ALONGSIDE_SECONDS = 600
ALONGSIDE_SHARE = 0.5
ALIVE_WALLETS = 5
ALIVE_SECONDS = 3600
WINDOW_HOURS = (1, 6, 12, 24, 48, 96, 144)


def build_team(name: str | dataset.Block) -> int:
    """Each token's team and likely team from everything in the block, for labels."""
    b = name if isinstance(name, dataset.Block) else dataset.block(name)
    con = dataset.connect(b)
    tokens = con.sql("SELECT mint, creator, launch_ts FROM tokens").df()
    wallets = con.sql("""
        SELECT mint, wallet, first_buy_slot, first_buy_ts, habit_creators FROM token_wallets
    """).df().groupby("mint")
    edges = con.sql("SELECT mint, w1, w2, ts, kind FROM edges").df().groupby("mint")
    wallet_groups, edge_groups = dict(list(wallets)), dict(list(edges))
    rows = []
    for mint, creator, launch_ts in tokens.itertuples(index=False):
        w = wallet_groups.get(mint)
        e = edge_groups.get(mint)
        ws = [] if w is None else [
            roles.Wallet(x.wallet, None if pd.isna(x.first_buy_slot) else int(x.first_buy_slot),
                         None if pd.isna(x.first_buy_ts) else int(x.first_buy_ts), int(x.habit_creators))
            for x in w.itertuples(index=False)
        ]
        es = [] if e is None else list(zip(e.w1, e.w2, e.ts, e.kind))
        r = roles.assign(creator, int(launch_ts), ws, es)
        for wallet in r.team:
            via = "creator" if wallet == creator else "bundle" if wallet in r.bundle else "link"
            rows.append((mint, wallet, "team", via, None, r.since[wallet]))
        for wallet in r.likely_team:
            rows.append((mint, wallet, "likely_team", "same_exchange", r.likely_group[wallet], None))
    table = pa.table(list(zip(*rows)) if rows else [[]] * 6, names=["mint", "wallet", "role", "via", "grp", "since"])
    pq.write_table(table, b.path("team"))
    return table.num_rows


def build(name: str | dataset.Block) -> pd.DataFrame:
    """Labels for every token in the block, at each window in WINDOW_HOURS."""
    b = name if isinstance(name, dataset.Block) else dataset.block(name)
    con = dataset.connect(b)
    con.execute(f"""
        CREATE TEMP TABLE tt AS
        SELECT t.mint, t.wallet, t.is_buy, t.token_amount, t.mcap, t.slot, t.ix_index, t.in_create_tx, t.block_time,
               m.role, m.grp
        FROM trades AS t LEFT JOIN team AS m USING (mint, wallet)
    """)
    # Likely-team groups that sold alongside the team count as team.
    con.execute(f"""
        CREATE TEMP TABLE counted AS
        WITH team_sells AS (SELECT mint, block_time FROM tt WHERE role = 'team' AND NOT is_buy),
        ls AS (SELECT mint, grp, token_amount, block_time FROM tt WHERE role = 'likely_team' AND NOT is_buy),
        prev AS (SELECT ls.*, s.block_time AS before FROM ls ASOF LEFT JOIN team_sells AS s
                 ON ls.mint = s.mint AND ls.block_time >= s.block_time),
        near AS (SELECT prev.*, s.block_time AS after FROM prev ASOF LEFT JOIN team_sells AS s
                 ON prev.mint = s.mint AND prev.block_time <= s.block_time)
        SELECT mint, grp FROM near GROUP BY mint, grp
        HAVING sum(CAST(token_amount AS DOUBLE)) FILTER (
                 WHERE block_time - before <= {ALONGSIDE_SECONDS} OR after - block_time <= {ALONGSIDE_SECONDS})
               >= {ALONGSIDE_SHARE} * sum(CAST(token_amount AS DOUBLE))
    """)
    con.execute(f"""
        CREATE TEMP TABLE seq AS
        WITH x AS (
          SELECT tt.*, k.launch_ts, k.start_mcap,
                 tt.role = 'team' OR (tt.role = 'likely_team' AND c.grp IS NOT NULL) AS is_team
          FROM tt JOIN tokens AS k USING (mint) LEFT JOIN counted AS c USING (mint, grp)
        ),
        y AS (
          SELECT *,
                 sum(CASE WHEN NOT is_team THEN 0 WHEN is_buy THEN CAST(token_amount AS DOUBLE)
                          ELSE -CAST(token_amount AS DOUBLE) END) OVER w AS team_pos,
                 last_value(mcap IGNORE NULLS) OVER w AS price,
                 max(mcap) OVER w AS peak
          FROM x
          WINDOW w AS (PARTITION BY mint ORDER BY slot, in_create_tx DESC, ix_index ROWS UNBOUNDED PRECEDING)
        )
        SELECT *, max(team_pos) OVER (PARTITION BY mint ORDER BY slot, in_create_tx DESC, ix_index
                                      ROWS UNBOUNDED PRECEDING) AS team_peak,
               1 - (price - start_mcap) / nullif(peak - start_mcap, 0) AS fall
        FROM y
    """)
    data_end = con.execute("SELECT max(block_time) FROM trades").fetchall()[0][0]
    windows = ", ".join(f"({h})" for h in WINDOW_HOURS)
    labels = con.sql(f"""
        WITH rug AS (
          SELECT mint,
                 min(block_time) FILTER (WHERE team_peak > 0 AND team_pos <= (1 - {RUG_SOLD}) * team_peak
                                             AND fall >= {RUG_FALL}) AS rug_ts,
                 min(block_time) FILTER (WHERE team_peak > 0 AND team_pos <= (1 - {RUG_SOLD}) * team_peak) AS team_sold_ts,
                 min(block_time) FILTER (WHERE fall >= {RUG_FALL}) AS collapse_ts,
                 max(team_peak) AS team_peak_tokens,
                 arg_max(block_time, team_pos) AS team_peak_ts,
                 max(peak) AS peak_mcap, arg_max(block_time, mcap) AS peak_ts,
                 count(DISTINCT wallet) FILTER (WHERE is_team) AS team_traders
          FROM seq GROUP BY mint
        ),
        w AS (SELECT * FROM (VALUES {windows}) AS v(hours)),
        at_end AS (
          SELECT s.mint, w.hours,
                 arg_max(s.fall, s.slot * 100000 + s.ix_index) AS end_fall,
                 count(DISTINCT s.wallet) FILTER (
                   WHERE s.block_time > s.launch_ts + w.hours * 3600 - {ALIVE_SECONDS}
                     AND s.wallet != '{programs.MAYHEM_AGENT}') AS end_wallets
          FROM seq AS s, w WHERE s.block_time <= s.launch_ts + w.hours * 3600
          GROUP BY s.mint, w.hours
        )
        SELECT k.mint, k.launch_ts, {data_end} - k.launch_ts AS followup_s, k.mayhem, k.sol_quoted, k.start_mcap,
               r.*  EXCLUDE (mint), r.team_peak_tokens / {programs.TOTAL_SUPPLY} AS team_peak_share,
               r.rug_ts - k.launch_ts AS rug_age_s,
               a.hours, a.end_fall, a.end_wallets,
               -- no label without the whole window: keeping early rugs but not the rest would skew it
               CASE WHEN {data_end} < k.launch_ts + a.hours * 3600 THEN NULL
                    WHEN r.rug_ts <= k.launch_ts + a.hours * 3600 THEN 'rugged'
                    WHEN a.end_wallets >= {ALIVE_WALLETS} AND coalesce(a.end_fall, 0) < {RUG_FALL} THEN 'survived'
                    ELSE 'faded' END AS label
        FROM tokens AS k JOIN rug AS r USING (mint) JOIN at_end AS a USING (mint)
        ORDER BY k.mint, a.hours
    """).df()
    labels.to_parquet(b.path("labels"), index=False)
    return labels

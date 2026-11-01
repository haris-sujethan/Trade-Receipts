"""The rug check's training data, built per block of pulled days (SPEC.md 7.4–7.7).

    data/pump/dataset/<block>/
        tokens.parquet     launches on the block's launch days that reached the starting floor
        trades.parquet     their trades on the curve and PumpSwap, sorted by token and time
        edges.parquet      funding links between each token's wallets, and when each became visible
        wallets.parquet    each token's early wallets: first buy, funding, history before the launch
        team.parquet       each token's team and likely team, from everything in the block
        labels.parquet     rugged / faded / survived, and when the rug happened
        snapshots.parquet  the signals at each snapshot age, with the label

Labels may use everything in the block, including what happened after a snapshot. Signals use
only what had happened by the snapshot, and wallet history only what happened before the launch,
so the same history can be rebuilt from Helius when a token is scored live.
"""

import datetime as dt
import os
import shutil
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass

import duckdb
import numpy as np
import pyarrow.compute as pc
import pyarrow.dataset as pads

from receipts.config import settings
from receipts.crypto import chain, funding, programs, sample, store

ROOT = settings.data_dir / "pump" / "dataset"

DAY = 86400
# Wallet links (7.4). Transfers under 0.01 SOL are dust and address poisoning, not funding.
MIN_LINK_LAMPORTS = 10_000_000
# A wallet that received SOL from this many senders is a hub (a trading bot's fee wallet, a
# deposit address); links never pass through it. Senders that paid 200+ wallets are busy too.
HUB_SENDERS = 50
LIKELY_TEAM_SECONDS = 600
LIKELY_TEAM_AMOUNT = 0.01
FUNDING_LOOKBACK = 2 * DAY  # the funding pull starts two days before each block's first launch
HISTORY_LOOKBACK = DAY  # wallet history counted before a launch
# Early buyers: within this many seconds of the launch. A wallet that bought this early into
# tokens from HABIT_CREATORS different creators is a sniper bot, not a launch-bundle wallet.
SNIPE_SECONDS = 10
HABIT_CREATORS = 4
PRICE_SCALE = {9: 1e6, 6: 1e9}  # quote decimals -> raw quote/token ratio to a market cap in quote units


@dataclass(frozen=True)
class Block:
    name: str
    trade_days: list[dt.date]
    launch_days: list[dt.date]
    funding: str  # the funding files' date range

    @property
    def dir(self):
        return ROOT / self.name

    def path(self, table: str):
        return self.dir / f"{table}.parquet"


def block(name: str) -> Block:
    start, end = sample.BLOCKS[name]
    f_start, f_end, launch_days = funding.BLOCKS[name]
    days = [start + dt.timedelta(n) for n in range((end - start).days + 1)]
    return Block(name, days, list(launch_days), f"{f_start.isoformat()}_{f_end.isoformat()}")


def connect(b: Block) -> duckdb.DuckDBPyConnection:
    """DuckDB with the block's pulled data as views."""
    con = duckdb.connect()
    tmp = settings.data_dir / "tmp" / "duckdb"
    tmp.mkdir(parents=True, exist_ok=True)
    con.execute(f"SET memory_limit = '6GB'; SET temp_directory = '{tmp}'; SET preserve_insertion_order = false")

    def parts(kind, days):
        return [str(store.kind_dir(kind, d) / "*.parquet") for d in days]

    def view(name, files):
        con.execute(f"CREATE VIEW {name} AS SELECT * FROM read_parquet({files!r}, union_by_name = true)")

    view("launches", parts("launches", b.launch_days))
    view("all_launches", parts("launches", b.trade_days))
    view("raw_trades", parts("trades", b.trade_days))
    view("migrations", parts("migrations", b.trade_days))
    view("pools", parts("pools", b.trade_days))
    for kind in ("hop1", "hop2", "busy", "wallets"):
        view(kind, [str(funding.ROOT / f"{kind}_{b.funding}.parquet")])
    con.execute(f"CREATE VIEW history AS SELECT * FROM read_parquet('{store.ROOT / 'wallet_history.parquet'}')")
    # The block's own tables; the token wallets are `token_wallets`, since `wallets` is the funding list.
    for table, name in (("tokens", "tokens"), ("trades", "trades"), ("edges", "edges"),
                        ("wallets", "token_wallets"), ("team", "team"), ("labels", "labels")):
        if b.path(table).exists():
            view(name, [str(b.path(table))])
    return con


STEPS = ("tokens", "trades", "edges", "wallets")


def prepare(name: str, steps: tuple[str, ...] = STEPS) -> dict[str, int]:
    """Tokens, their trades, wallet links and wallet context for a block (or some of these steps)."""
    b = block(name)
    b.dir.mkdir(parents=True, exist_ok=True)
    con = connect(b)
    counts = {}
    if "tokens" in steps:
        counts["tokens"] = _tokens(con, b)
        con.execute(f"CREATE OR REPLACE VIEW tokens AS SELECT * FROM read_parquet('{b.path('tokens')}')")
    if "trades" in steps:
        counts["trades"] = _trades(con, b)
        con.execute(f"CREATE OR REPLACE VIEW trades AS SELECT * FROM read_parquet('{b.path('trades')}')")
    if "edges" in steps or "wallets" in steps:
        _funding_graph(con)
    if "edges" in steps:
        counts["edges"] = _edges(con, b)
    if "wallets" in steps:
        counts["wallets"] = _wallets(con, b)
    return counts


def _copy(con, sql: str, path) -> int:
    con.execute(f"COPY ({sql}) TO '{path}' (FORMAT parquet, ROW_GROUP_SIZE 100000)")
    return con.execute(f"SELECT count(*) FROM read_parquet('{path}')").fetchall()[0][0]


def _tokens(con, b: Block) -> int:
    """Launches on the launch days at the starting floor the funding trace used (funding.py)."""
    scale = " ".join(f"WHEN {d} THEN {s}" for d, s in PRICE_SCALE.items())
    decimals = " ".join(f"WHEN '{m}' THEN {d}" for m, d in programs.QUOTE_DECIMALS.items())
    return _copy(con, f"""
        WITH l AS (
          SELECT *, CASE quote_mint {decimals} ELSE {programs.DEFAULT_QUOTE_DECIMALS} END AS quote_decimals FROM launches
        ),
        curve AS (
          SELECT t.mint, t.wallet, t.is_buy, t.quote_reserves, t.token_reserves
          FROM raw_trades AS t JOIN l USING (mint)
          WHERE t.venue = 'curve' AND t.block_time < l.block_time + {DAY}
        ),
        floor AS (
          SELECT mint FROM curve JOIN l USING (mint) GROUP BY mint
          HAVING count(DISTINCT wallet) FILTER (WHERE is_buy) >= {funding.FLOOR_BUYERS}
              OR max(CASE WHEN l.quote_mint = '{programs.WSOL}'
                          THEN CAST(quote_reserves AS DOUBLE) / CAST(token_reserves AS DOUBLE) * 1e6 END) >= {funding.FLOOR_MCAP_SOL}
        )
        SELECT mint, creator, "user" AS sender, name, symbol, uri, quote_mint, quote_decimals,
               CASE quote_decimals {scale} END AS price_scale,
               -- the curve's starting market cap: its price can never fall below this
               CAST(virtual_quote_reserves AS DOUBLE) / virtual_token_reserves * (CASE quote_decimals {scale} END) AS start_mcap,
               quote_mint = '{programs.WSOL}' AS sol_quoted,
               coalesce(is_mayhem_mode, false) AS mayhem, coalesce(is_cashback_enabled, false) AS cashback,
               block_time AS launch_ts, slot AS launch_slot, signature AS launch_sig
        FROM l WHERE mint IN (SELECT mint FROM floor)
        -- a mint created more than once: the repeats are failed transactions; keep the first
        QUALIFY row_number() OVER (PARTITION BY mint ORDER BY block_time, slot) = 1
        ORDER BY mint
    """, b.path("tokens"))


def _trades(con, b: Block) -> int:
    """Every successful trade of the block's tokens, PumpSwap pools resolved to their token.

    `mcap` is the market cap after the trade in quote units: from the curve's or the pool's
    reserves, except on Mayhem mode curves, whose reserves are reset between trades, where it
    comes from the trade's own price. Trades in pools other than the token's canonical one count
    toward holdings but don't set the price.

    Failed curve trades are dropped and curve trades are put in order by chain.py. `verified` is
    false where that isn't possible yet: Mayhem mode curves, and PumpSwap pools, where arbitrage
    bots' failed buy-and-sell transactions return the pool's token reserves to where they started
    (telling them apart needs the pool's quote reserves before each trade, which the decoded
    trades don't keep).
    """
    staged = settings.data_dir / "tmp" / f"trades_{b.name}"
    shutil.rmtree(staged, ignore_errors=True)
    (staged / "parts").mkdir(parents=True)
    _copy(con, f"""
        WITH pool_mint AS (
          SELECT pool, any_value(mint) AS mint, bool_or(canonical) AS canonical FROM (
            SELECT pool, mint, true AS canonical FROM migrations
            UNION ALL SELECT pool, base_mint, false FROM pools
          ) GROUP BY pool
        )
        SELECT k.mint, t.venue, t.pool, t.venue = 'curve' OR coalesce(p.canonical, false) AS canonical,
               t.wallet, t.is_buy, t.token_amount, t.quote_amount, t.fee, t.token_reserves,
               CASE WHEN NOT (t.venue = 'curve' OR coalesce(p.canonical, false)) THEN NULL
                    WHEN t.venue = 'curve' AND k.mayhem AND t.token_amount > 0
                      THEN CAST(t.quote_amount AS DOUBLE) / t.token_amount * k.price_scale
                    WHEN t.token_reserves > 0 THEN CAST(t.quote_reserves AS DOUBLE) / t.token_reserves * k.price_scale
               END AS mcap,
               CASE WHEN t.venue = 'curve' AND NOT k.mayhem THEN t.token_reserves END AS curve_tokens,
               CASE WHEN t.venue = 'curve' AND NOT k.mayhem THEN t.mint END AS chain_key,
               t.slot, t.block_time, t.ix_index, t.signature = k.launch_sig AS in_create_tx
        FROM raw_trades AS t
        LEFT JOIN pool_mint AS p ON t.venue = 'pumpswap' AND p.pool = t.pool
        JOIN tokens AS k ON k.mint = coalesce(t.mint, p.mint)
        WHERE t.block_time >= k.launch_ts
        ORDER BY k.mint, t.slot, NOT (t.signature = k.launch_sig), t.ix_index
    """, staged / "all.parquet")
    mints = [r[0] for r in con.execute("SELECT mint FROM tokens ORDER BY mint").fetchall()]
    tasks = [(str(staged), n, mints[i:i + 500]) for n, i in enumerate(range(0, len(mints), 500))]
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 2)) as pool:
        dropped = sum(pool.map(_verify_part, tasks))
    count = _copy(con, f"""
        SELECT * EXCLUDE (ok, seq, chain_key, token_reserves), ok IS NOT NULL AS verified
        FROM read_parquet('{staged}/parts/*.parquet')
        WHERE ok IS DISTINCT FROM false
        ORDER BY mint, slot, venue = 'pumpswap', seq
    """, b.path("trades"))
    shutil.rmtree(staged, ignore_errors=True)
    print(f"{b.name}: dropped {dropped:,} failed trades", flush=True)
    return count


def _verify_part(args) -> int:
    """Run the reserve chain over one range of tokens (a worker). Returns the failed trades found."""
    staged, n, mints = args
    import pandas as pd

    lo, hi = mints[0], mints[-1]
    t = pads.dataset(f"{staged}/all.parquet").to_table(
        filter=(pc.field("mint") >= lo) & (pc.field("mint") <= hi)).to_pandas()
    t = t[t.mint.isin(set(mints))].reset_index(drop=True)
    ok = pd.array([pd.NA] * len(t), dtype="boolean")
    seq = np.arange(len(t), dtype=np.float64)
    for _, g in t[t.chain_key.notna()].groupby("chain_key", sort=False):
        good, order = chain.verify(g.is_buy.to_numpy(), g.token_amount.to_numpy(), g.token_reserves.to_numpy(),
                                   g.slot.to_numpy())
        idx = g.index.to_numpy()
        ok[idx] = good
        seq[idx] = order
    t["ok"] = ok
    t["seq"] = seq
    t.to_parquet(f"{staged}/parts/part-{n:04d}.parquet", index=False)
    return int((t.ok == False).sum())  # noqa: E712 (NA stays NA)


def _funding_graph(con) -> None:
    """Hubs, and each traced wallet's funders up to two hops back (`anc`), never through a hub."""
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE hubs AS
        SELECT src AS wallet FROM busy
        UNION SELECT dst FROM (SELECT dst, src FROM hop1 UNION SELECT dst, src FROM hop2)
        GROUP BY dst HAVING count(DISTINCT src) >= {HUB_SENDERS}
    """)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE anc AS
        WITH h1 AS (
          SELECT dst AS w, src AS a, min(ts) AS ts FROM hop1
          WHERE lamports >= {MIN_LINK_LAMPORTS} AND src NOT IN (SELECT wallet FROM hubs) AND src != dst
          GROUP BY dst, src
        ),
        h2 AS (
          SELECT h1.w, x.src AS a, min(greatest(h1.ts, x.ts)) AS ts
          FROM h1 JOIN hop2 AS x ON x.dst = h1.a
          WHERE x.lamports >= {MIN_LINK_LAMPORTS} AND x.src NOT IN (SELECT wallet FROM hubs) AND x.src != h1.w
          GROUP BY h1.w, x.src
        )
        SELECT w, a, min(hop) AS hop, min(ts) AS ts
        FROM (SELECT *, 1 AS hop FROM h1 UNION ALL SELECT *, 2 FROM h2) GROUP BY w, a
    """)


def _edges(con, b: Block) -> int:
    """Links between each token's wallets in its first day, from SOL transfers (7.4).

    - funded: w2 sent SOL to w1, directly or through one other wallet;
    - shared_funder: one wallet funded both, directly for at least one of them and within two
      hops for the other (two-hop cousins on both sides linked unrelated holders);
    - same_exchange: both got the same amount (within 1%) from the same busy sender within
      10 minutes, in the two days before their first trade (the likely-team pattern).
    `ts` is when the link became visible on chain. Hubs and busy senders never link wallets.
    """
    con.execute(f"""
        CREATE OR REPLACE TABLE tw AS
        SELECT mint, wallet, min(first_ts) AS first_ts FROM (
          SELECT t.mint, t.wallet, min(t.block_time) AS first_ts
          FROM trades AS t JOIN tokens AS k USING (mint)
          WHERE t.block_time < k.launch_ts + {DAY} AND t.wallet != '{programs.MAYHEM_AGENT}'
          GROUP BY t.mint, t.wallet
          UNION ALL SELECT mint, creator, launch_ts FROM tokens
        ) GROUP BY mint, wallet
    """)
    return _copy(con, f"""
        WITH ta AS (SELECT tw.mint, anc.w, anc.a, anc.hop, anc.ts FROM tw JOIN anc ON anc.w = tw.wallet),
        funded AS (
          SELECT ta.mint, ta.w AS w1, ta.a AS w2, ta.ts, 'funded' AS kind
          FROM ta JOIN tw ON tw.mint = ta.mint AND tw.wallet = ta.a
        ),
        shared AS (
          SELECT x.mint, x.w AS w1, y.w AS w2, min(greatest(x.ts, y.ts)) AS ts, 'shared_funder' AS kind
          FROM ta AS x JOIN ta AS y ON x.mint = y.mint AND x.a = y.a AND x.w < y.w AND x.hop + y.hop <= 3
          GROUP BY x.mint, x.w, y.w
        ),
        exch AS (
          SELECT tw.mint, tw.wallet AS w, h.src, h.ts, h.lamports
          FROM tw JOIN tokens AS k USING (mint) JOIN hop1 AS h ON h.dst = tw.wallet
          WHERE h.src IN (SELECT src FROM busy) AND h.lamports >= {MIN_LINK_LAMPORTS}
            AND h.ts BETWEEN tw.first_ts - {FUNDING_LOOKBACK} AND tw.first_ts
        ),
        same AS (
          SELECT x.mint, x.w AS w1, y.w AS w2, min(greatest(x.ts, y.ts)) AS ts, 'same_exchange' AS kind
          FROM exch AS x JOIN exch AS y
            ON x.mint = y.mint AND x.src = y.src AND x.w < y.w AND abs(x.ts - y.ts) <= {LIKELY_TEAM_SECONDS}
           AND abs(x.lamports - y.lamports) <= {LIKELY_TEAM_AMOUNT} * greatest(x.lamports, y.lamports)
          GROUP BY x.mint, x.w, y.w
        )
        SELECT * FROM funded UNION ALL SELECT * FROM shared UNION ALL SELECT * FROM same
        ORDER BY mint
    """, b.path("edges"))


def _wallets(con, b: Block) -> int:
    """Each token's wallets in its first day, with their funding and history before the launch.

    History comes only from before the launch (and within HISTORY_LOOKBACK), so it never reads
    the future and can be rebuilt live:
    - snipes: tokens the wallet bought within SNIPE_SECONDS of their launch;
    - tokens and pnl: tokens it traded, and the SOL it made on positions closed before the launch.
    `habit_creators` counts the creators whose tokens it bought that early anywhere in the
    block, past or future; it's for labels only (telling launch-bundle wallets from sniper bots).
    """
    con.execute(f"""
        CREATE OR REPLACE TABLE early AS
        SELECT t.wallet, t.mint, l.creator, l.block_time AS launch_ts
        FROM raw_trades AS t JOIN all_launches AS l USING (mint)
        WHERE t.venue = 'curve' AND t.is_buy AND t.block_time <= l.block_time + {SNIPE_SECONDS}
          AND t.wallet != l.creator
        GROUP BY ALL
    """)
    con.execute("""
        CREATE OR REPLACE TABLE early_cum AS
        SELECT wallet, launch_ts, count(*) OVER (PARTITION BY wallet ORDER BY launch_ts ROWS UNBOUNDED PRECEDING) AS n
        FROM early
    """)
    con.execute("""
        CREATE OR REPLACE TABLE hist_first AS
        SELECT wallet, first_ts, count(*) OVER (PARTITION BY wallet ORDER BY first_ts ROWS UNBOUNDED PRECEDING) AS n
        FROM history WHERE first_ts IS NOT NULL
    """)
    con.execute("""
        CREATE OR REPLACE TABLE hist_closed AS
        SELECT wallet, last_ts,
               sum(coalesce(quote_received, 0) - coalesce(quote_spent, 0)) OVER w AS pnl,
               sum(CASE WHEN coalesce(quote_received, 0) > coalesce(quote_spent, 0) THEN 1 ELSE 0 END) OVER w AS wins,
               count(*) OVER w AS n
        FROM history WHERE last_ts IS NOT NULL AND buys > 0
        WINDOW w AS (PARTITION BY wallet ORDER BY last_ts ROWS UNBOUNDED PRECEDING)
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE first_trades AS
        SELECT t.mint, t.wallet,
               min(t.block_time) AS first_ts,
               min(t.block_time) FILTER (WHERE t.is_buy) AS first_buy_ts,
               min(t.slot) FILTER (WHERE t.is_buy) - any_value(k.launch_slot) AS first_buy_slot,
               any_value(k.launch_ts) AS launch_ts
        FROM trades AS t JOIN tokens AS k USING (mint)
        WHERE t.block_time < k.launch_ts + {DAY}
        GROUP BY t.mint, t.wallet
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE w0 AS
        SELECT coalesce(f.mint, k.mint) AS mint, coalesce(f.wallet, k.creator) AS wallet,
               coalesce(f.launch_ts, k.launch_ts) AS launch_ts,
               -- a creator's first act is the launch, even if it trades later
               CASE WHEN k.mint IS NOT NULL THEN k.launch_ts ELSE f.first_ts END AS first_ts,
               f.first_buy_ts, f.first_buy_slot, k.mint IS NOT NULL AS is_creator
        FROM first_trades AS f FULL JOIN tokens AS k ON k.mint = f.mint AND k.creator = f.wallet
    """)
    return _copy(con, f"""
        WITH fund AS (
          SELECT w0.mint, w0.wallet, max(h.ts) AS funded_ts, arg_max(h.src IN (SELECT wallet FROM hubs), h.ts) AS funded_by_hub,
                 arg_max(h.lamports, h.ts) AS funded_lamports
          FROM w0 JOIN hop1 AS h ON h.dst = w0.wallet
          WHERE h.lamports >= {MIN_LINK_LAMPORTS} AND h.ts BETWEEN w0.first_ts - {FUNDING_LOOKBACK} AND w0.first_ts
          GROUP BY w0.mint, w0.wallet
        ),
        habit AS (SELECT wallet, count(DISTINCT creator) AS habit_creators FROM early GROUP BY wallet),
        -- running counts as of the launch, minus the same as of HISTORY_LOOKBACK before it
        s1 AS (SELECT w0.*, h.n AS snipes_now FROM w0 ASOF LEFT JOIN early_cum AS h ON h.wallet = w0.wallet AND w0.launch_ts > h.launch_ts),
        s2 AS (SELECT s1.*, h.n AS snipes_before FROM s1 ASOF LEFT JOIN early_cum AS h ON h.wallet = s1.wallet AND s1.launch_ts - {HISTORY_LOOKBACK} > h.launch_ts),
        s3 AS (SELECT s2.*, h.n AS tokens_now FROM s2 ASOF LEFT JOIN hist_first AS h ON h.wallet = s2.wallet AND s2.launch_ts > h.first_ts),
        s4 AS (SELECT s3.*, h.n AS tokens_before FROM s3 ASOF LEFT JOIN hist_first AS h ON h.wallet = s3.wallet AND s3.launch_ts - {HISTORY_LOOKBACK} > h.first_ts),
        s5 AS (SELECT s4.*, h.pnl AS pnl_now, h.wins AS wins_now, h.n AS closed_now
               FROM s4 ASOF LEFT JOIN hist_closed AS h ON h.wallet = s4.wallet AND s4.launch_ts > h.last_ts),
        f AS (SELECT s5.*, h.pnl AS pnl_before, h.wins AS wins_before, h.n AS closed_before
              FROM s5 ASOF LEFT JOIN hist_closed AS h ON h.wallet = s5.wallet AND s5.launch_ts - {HISTORY_LOOKBACK} > h.last_ts)
        SELECT f.mint, f.wallet, f.is_creator, f.first_ts, f.first_buy_ts, f.first_buy_slot,
               f.wallet IN (SELECT address FROM wallets) AS traced,
               fund.funded_ts, coalesce(fund.funded_by_hub, false) AS funded_by_hub, fund.funded_lamports,
               coalesce(f.snipes_now, 0) - coalesce(f.snipes_before, 0) AS snipes_24h,
               coalesce(habit.habit_creators, 0) AS habit_creators,
               coalesce(f.tokens_now, 0) - coalesce(f.tokens_before, 0) AS tokens_24h,
               (coalesce(f.pnl_now, 0) - coalesce(f.pnl_before, 0)) / 1e9 AS pnl_24h_sol,
               coalesce(f.wins_now, 0) - coalesce(f.wins_before, 0) AS wins_24h,
               coalesce(f.closed_now, 0) - coalesce(f.closed_before, 0) AS closed_24h
        FROM f LEFT JOIN fund USING (mint, wallet) LEFT JOIN habit USING (wallet)
        ORDER BY f.mint, f.first_ts
    """, b.path("wallets"))


def reputation(name: str, label_hours: int) -> dict[str, int]:
    """Past rugs as of each launch: team wallets and creators whose earlier tokens rugged (7.3).

    Needs labels. Only rugs that had happened before the launch count, within HISTORY_LOOKBACK,
    and a wallet counts as team in an earlier token only from when it became visible as team.

        reputation.parquet  (mint, wallet): earlier rugs this wallet was team in
        creators.parquet    per token: the creator's and its funder group's launches and rugs
    """
    b = block(name)
    con = connect(b)
    _funding_graph(con)
    con.execute(f"""
        CREATE TEMP TABLE rugs AS
        SELECT l.mint, l.rug_ts, k.creator, k.launch_ts FROM labels AS l JOIN tokens AS k USING (mint)
        WHERE l.hours = {label_hours} AND l.rug_ts <= k.launch_ts + {label_hours} * 3600
    """)
    # Materialized first so the join below matches on wallet before comparing times (DuckDB
    # otherwise plans the time comparisons as a range join, which took 10 minutes for one day).
    con.execute("""
        CREATE TEMP TABLE team_rugs AS
        SELECT m.wallet, m.since, r.rug_ts FROM team AS m JOIN rugs AS r USING (mint) WHERE m.role = 'team'
    """)
    con.execute("CREATE TEMP TABLE launched AS SELECT w.mint, w.wallet, k.launch_ts FROM token_wallets AS w JOIN tokens AS k USING (mint)")
    counts = {}
    counts["reputation"] = _copy(con, f"""
        SELECT w.mint, w.wallet, count(*) AS team_rugs_24h
        FROM launched AS w JOIN team_rugs AS r ON r.wallet = w.wallet
        WHERE r.rug_ts < w.launch_ts AND r.since < w.launch_ts AND r.rug_ts >= w.launch_ts - {HISTORY_LOOKBACK}
        GROUP BY w.mint, w.wallet
        ORDER BY w.mint
    """, b.path("reputation"))
    counts["creators"] = _copy(con, f"""
        WITH own AS (
          SELECT k.mint, count(DISTINCT l.mint) AS launches
          FROM tokens AS k JOIN all_launches AS l ON l.creator = k.creator AND l.mint != k.mint
          WHERE l.block_time < k.launch_ts AND l.block_time >= k.launch_ts - {HISTORY_LOOKBACK}
          GROUP BY k.mint
        ),
        own_rugs AS (
          SELECT k.mint, count(*) AS rugs FROM tokens AS k JOIN rugs AS r ON r.creator = k.creator AND r.mint != k.mint
          WHERE r.rug_ts < k.launch_ts AND r.launch_ts >= k.launch_ts - {HISTORY_LOOKBACK}
          GROUP BY k.mint
        ),
        funders AS (
          SELECT k.mint, k.launch_ts, a.a AS funder FROM tokens AS k JOIN anc AS a ON a.w = k.creator
          WHERE a.hop = 1 AND a.ts < k.launch_ts
        ),
        group_creators AS (  -- the funder itself, and other creators it funded directly
          SELECT f.mint, f.launch_ts, f.funder AS creator FROM funders AS f
          UNION SELECT f.mint, f.launch_ts, a.w FROM funders AS f JOIN anc AS a ON a.a = f.funder AND a.hop = 1 AND a.ts < f.launch_ts
        ),
        grp_launches AS (
          SELECT g.mint, count(DISTINCT l.mint) AS launches
          FROM group_creators AS g JOIN all_launches AS l ON l.creator = g.creator AND l.mint != g.mint
          WHERE l.block_time < g.launch_ts AND l.block_time >= g.launch_ts - {HISTORY_LOOKBACK}
          GROUP BY g.mint
        ),
        grp_rugs AS (
          SELECT g.mint, count(DISTINCT r.mint) AS rugs
          FROM group_creators AS g JOIN rugs AS r ON r.creator = g.creator AND r.mint != g.mint
          WHERE r.rug_ts < g.launch_ts AND r.launch_ts >= g.launch_ts - {HISTORY_LOOKBACK}
          GROUP BY g.mint
        ),
        grp AS (
          SELECT mint, coalesce(grp_launches.launches, 0) AS launches, coalesce(grp_rugs.rugs, 0) AS rugs
          FROM grp_launches FULL JOIN grp_rugs USING (mint)
        ),
        fund AS (
          SELECT w.mint, w.funded_ts, w.funded_by_hub FROM token_wallets AS w WHERE w.is_creator
        )
        SELECT k.mint, coalesce(own.launches, 0) AS creator_launches_24h, coalesce(own_rugs.rugs, 0) AS creator_rugs_24h,
               coalesce(grp.launches, 0) AS group_launches_24h, coalesce(grp.rugs, 0) AS group_rugs_24h,
               (k.launch_ts - fund.funded_ts) / 60 AS creator_funded_minutes_before,
               coalesce(fund.funded_by_hub, false) AS creator_funded_by_hub
        FROM tokens AS k LEFT JOIN own USING (mint) LEFT JOIN own_rugs USING (mint) LEFT JOIN grp USING (mint)
        LEFT JOIN fund USING (mint)
        ORDER BY k.mint
    """, b.path("creators"))
    return counts

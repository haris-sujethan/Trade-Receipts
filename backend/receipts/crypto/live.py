"""Live scoring's token data (SPEC.md 7.10): one token's history from Helius, written as the raw
tables the BigQuery pull makes and run through the same dataset, label and signal code as
training, so a live snapshot is built exactly like the ones the models learned from.

For a token as of time T (now, or a past moment for the parity check):
1. Its trades: every successful transaction that touched the mint, from launch to T.
2. The wallets a check traces at T (the creator, the first 50 buyers and the 50 biggest
   holders): their transactions in the two days before the launch, newest first, and from the
   launch to T. SOL transfers into them are hop 1; their pump.fun trades and launches are their
   wallet history.
3. Their funders (hop-1 senders that aren't busy): SOL transfers into them are hop 2.
4. Busy senders: those the training pull found, plus any with BUSY_TXS or more transactions in
   the window. (BigQuery counted distinct receivers over the whole block; one call can't.)
5. For wallets that bought in the first 10 seconds: whether they sniped 10 other tokens in the
   day before (the sniper-bot habit), looking up the launches they bought into most often first
   and stopping once each wallet reaches 10.

Live data can be thinner than training's; `gaps` says where, and `parity` measures the
difference on tokens that are in the training data (SPEC.md 11):
- wallet and funder scans stop after a few pages (busy traders);
- funding counts from two days before the launch (training's pull reached back to two days
  before the block's first day);
- past rugs (team wallets in earlier rugs, the creator's rugs) need other tokens' outcomes and
  count as none, and the creator's funder group's launches aren't fetched.

    data/live/<mint>_<T>/  raw tables, the block's tables, and check.json
"""

import dataclasses
import json
import math
import shutil
import time
import types
import typing

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from receipts.config import settings
from receipts.crypto import baselines, dataset, events, funding, helius, history, labels, programs, roles, signals, transactions

ROOT = settings.data_dir / "live"
TOKEN_PAGES = 300  # up to 30,000 of the token's transactions
WALLET_PAGES = 5  # up to 500 of a traced wallet's transactions before the launch
SINCE_PAGES = 3  # and up to 300 from the launch to T
FUNDER_PAGES = 2
FUNDERS = 150  # funders scanned for hop 2, biggest transfers first
BUSY_TXS = 200
BUSY_CHECKS = 300
SNIPE_LOOKUPS = 150  # other tokens' launches looked up for the sniper-bot habit
KINDS = {"launches": events.Launch, "trades": events.Trade, "graduations": events.Graduation,
         "migrations": events.Migration, "pools": events.Pool}
HOPS = pa.schema([("hop", pa.int64()), ("ts", pa.int64()), ("src", pa.string()), ("dst", pa.string()),
                  ("lamports", pa.int64()), ("receivers", pa.int64())])

_known_busy: set[str] | None = None


class NotPumpFun(ValueError):
    pass


def known_busy() -> set[str]:
    """Senders the training pull found paying 200+ wallets (exchange hot wallets, bots, services)."""
    global _known_busy
    if _known_busy is None:
        files = sorted(funding.ROOT.glob("busy_*.parquet"))
        _known_busy = set(duckdb.sql(f"SELECT DISTINCT src FROM read_parquet({[str(f) for f in files]!r})").fetchnumpy()["src"]) if files else set()
    return _known_busy


def _arrow_type(annotation) -> pa.DataType:
    args = set(typing.get_args(annotation)) - {type(None)} if isinstance(annotation, types.UnionType) else {annotation}
    return {str: pa.string(), int: pa.int64(), bool: pa.bool_()}[args.pop()]


def _write_records(cls, records: list, path) -> None:
    fields = [f for f in dataclasses.fields(cls) if f.name != "ctx"]
    names = [f.name for f in fields] + ["signature", "slot", "block_time", "ix_index"]
    if not records:
        types_ = [_arrow_type(f.type) for f in fields] + [pa.string(), pa.int64(), pa.int64(), pa.int64()]
        pq.write_table(pa.schema(list(zip(names, types_))).empty_table(), path)
        return
    cols = {n: [] for n in names}
    for r in records:
        for f in fields:
            cols[f.name].append(getattr(r, f.name))
        cols["signature"].append(r.ctx.signature)
        cols["slot"].append(r.ctx.slot)
        cols["block_time"].append(r.ctx.block_time)
        cols["ix_index"].append(r.ctx.index)
    out = {}
    for name, values in cols.items():
        try:
            out[name] = pa.array(values)
        except (pa.ArrowInvalid, OverflowError):  # u64 amounts past int64, as store._typed
            out[name] = pa.array(values, type=pa.decimal128(38, 0))
    pq.write_table(pa.table(out), path)


def _write_hops(hop: int, rows: list[tuple], path) -> None:
    pq.write_table(pa.table({"hop": [hop] * len(rows), "ts": [r[0] for r in rows], "src": [r[1] for r in rows],
                             "dst": [r[2] for r in rows], "lamports": [r[3] for r in rows],
                             "receivers": [r[4] if len(r) > 4 else None for r in rows]}, schema=HOPS), path)


def verdict(p: float) -> str:
    low, high = baselines.VERDICTS
    return "Likely rug" if p >= high else "Possible rug" if p >= low else "Unlikely rug"


class Check:
    """One live check of one token as of `as_of` (default now). `progress` gets a callback per step."""

    def __init__(self, mint: str, as_of: int | None = None, client: helius.Helius | None = None, progress=None):
        self.h = client or helius.Helius()
        self.mint = mint
        self.T = int(as_of or time.time())
        self.progress = progress or (lambda **kv: None)
        self.seen: set[str] = set()
        self.records: list = []
        self.transfers: list[tuple[int, str, str, int]] = []
        self.gaps: dict[str, int] = {}
        self.credits_start = self.h.spent_this_month()
        self.folder = ROOT / f"{mint}_{self.T}"

    def _read(self, txs: list[dict]) -> None:
        for tx in txs:
            sig = tx["transaction"]["signatures"][0]
            if sig in self.seen:
                continue
            self.seen.add(sig)
            self.records += transactions.records(tx)
            self.transfers += transactions.sol_transfers(tx)

    def _scan(self, address: str, gte: int, pages: int, gap: str, lte: int | None = None) -> None:
        complete = False
        for txs, complete in self.h.history(address, gte=gte, lte=self.T if lte is None else lte, order="desc", max_pages=pages):
            self._read(txs)
        if not complete:
            self.gaps[gap] = self.gaps.get(gap, 0) + 1

    # The steps

    def token(self) -> events.Launch:
        complete = False
        for txs, complete in self.h.history(self.mint, gte=0, lte=self.T, order="asc", max_pages=TOKEN_PAGES):
            self._read(txs)
            self.progress(step="token", transactions=len(self.seen))
        if not complete:
            self.gaps["token_transactions_cut_short"] = 1
        launch = next((r for r in self.records if isinstance(r, events.Launch) and r.mint == self.mint), None)
        if launch is None:
            raise NotPumpFun(f"{self.mint}: no pump.fun launch found for this mint")
        return launch

    def token_trades(self) -> list[events.Trade]:
        pools = {r.pool for r in self.records if isinstance(r, events.Migration) and r.mint == self.mint}
        pools |= {r.pool for r in self.records if isinstance(r, events.Pool) and r.base_mint == self.mint}
        return [r for r in self.records if isinstance(r, events.Trade) and r.ctx.block_time <= self.T
                and (r.mint == self.mint or (r.venue == "pumpswap" and r.pool in pools))]

    def traced(self, launch: events.Launch) -> set[str]:
        """The creator, the first buyers and the biggest holders at T, chosen as signals.snapshot does."""
        trades = self.token_trades()
        names = sorted({t.wallet for t in trades})
        first_buy, held = {}, dict.fromkeys(names, 0.0)
        for t in trades:
            if t.is_buy:
                held[t.wallet] += t.token_amount
                if t.wallet != programs.MAYHEM_AGENT:
                    first_buy[t.wallet] = min(first_buy.get(t.wallet, math.inf), t.ctx.block_time)
            else:
                held[t.wallet] -= t.token_amount
        buyers = sorted(first_buy, key=lambda w: (first_buy[w], w))[:signals.TRACE_BUYERS]
        holders = sorted((w for w in names if held[w] > 0), key=lambda w: (-min(held[w], programs.TOTAL_SUPPLY), w))
        return {launch.creator, *buyers, *holders[:signals.TRACE_HOLDERS]}

    def wallets(self, traced: set[str], start: int, launch_ts: int) -> None:
        """Each traced wallet's last transactions before the launch (funding and history), then
        those since the launch. Busy traders' scans stop early, so the pre-launch day is read
        separately rather than lost behind their trading after the launch."""
        for i, w in enumerate(sorted(traced)):
            if w == programs.MAYHEM_AGENT:  # pump.fun's own agent: no funding, endless history
                continue
            self._scan(w, start, WALLET_PAGES, "wallet_scans_cut_short", lte=launch_ts - 1)
            self._scan(w, launch_ts, SINCE_PAGES, "wallet_scans_cut_short")
            self.progress(step="wallets", scanned=i + 1, of=len(traced))

    def busy(self, senders: list[str], start: int) -> dict[str, int]:
        """Busy senders among these: known from training, or with BUSY_TXS+ transactions in the window."""
        known = known_busy()
        found = {s: BUSY_TXS for s in senders if s in known}
        unknown = [s for s in senders if s not in known]
        if len(unknown) > BUSY_CHECKS:
            self.gaps["busy_checks_skipped"] = len(unknown) - BUSY_CHECKS
        for i, s in enumerate(unknown[:BUSY_CHECKS]):
            n = self.h.count_since(s, gte=start, lte=self.T)
            if n >= BUSY_TXS:
                found[s] = n
            self.progress(step="busy", checked=i + 1, of=min(len(unknown), BUSY_CHECKS))
        return found

    def snipes(self, launch: events.Launch, early: list[str], slot0: set[str]) -> None:
        """Look up the launches of tokens the early wallets bought in the day before, until each
        has SNIPER_HABIT snipes or SNIPE_LOOKUPS lookups are spent. The habit decides whether a
        launch-slot buyer is the creator's bundle (team) or a sniper bot, so tokens bought by
        launch-slot buyers go first; then the tokens most early wallets bought (sniper bots snipe
        the same launches), and the buys made earliest on the curve. The launches found go into
        the raw tables, where dataset's own SQL counts the snipes."""
        L = launch.ctx.block_time
        launched = {r.mint: r.ctx.block_time for r in self.records if isinstance(r, events.Launch)}
        wanted = set(early)
        buys: dict[str, list[events.Trade]] = {}
        for r in self.records:
            if (isinstance(r, events.Trade) and r.wallet in wanted and r.is_buy and r.venue == "curve" and r.mint
                    and r.mint != self.mint and L - dataset.HISTORY_LOOKBACK <= r.ctx.block_time < L):
                buys.setdefault(r.mint, []).append(r)
        snipes = dict.fromkeys(early, 0)

        def count(m: str) -> None:
            for w in {b.wallet for b in buys.pop(m) if b.ctx.block_time <= launched[m] + dataset.SNIPE_SECONDS}:
                snipes[w] += 1

        for m in [m for m in buys if m in launched]:  # launches already read cost nothing
            count(m)
        lookups = 0
        while buys:
            pending = {w for w, n in snipes.items() if n < roles.SNIPER_HABIT}
            if not pending:
                break
            # greedy: the token that helps the most launch-slot buyers still short of the habit
            m = max(buys, key=lambda m: (len({b.wallet for b in buys[m]} & pending & slot0),
                                         len({b.wallet for b in buys[m]} & pending), max(b.token_reserves for b in buys[m])))
            if not {b.wallet for b in buys[m]} & pending:
                break
            if lookups >= SNIPE_LOOKUPS:
                self.gaps["snipe_lookups_capped"] = 1
                break
            lookups += 1
            for txs, _ in self.h.history(m, gte=0, lte=max(b.ctx.block_time for b in buys[m]), order="asc", max_pages=1):
                self._read(txs)
            launch_of = next((r for r in self.records if isinstance(r, events.Launch) and r.mint == m), None)
            if launch_of is None:
                buys.pop(m)
                continue
            launched[m] = launch_of.ctx.block_time
            count(m)
            self.progress(step="snipes", lookups=lookups, sniper_bots=sum(n >= roles.SNIPER_HABIT for n in snipes.values()))

    def run(self) -> dict:
        shutil.rmtree(self.folder, ignore_errors=True)
        (self.folder / "raw").mkdir(parents=True)
        launch = self.token()
        L = launch.ctx.block_time
        start = L - dataset.FUNDING_LOOKBACK
        traced = self.traced(launch)
        self.wallets(traced, start, L)

        hop1 = [x for x in self.transfers if x[2] in traced and start <= x[0] <= self.T]
        senders = sorted({x[1] for x in hop1 if x[3] >= dataset.MIN_LINK_LAMPORTS})
        busy = self.busy(senders, start)
        by_size: dict[str, int] = {}
        for ts, src, dst, lamports in hop1:
            if src not in busy and lamports >= dataset.MIN_LINK_LAMPORTS:
                by_size[src] = max(by_size.get(src, 0), lamports)
        funders = sorted(by_size, key=lambda s: -by_size[s])
        if len(funders) > FUNDERS:
            self.gaps["funders_skipped"] = len(funders) - FUNDERS
        for i, f in enumerate(funders[:FUNDERS]):
            if f not in traced:
                self._scan(f, start, FUNDER_PAGES, "funder_scans_cut_short")
            self.progress(step="funders", scanned=i + 1, of=min(len(funders), FUNDERS))
        funder_set = set(funders[:FUNDERS])
        hop2 = [x for x in self.transfers if x[2] in funder_set and start <= x[0] <= self.T]
        busy |= self.busy(sorted({x[1] for x in hop2 if x[3] >= dataset.MIN_LINK_LAMPORTS} - set(busy)), start)

        first, slot0 = {}, set()
        for t in self.token_trades():
            if t.is_buy and t.wallet not in (launch.creator, programs.MAYHEM_AGENT):
                first[t.wallet] = min(first.get(t.wallet, math.inf), t.ctx.block_time)
                if t.ctx.slot == launch.ctx.slot:
                    slot0.add(t.wallet)
        self.snipes(launch, sorted(w for w, ts in first.items() if ts <= L + dataset.SNIPE_SECONDS), slot0)
        return self.build(launch, traced, hop1, hop2, busy)

    def build(self, launch, traced, hop1, hop2, busy) -> dict:
        """Write the raw tables, then run the training code on them."""
        raw = self.folder / "raw"
        by_kind = {k: [] for k in KINDS}
        for r in dict.fromkeys(self.records):  # records are frozen: equal events dedupe
            by_kind[next(k for k, cls in KINDS.items() if isinstance(r, cls))].append(r)
        for kind, cls in KINDS.items():
            _write_records(cls, by_kind[kind], raw / f"{kind}.parquet")
        _write_records(events.Launch, [launch], raw / "launch.parquet")
        _write_hops(1, hop1, raw / "hop1.parquet")
        _write_hops(2, hop2, raw / "hop2.parquet")
        _write_hops(0, [(None, s, None, None, n) for s, n in busy.items()], raw / "busy.parquet")
        pq.write_table(pa.table({"address": sorted(traced)}), raw / "wallets.parquet")
        con = duckdb.connect()
        for view, kind in (("launches", "launches"), ("trades", "trades"), ("migrations", "migrations"), ("pools", "pools")):
            con.execute(f"CREATE VIEW {view} AS SELECT * FROM read_parquet('{raw / kind}.parquet')")
        history.write(con, raw / "history.parquet")

        b = dataset.Block(
            name=f"live-{self.mint[:8]}-{self.T}", trade_days=[], launch_days=[], funding="", root=self.folder,
            sources={"launches": [raw / "launch.parquet"], "all_launches": [raw / "launches.parquet"],
                     "raw_trades": [raw / "trades.parquet"], "migrations": [raw / "migrations.parquet"],
                     "pools": [raw / "pools.parquet"], "hop1": [raw / "hop1.parquet"], "hop2": [raw / "hop2.parquet"],
                     "busy": [raw / "busy.parquet"], "wallets": [raw / "wallets.parquet"],
                     "history": [raw / "history.parquet"]})
        result = {"mint": self.mint, "as_of": self.T, "launch_ts": launch.ctx.block_time, "age_s": self.T - launch.ctx.block_time,
                  "name": launch.name, "symbol": launch.symbol, "creator": launch.creator,
                  "transactions_read": len(self.seen), "traced_wallets": len(traced), "gaps": self.gaps}
        counts = dataset.prepare(b)
        if not counts["tokens"]:
            result["status"] = "below_floor"
            return self._finish(result)
        labels.build_team(b)
        labels.build(b)
        dataset.reputation(b, signals.LABEL_HOURS)
        tok = signals._tokens_for(b, [self.mint])[0]
        age = self.T - tok.launch_ts
        if not math.isnan(tok.rug_ts) and tok.rug_ts <= self.T:
            result |= {"status": "rugged", "rug_ts": tok.rug_ts, "rug_age_s": tok.rug_ts - tok.launch_ts}
            return self._finish(result)
        sig, ctx = signals.snapshot(tok, age, context=True)
        result["signals"] = {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in sig.items()}
        if age > signals.LABEL_HOURS * 3600:
            result["status"] = "too_old"
        elif not sig["above_floor"]:
            result["status"] = "below_floor"
        else:
            _, _, rug_chance = baselines.tree_model()
            p = rug_chance(sig)
            result |= {"status": "scored", "trees_rug_chance": p, "verdict": verdict(p)}
        self.token_view = (tok, sig, ctx)
        return self._finish(result)

    def _finish(self, result: dict) -> dict:
        result["helius_credits"] = self.h.spent_this_month() - self.credits_start
        (self.folder / "check.json").write_text(json.dumps(result, indent=2, default=str))
        return result


def check(mint: str, as_of: int | None = None, progress=None) -> dict:
    return Check(mint, as_of, progress=progress).run()


def parity(n: int = 8, seed: int = 7) -> dict:
    """Live checks of May 16 test tokens, compared with their training snapshots (SPEC.md 11):
    how often each signal matches, and how far the trees' rug chance moves.

        data/reports/live_parity.json
    """
    import pandas as pd

    snaps = pd.read_parquet(dataset.block("may").path("snapshots"))
    snaps["day"] = pd.to_datetime(snaps.snapshot_ts - snaps.age_s, unit="s").dt.date.astype(str)
    pool = snaps[(snaps.day == "2026-05-16") & snaps.above_floor & snaps.label_24h.notna() & (snaps.age_s <= 3600)]
    sample = pool.sample(n, random_state=seed)
    _, cols, rug_chance = baselines.tree_model()
    rows, agree = [], {}
    for _, row in sample.iterrows():
        result = Check(row.mint, as_of=int(row.snapshot_ts)).run()
        live_sig = result.get("signals") or {}
        for c in cols:
            if c in live_sig:
                a, b = live_sig[c], row[c]
                a = math.nan if a is None else float(a)
                same = (math.isnan(a) and pd.isna(b)) or (not pd.isna(b) and abs(a - float(b)) <= 1e-6 * max(1.0, abs(float(b))))
                agree.setdefault(c, []).append(bool(same))
        rows.append({"mint": row.mint, "age_s": int(row.age_s), "label": row.label_24h, "status": result["status"],
                     "training_rug_chance": rug_chance(row.to_dict()), "live_rug_chance": result.get("trees_rug_chance"),
                     "helius_credits": result["helius_credits"], "gaps": result["gaps"]})
        print(rows[-1], flush=True)
    scored = [r for r in rows if r["live_rug_chance"] is not None]
    diffs = [abs(r["live_rug_chance"] - r["training_rug_chance"]) for r in scored]
    report = {
        "tokens": len(rows), "scored_both_ways": len(scored),
        "rug_chance_abs_diff": {"mean": float(np.mean(diffs)) if diffs else None, "max": max(diffs) if diffs else None},
        "same_verdict": sum(verdict(r["live_rug_chance"]) == verdict(r["training_rug_chance"]) for r in scored),
        "signals_matching_share": {c: round(float(np.mean(v)), 3) for c, v in sorted(agree.items(), key=lambda kv: np.mean(kv[1]))},
        "helius_credits_mean": float(np.mean([r["helius_credits"] for r in rows])) if rows else None,
        "checks": rows,
    }
    path = settings.data_dir / "reports" / "live_parity.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, default=str))
    return report

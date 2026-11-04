"""Copy-trade backtest: what you'd have made copying a pump.fun wallet a little late.

People copy wallets they see on pump.fun's leaderboard. This answers the question that matters to
them: if I'd bought a while after this wallet bought, and sold a while after it sold, what would
I have made? It reports numbers, not a judgment.

For a wallet (a pump.fun profile link or its address):
1. Its recent pump.fun trades, newest first, from Helius: bonding curve and PumpSwap.
2. Its latest closed positions (50 by default, up to 100): tokens it bought and then sold down to
   under CLOSED_LEFT of what it bought, with the first buy inside the history read. The history is
   read back until that many have closed. Tokens priced in something other than SOL are left out
   and counted.
3. The copy: the same SOL per position, spread over its buys as it spread them, each buy
   `buy_delay` seconds after its buy; the same share of holdings sold at each of its sells,
   `sell_delay` seconds after. Anything still held after the last copied sell is sold then.
4. Prices: the token's own trades, the last fill before each moment (in market cap, SOL). Fees:
   what that token's trades paid. Your own price impact isn't modeled.

Per position it also keeps the after-effect: how far the price moved in the `buy_delay` after the
wallet's first buy, and in the `sell_delay` after its last sell.

    uv run python -m receipts copy-trade <wallet or profile link> --buy-after 300 --sell-after 600
"""

import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from receipts.crypto import copycats, events, helius, programs, transactions

WALLET_PAGES = 50  # read back up to 5,000 of the wallet's latest transactions, until enough positions close
PRICE_PAGES = 10  # up to 1,000 of a token's transactions around each position
POSITIONS = 50  # the latest closed positions copied, by default
MAX_POSITIONS = 100
WORKERS = 8  # tokens priced at once; the Helius client spaces the requests
# A wallet's positions and price paths are kept this long, so trying another timing or fewer positions
# reuses what was read instead of reading it again (unless the new timing reaches past it).
REUSE_SECONDS = 1800
_pulled: dict[str, dict] = {}
_pulled_lock = threading.Lock()
CLOSED_LEFT = 0.05
SIZE_SOL = 1.0  # what the copier puts into each position
PROFILE = re.compile(r"(?:pump\.fun/(?:profile|coin)/)?([1-9A-HJ-NP-Za-km-z]{32,44})")
SOL_QUOTES = (programs.WSOL, programs.NATIVE_SOL_QUOTE)
MCAP = 1e6  # quote lamports per raw token unit -> market cap in SOL (1B tokens, 6 decimals; 9 for SOL)


def wallet_from(text: str) -> str | None:
    m = PROFILE.search(text or "")
    return m.group(1) if m else None


@dataclass
class Fill:
    t: int
    slot: int
    index: int
    is_buy: bool
    tokens: float  # raw units
    sol: float  # lamports through the curve or pool, before fees
    fee: float

    @property
    def mcap(self) -> float:
        """The fill's price as a market cap; NaN for a fill that moved no SOL (dust, or tokens given away)."""
        return self.sol / self.tokens * MCAP if self.tokens > 0 and self.sol > 0 else math.nan

    @property
    def priced(self) -> bool:
        return not math.isnan(self.mcap)


@dataclass
class Position:
    mint: str
    fills: list[Fill] = field(default_factory=list)  # the wallet's own trades in this token, in order
    name: str | None = None
    symbol: str | None = None


def _mint_of(tx: dict, wallet: str, rec: events.Trade) -> str | None:
    """PumpSwap events name the pool, not the token: read the token from the wallet's balances."""
    if rec.mint:
        return rec.mint
    for b in (tx["meta"].get("postTokenBalances") or []) + (tx["meta"].get("preTokenBalances") or []):
        if b.get("owner") == wallet and b.get("mint") not in (programs.WSOL, rec.quote_mint):
            return b["mint"]
    return None


def _fills(txs: list[dict], mint: str | None = None, wallet: str | None = None) -> dict[str, list[Fill]]:
    """SOL-priced trades in these transactions, by token: all of a token's, or one wallet's."""
    out: dict[str, list[Fill]] = {}
    for tx in txs:
        for r in transactions.records(tx):
            if not isinstance(r, events.Trade) or r.quote_mint not in SOL_QUOTES or not r.token_amount:
                continue
            if wallet and r.wallet != wallet:
                continue
            m = _mint_of(tx, r.wallet, r) if r.venue == "pumpswap" else r.mint
            if mint and m != mint and not (r.venue == "pumpswap" and m is None):
                continue
            m = m or mint
            if m:
                out.setdefault(m, []).append(Fill(r.ctx.block_time, r.ctx.slot, r.ctx.index, r.is_buy,
                                                  float(r.token_amount), float(r.quote_amount), float(r.fee)))
    for fs in out.values():
        fs.sort(key=lambda f: (f.slot, f.index))
    return out


class Prices:
    """A token's market cap at any moment: the last fill at or before it."""

    def __init__(self, fills: list[Fill]):
        self.fills = [f for f in fills if f.priced]
        self.times = [f.t for f in self.fills]

    def at(self, t: float) -> float | None:
        import bisect

        i = bisect.bisect_right(self.times, t) - 1
        return self.fills[i].mcap if i >= 0 else None

    def fee_rate(self) -> float:
        rates = sorted(f.fee / f.sol for f in self.fills if f.sol > 0)
        return rates[len(rates) // 2] if rates else 0.0125


def copy_result(p: Position, prices: Prices, buy_delay: int, sell_delay: int, size_sol: float = SIZE_SOL) -> dict:
    """The copier's trades and result for one position."""
    fee = prices.fee_rate()
    spent_total = sum(f.sol for f in p.fills if f.is_buy) or 1.0
    held_by_wallet = 0.0
    # (time, kind, amount, price): SOL to spend on a buy, or the share of holdings to sell. Times are
    # whole seconds, so with no delay the copy fills at the wallet's own price, not the second's last.
    plan = []
    for f in p.fills:
        if f.is_buy:
            held_by_wallet += f.tokens
            plan.append((f.t + buy_delay, "buy", size_sol * f.sol / spent_total, f.mcap if buy_delay == 0 and f.priced else None))
        else:
            share = min(1.0, f.tokens / held_by_wallet) if held_by_wallet > 0 else 1.0
            held_by_wallet = max(0.0, held_by_wallet - f.tokens)
            plan.append((f.t + sell_delay, "sell", share, f.mcap if sell_delay == 0 and f.priced else None))
    plan.sort(key=lambda x: (x[0], x[1] == "sell"))
    held = spent = got = 0.0
    trades = []
    for t, kind, amount, own_price in plan:
        px = own_price or prices.at(t)
        if px is None:
            continue
        if kind == "buy":
            tokens = amount / (1 + fee) / px  # market-cap units: what matters is the ratio of prices
            held += tokens
            spent += amount
            trades.append({"t": t, "side": "buy", "mcap_sol": round(px, 3), "sol": round(amount, 6)})
        elif held > 0:
            sold = held * amount
            held -= sold
            got += sold * px * (1 - fee)
            trades.append({"t": t, "side": "sell", "mcap_sol": round(px, 3), "sol": round(sold * px * (1 - fee), 6)})
    if held > 1e-12 and plan:  # still holding after the last copied sell: sold then
        t = plan[-1][0]
        px = prices.at(t)
        got += held * px * (1 - fee)
        trades.append({"t": t, "side": "sell", "mcap_sol": round(px, 3), "sol": round(held * px * (1 - fee), 6), "rest": True})
    pnl = got - spent
    return {"spent_sol": round(spent, 6), "got_sol": round(got, 6), "pnl_sol": round(pnl, 6),
            "pnl_pct": round(pnl / spent, 4) if spent else None, "fee_rate": round(fee, 4), "trades": trades}


def wallet_result(p: Position) -> dict:
    spent = sum(f.sol + f.fee for f in p.fills if f.is_buy)
    got = sum(f.sol - f.fee for f in p.fills if not f.is_buy)
    return {"spent_sol": round(spent / 1e9, 4), "got_sol": round(got / 1e9, 4), "pnl_sol": round((got - spent) / 1e9, 4),
            "pnl_pct": round((got - spent) / spent, 4) if spent else None}


class CopyTrade:
    def __init__(self, wallet: str, buy_delay: int, sell_delay: int, size_sol: float = SIZE_SOL,
                 client: helius.Helius | None = None, progress=None, positions: int = POSITIONS):
        self.h = client or helius.Helius()
        self.wallet = wallet
        self.buy_delay, self.sell_delay, self.size_sol = int(buy_delay), int(sell_delay), size_sol
        self.wanted = max(1, min(MAX_POSITIONS, int(positions)))
        self.history = {"transactions": 0, "from_ts": None, "to_ts": None, "complete": False}
        self.reused = False  # True when the wallet's data came from an earlier run (REUSE_SECONDS)
        self.progress = progress or (lambda **kv: None)
        self.credits_start = self.h.spent_this_month()
        self.skipped = {"still_open": 0, "bought_before_history": 0, "not_sol_priced": 0, "no_prices": 0}

    def positions(self) -> list[Position]:
        """The latest `wanted` closed positions, reading the wallet's history back a page at a time
        until that many have closed (or WALLET_PAGES run out)."""
        now = int(time.time())
        own: dict[str, list[Fill]] = {}
        other: set[str] = set()  # tokens it traded priced in something other than SOL
        for page, done in self.h.history(self.wallet, gte=0, lte=now, order="desc", max_pages=WALLET_PAGES):
            for mint, fs in _fills(page, wallet=self.wallet).items():
                own.setdefault(mint, []).extend(fs)
            other |= {r.mint for tx in page for r in transactions.records(tx)
                      if isinstance(r, events.Trade) and r.wallet == self.wallet and r.quote_mint not in SOL_QUOTES}
            if page:
                self.history["to_ts"] = self.history["to_ts"] or page[0]["blockTime"]
                self.history["from_ts"] = page[-1]["blockTime"]
                self.history["transactions"] += len(page)
            self.history["complete"] = done
            closed = self._closed(own)
            self.progress(step="wallet", transactions=self.history["transactions"], positions=min(len(closed), self.wanted))
            if len(closed) >= self.wanted:
                break
        self.skipped = {"still_open": 0, "bought_before_history": 0, "not_sol_priced": len(other - set(own)), "no_prices": 0}
        out = self._closed(own, count=True)
        out.sort(key=lambda p: p.fills[-1].t, reverse=True)
        return out[:self.wanted]

    def _closed(self, own: dict[str, list[Fill]], count: bool = False) -> list[Position]:
        out = []
        for mint, fills in own.items():
            fills = sorted(fills, key=lambda f: (f.slot, f.index))
            bought = sum(f.tokens for f in fills if f.is_buy)
            sold = sum(f.tokens for f in fills if not f.is_buy)
            if not fills[0].is_buy:
                if count:
                    self.skipped["bought_before_history"] += 1
            elif sold < (1 - CLOSED_LEFT) * bought:
                if count:
                    self.skipped["still_open"] += 1
            else:
                out.append(Position(mint, fills))
        return out

    def prices(self, p: Position, extra: int) -> Prices:
        start = p.fills[0].t - 5
        end = p.fills[-1].t + extra + 5
        txs: list[dict] = []
        for page, done in self.h.history(p.mint, gte=start, lte=end, order="asc", max_pages=PRICE_PAGES):
            txs += page
        fills = _fills(txs, mint=p.mint).get(p.mint, [])
        if fills and fills[-1].t < end - 5:  # the window ran past the page cap: read its end directly
            for page, _ in self.h.history(p.mint, gte=end - 600, lte=end, order="desc", max_pages=1):
                fills += _fills(page, mint=p.mint).get(p.mint, [])
            fills.sort(key=lambda f: (f.slot, f.index))
        return Prices(fills)

    def name(self, p: Position) -> None:
        try:
            asset = self.h.rpc("getAsset", [p.mint])
            meta = ((asset or {}).get("content") or {}).get("metadata") or {}
            p.name, p.symbol = copycats.clean_name(meta.get("name")), copycats.clean_name(meta.get("symbol"))
        except helius.HeliusError:
            pass

    def run(self) -> dict:
        extra = max(self.buy_delay, self.sell_delay)
        with _pulled_lock:
            kept = _pulled.get(self.wallet)
        if kept and time.time() - kept["at"] < REUSE_SECONDS and kept["wanted"] >= self.wanted and kept["extra"] >= extra:
            ps, priced = kept["positions"][:self.wanted], kept["prices"][:self.wanted]
            self.history, self.skipped = dict(kept["history"]), dict(kept["skipped"])
            self.reused = True
            self.progress(step="reused", positions=len(ps))
        else:
            ps = self.positions()

            def price(p):
                self.name(p)
                return self.prices(p, extra)

            priced = []
            with ThreadPoolExecutor(WORKERS) as pool:
                for i, prices in enumerate(pool.map(price, ps)):
                    priced.append(prices)
                    self.progress(step="positions", done=i + 1, of=len(ps))
            with _pulled_lock:
                _pulled[self.wallet] = {"at": time.time(), "wanted": self.wanted, "extra": extra, "positions": ps,
                                        "prices": priced, "history": dict(self.history), "skipped": dict(self.skipped)}
        rows = []
        for p, prices in zip(ps, priced):
            rows += self.row(p, prices)
        return self.summary(rows)

    def row(self, p: Position, prices: Prices) -> list[dict]:
        if not prices.fills:
            self.skipped["no_prices"] += 1
            return []
        first_buy = next(f for f in p.fills if f.is_buy)
        last_sell = [f for f in p.fills if not f.is_buy][-1]
        def price(f: Fill) -> float | None:
            """A fill that moved no SOL has no price of its own: use the market's at that moment."""
            return f.mcap if f.priced else prices.at(f.t)

        at_buy, at_sell = price(first_buy), price(last_sell)
        after_buy = prices.at(first_buy.t + self.buy_delay) if at_buy else None
        after_sell = prices.at(last_sell.t + self.sell_delay) if at_sell else None
        fills = [(f, price(f)) for f in p.fills]
        return [{
            "mint": p.mint, "name": p.name, "symbol": p.symbol,
            "first_buy_ts": first_buy.t, "last_sell_ts": last_sell.t, "held_s": last_sell.t - first_buy.t,
            "buys": sum(f.is_buy for f in p.fills), "sells": sum(not f.is_buy for f in p.fills),
            "wallet": wallet_result(p),
            "you": copy_result(p, prices, self.buy_delay, self.sell_delay, self.size_sol),
            "after_buy": {"mcap_at_buy": at_buy and round(at_buy, 3), "mcap_after": None if after_buy is None else round(after_buy, 3),
                          "change": None if after_buy is None else round(after_buy / at_buy - 1, 4)},
            "after_sell": {"mcap_at_sell": at_sell and round(at_sell, 3), "mcap_after": None if after_sell is None else round(after_sell, 3),
                           "change": None if after_sell is None else round(after_sell / at_sell - 1, 4)},
            "price_path": [{"t": f.t, "mcap_sol": round(f.mcap, 3)} for f in prices.fills[:: max(1, len(prices.fills) // 120)]],
            "wallet_fills": [{"t": f.t, "side": "buy" if f.is_buy else "sell", "mcap_sol": round(px, 3),
                              "sol": round((f.sol + (f.fee if f.is_buy else -f.fee)) / 1e9, 4)} for f, px in fills if px],
        }]

    def summary(self, rows: list[dict]) -> dict:
        w_spent = sum(r["wallet"]["spent_sol"] for r in rows)
        w_pnl = sum(r["wallet"]["pnl_sol"] for r in rows)
        y_spent = sum(r["you"]["spent_sol"] for r in rows)
        y_pnl = sum(r["you"]["pnl_sol"] for r in rows)
        return {
            "wallet": self.wallet, "buy_after_s": self.buy_delay, "sell_after_s": self.sell_delay, "size_sol": self.size_sol,
            "positions": len(rows), "positions_wanted": self.wanted, "skipped": self.skipped, "reused_data": self.reused,
            # what the run is based on: how far back the wallet's history was read
            "history": self.history | {"hours": round((self.history["to_ts"] - self.history["from_ts"]) / 3600, 1)
                                       if self.history["from_ts"] else None},
            "wallet_total": {"spent_sol": round(w_spent, 4), "pnl_sol": round(w_pnl, 4), "pnl_pct": round(w_pnl / w_spent, 4) if w_spent else None,
                             "won": sum(r["wallet"]["pnl_sol"] > 0 for r in rows)},
            "you_total": {"spent_sol": round(y_spent, 4), "pnl_sol": round(y_pnl, 4), "pnl_pct": round(y_pnl / y_spent, 4) if y_spent else None,
                          "won": sum(r["you"]["pnl_sol"] > 0 for r in rows)},
            "rows": rows,
            "notes": ["Your own price impact isn't modeled.", "Fees are what each token's trades paid.",
                      "Only tokens priced in SOL, and positions the wallet opened and closed inside the history read."],
            "helius_credits": self.h.spent_this_month() - self.credits_start,
        }


def copy_trade(wallet: str, buy_delay: int, sell_delay: int, size_sol: float = SIZE_SOL, progress=None,
               positions: int = POSITIONS) -> dict:
    return CopyTrade(wallet, buy_delay, sell_delay, size_sol, progress=progress, positions=positions).run()

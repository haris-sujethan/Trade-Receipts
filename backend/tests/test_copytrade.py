"""The copy-trade backtest's arithmetic, on made-up fills (no network)."""

import pytest

from receipts.crypto import copytrade
from receipts.crypto.copytrade import Fill, Position, Prices

LAMPORTS = 1e9


def fill(t, is_buy, mcap, sol=1.0):
    # a fill at this market cap (SOL): tokens = SOL / mcap of the supply, in raw units
    tokens = sol / mcap * 1e15
    return Fill(t, t, 0, is_buy, tokens, sol * LAMPORTS, 0.0)


def test_with_no_delay_the_copy_matches_the_wallet():
    p = Position("M", [fill(0, True, 100), fill(10, False, 200, sol=2.0)])
    prices = Prices(p.fills + [fill(5, True, 150)])
    you = copytrade.copy_result(p, prices, 0, 0)
    assert you["pnl_pct"] == pytest.approx(1.0)  # bought at 100, sold at 200, no fees in these fills
    assert copytrade.wallet_result(p)["pnl_pct"] == pytest.approx(1.0)


def test_copying_late_fills_at_the_later_prices():
    p = Position("M", [fill(0, True, 100), fill(10, False, 200, sol=2.0)])
    prices = Prices(p.fills + [fill(5, True, 150), fill(14, False, 120)])
    you = copytrade.copy_result(p, prices, 5, 5)  # buys at 150 (t=5), sells at 120 (t=15)
    assert you["pnl_pct"] == pytest.approx(120 / 150 - 1)


def test_partial_sells_are_copied_as_shares_of_holdings():
    p = Position("M", [fill(0, True, 100, sol=2.0), fill(10, False, 200, sol=2.0), fill(20, False, 50, sol=0.5)])
    you = copytrade.copy_result(p, Prices(p.fills), 0, 0)
    # half sold at 2x, half at 0.5x: 1.0 + 0.25 back on 1 SOL
    assert you["got_sol"] == pytest.approx(1.25)


def test_profile_links_and_addresses():
    w = "GeUnv1jmtviRbR7Gu1JnXSGkUMUgFVBHuEVQVpTaUX1W"
    assert copytrade.wallet_from(f"https://pump.fun/profile/{w}") == w
    assert copytrade.wallet_from(w) == w
    assert copytrade.wallet_from("no address here") is None

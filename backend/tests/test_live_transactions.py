"""Decode recent mainnet transactions from the public Solana RPC (no key needed)."""

import time

import httpx
import pytest

from receipts.crypto import events, programs, transactions

RPC = "https://api.mainnet-beta.solana.com"
pytestmark = pytest.mark.network


def rpc(method: str, params: list):
    for _ in range(6):
        reply = httpx.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=30)
        body = reply.json() if reply.status_code == 200 else {}
        if "result" in body:
            return body["result"]
        time.sleep(2)
    pytest.skip(f"public RPC unavailable for {method}")


def recent_records(program_id: str, n: int) -> list[events.Record]:
    signatures = [s["signature"] for s in rpc("getSignaturesForAddress", [program_id, {"limit": 100}]) if s["err"] is None]
    out = []
    for signature in signatures[:n]:
        tx = rpc("getTransaction", [signature, {"encoding": "json", "maxSupportedTransactionVersion": 1}])
        if tx:
            out += transactions.records(tx)
        time.sleep(0.2)
    return out


def test_curve_trades_keep_the_constant_product():
    trades = [r for r in recent_records(programs.PUMP, 15) if isinstance(r, events.Trade) and r.venue == "curve"]
    assert trades, "no bonding-curve trades decoded"
    checked = 0
    for t in trades:
        # Mayhem mode curves have their virtual reserves reset between trades.
        if t.mayhem_mode or t.quote_mint != programs.WSOL or t.token_amount == 0 or t.quote_amount == 0:
            continue
        checked += 1
        sign = 1 if t.is_buy else -1
        before = (t.quote_reserves - sign * t.quote_amount) * (t.token_reserves + sign * t.token_amount)
        after = t.quote_reserves * t.token_reserves
        assert after == pytest.approx(before, rel=1e-6), t
    assert checked, "no ordinary SOL-quoted curve trades to check"


def test_pumpswap_trades_decode():
    trades = [r for r in recent_records(programs.PUMP_AMM, 10) if isinstance(r, events.Trade)]
    assert trades and all(t.venue == "pumpswap" and t.pool and t.token_reserves >= 0 for t in trades)

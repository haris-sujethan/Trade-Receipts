"""The wallet history table, built from a tiny hand-made pull."""

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from receipts.crypto import history, store


def write(root, kind: str, rows: list[dict]) -> None:
    path = root / kind / "2026-05-11"
    path.mkdir(parents=True)
    pq.write_table(pa.Table.from_pylist(rows), path / "part-0000.parquet")


def trade(wallet, *, is_buy, venue="curve", mint="MINT", pool=None, t=100, tokens=1000, quote=50):
    return {"venue": venue, "mint": mint if venue == "curve" else None, "pool": pool, "wallet": wallet,
            "is_buy": is_buy, "token_amount": tokens, "quote_amount": quote, "block_time": t}


@pytest.fixture
def built(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "ROOT", tmp_path)
    monkeypatch.setattr(history, "PATH", tmp_path / "wallet_history.parquet")
    write(tmp_path, "launches", [{"mint": "MINT", "creator": "CREATOR", "block_time": 90}])
    write(tmp_path, "trades", [
        trade("CREATOR", is_buy=True, t=90),
        trade("ALICE", is_buy=True, t=100),
        trade("ALICE", is_buy=True, t=110, tokens=500, quote=30),
        trade("ALICE", is_buy=False, venue="pumpswap", pool="POOL", t=500, tokens=1500, quote=200),
        trade("BOB", is_buy=True, venue="pumpswap", pool="OTHER", t=600),  # a pool we can't place
    ])
    write(tmp_path, "migrations", [{"mint": "MINT", "pool": "POOL"}])
    write(tmp_path, "pools", [{"pool": "POOL", "base_mint": "MINT"}])
    counts = history.build()
    rows = {r["wallet"]: r for r in pq.read_table(history.PATH).to_pylist()}
    return counts, rows


def test_creator_and_trader_rows(built):
    counts, rows = built
    assert counts == {"rows": 2, "wallets": 2, "tokens": 1, "tokens_launched_outside_pull": 0}
    creator, alice = rows["CREATOR"], rows["ALICE"]
    assert creator["is_creator"] and creator["buys"] == 1 and creator["first_ts"] == 90
    assert not alice["is_creator"]
    assert (alice["buys"], alice["sells"]) == (2, 1)
    assert (alice["tokens_bought"], alice["tokens_sold"]) == (1500, 1500)
    assert (alice["quote_spent"], alice["quote_received"]) == (80, 200)
    assert alice["traded_after_graduation"] and (alice["first_ts"], alice["last_ts"]) == (100, 500)
    assert alice["launched_ts"] == 90


def test_trades_in_unknown_pools_are_left_out(built):
    _, rows = built
    assert "BOB" not in rows

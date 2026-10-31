import hashlib

import pytest

from receipts.crypto import events, idl, programs
from receipts.crypto.borsh import Truncated

MINT = "4aG7WqXQJEPA3DSfhQnfhfs9LFkjf4hEBTE537U9pump"
WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
POOL = "GzAciVeYU1McB97d2R36JSysrGkBVYWH86vYSxxKdupo"
CTX = events.Context(signature="sig", slot=1, block_time=1_790_000_000, index=0)


def event_data(program_id: str, name: str, values: dict) -> bytes:
    spec = idl.load(program_id)
    return events.EVENT_IX_TAG + spec.event_discriminators[name] + spec.encode_struct(name, values)


def test_discriminators_match_anchor():
    assert hashlib.sha256(b"anchor:event").digest()[:8][::-1] == events.EVENT_IX_TAG
    for program_id in (programs.PUMP, programs.PUMP_AMM):
        for name, disc in idl.load(program_id).event_discriminators.items():
            assert hashlib.sha256(f"event:{name}".encode()).digest()[:8] == disc, name


OLD_TRADE = {  # TradeEvent as it was before quote mints were added
    "mint": MINT, "sol_amount": 556_471_485, "token_amount": 10_619_683_203_006, "is_buy": True,
    "user": WALLET, "timestamp": 1_790_000_000,
    "virtual_sol_reserves": 41_349_316_464, "virtual_token_reserves": 778_489_289_940_893,
    "real_sol_reserves": 11_349_316_464, "real_token_reserves": 498_589_289_940_893,
    "fee_recipient": WALLET, "fee_basis_points": 95, "fee": 5_286_479,
    "creator": WALLET, "creator_fee_basis_points": 30, "creator_fee": 1_669_414,
}


def test_old_shorter_event_leaves_new_fields_empty():
    trade = events.decode(programs.PUMP, event_data(programs.PUMP, "TradeEvent", OLD_TRADE), CTX)
    assert isinstance(trade, events.Trade)
    assert trade.venue == "curve" and trade.mint == MINT and trade.is_buy
    assert trade.quote_mint == programs.WSOL  # no quote mint yet means SOL
    assert trade.quote_amount == 556_471_485
    assert trade.fee == 5_286_479 + 1_669_414
    assert trade.ix_name is None


def test_curve_price_is_sol_per_token_after_the_trade():
    trade = events.decode(programs.PUMP, event_data(programs.PUMP, "TradeEvent", OLD_TRADE), CTX)
    expected = (41_349_316_464 / 1e9) / (778_489_289_940_893 / 1e6)
    assert trade.price(9) == pytest.approx(expected)


def test_native_sol_quote_is_normalized_to_wsol():
    values = OLD_TRADE | {
        "track_volume": False, "total_unclaimed_tokens": 0, "total_claimed_tokens": 0,
        "current_sol_volume": 0, "last_update_timestamp": 0, "ix_name": "buy", "mayhem_mode": False,
        "cashback_fee_basis_points": 0, "cashback": 0, "buyback_fee_basis_points": 0, "buyback_fee": 0,
        "shareholders": [], "quote_mint": programs.NATIVE_SOL_QUOTE, "quote_amount": 556_471_485,
        "virtual_quote_reserves": 41_349_316_464,
    }
    trade = events.decode(programs.PUMP, event_data(programs.PUMP, "TradeEvent", values), CTX)
    assert trade.quote_mint == programs.WSOL and trade.ix_name == "buy"


def test_cut_off_inside_a_field_raises():
    data = event_data(programs.PUMP, "TradeEvent", OLD_TRADE)
    with pytest.raises(Truncated):
        events.decode(programs.PUMP, data[:-3], CTX)


def test_pumpswap_reserves_move_to_after_the_trade():
    spec = idl.load(programs.PUMP_AMM)
    fields = [f["name"] for f in spec.types["BuyEvent"]["fields"]]
    values = dict.fromkeys(fields, 0) | {
        "base_amount_out": 1_239_706_306_712, "quote_amount_in": 1_635_900_000,
        "pool_base_token_reserves": 119_530_971_068_747, "pool_quote_token_reserves": 139_021_117_971,
        "virtual_quote_reserves": 15_223_530_199, "lp_fee": 10, "protocol_fee": 20, "coin_creator_fee": 5,
        "pool": POOL, "user": WALLET, "user_base_token_account": WALLET, "user_quote_token_account": WALLET,
        "protocol_fee_recipient": WALLET, "protocol_fee_recipient_token_account": WALLET,
        "coin_creator": WALLET, "track_volume": False, "can_boost": False, "ix_name": "buy_v2",
    }
    trade = events.decode(programs.PUMP_AMM, event_data(programs.PUMP_AMM, "BuyEvent", values), CTX)
    assert trade.venue == "pumpswap" and trade.pool == POOL and trade.mint is None and trade.is_buy
    assert trade.token_reserves == 119_530_971_068_747 - 1_239_706_306_712
    assert trade.quote_reserves == 139_021_117_971 + 1_635_900_000 + 15_223_530_199
    assert trade.fee == 35


def test_non_event_data_is_ignored():
    assert events.decode(programs.PUMP, bytes(24), CTX) is None
    assert events.decode(programs.SYSTEM, events.EVENT_IX_TAG + bytes(16), CTX) is None

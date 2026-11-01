"""The reserve chain: failed trades fall off it, and it recovers trade order inside a slot."""

import numpy as np

from receipts.crypto import chain, programs

START = programs.CURVE_START_TOKENS


def _trades(steps):
    """steps: (slot, is_buy, amount, pre). Returns arrays for chain.verify."""
    slot = np.array([s[0] for s in steps])
    is_buy = np.array([s[1] for s in steps])
    amount = np.array([s[2] for s in steps], dtype=np.int64)
    pre = np.array([s[3] for s in steps], dtype=np.int64)
    post = np.where(is_buy, pre - amount, pre + amount)
    return is_buy, amount, post, slot


def test_failed_trade_is_dropped():
    s1 = START - 100
    is_buy, amount, post, slot = _trades([
        (1, True, 100, START),     # ok
        (2, True, 50, s1),         # failed: same start state as the next trade, leads nowhere
        (2, True, 30, s1),         # ok
        (3, False, 10, s1 - 30),   # ok
    ])
    ok, _ = chain.verify(is_buy, amount, post, slot)
    assert ok.tolist() == [True, False, True, True]


def test_failed_transaction_with_several_trades_is_dropped():
    s1 = START - 100
    is_buy, amount, post, slot = _trades([
        (1, True, 100, START),
        (2, True, 40, s1),         # a failed bundle: two trades that chain to each other...
        (2, True, 25, s1 - 40),    # ...then dead-end
        (2, True, 10, s1),         # the real next trade
        (3, True, 5, s1 - 10),
        (4, False, 3, s1 - 15),
    ])
    ok, _ = chain.verify(is_buy, amount, post, slot)
    assert ok.tolist() == [True, False, False, True, True, True]


def test_order_inside_a_slot_comes_from_the_chain():
    s1 = START - 100
    # All in one slot, listed out of order.
    is_buy, amount, post, slot = _trades([
        (5, True, 7, s1 - 20),
        (5, True, 100, START),
        (5, True, 20, s1),
    ])
    ok, seq = chain.verify(is_buy, amount, post, slot)
    assert ok.all()
    assert seq.tolist() == [2, 0, 1]


def test_gap_in_the_data_starts_a_new_chain():
    s1 = START - 100
    is_buy, amount, post, slot = _trades([
        (1, True, 100, START),
        (2, True, 10, s1),
        (9, True, 10, s1 - 500),   # trades in between are missing; this one starts a new chain
        (10, False, 4, s1 - 510),
    ])
    ok, _ = chain.verify(is_buy, amount, post, slot)
    assert ok.all()


def test_round_trip_on_the_curve_stays_on_chain():
    s1 = START - 100
    is_buy, amount, post, slot = _trades([
        (1, True, 100, START),
        (2, True, 30, s1),
        (2, False, 30, s1 - 30),   # back to s1 exactly
        (3, True, 5, s1),
    ])
    ok, _ = chain.verify(is_buy, amount, post, slot)
    assert ok.all()

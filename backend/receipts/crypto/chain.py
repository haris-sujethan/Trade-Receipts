"""Drop failed trades and recover trade order, from the reserves each trade reports.

BigQuery's Instructions table has no transaction status, and it includes failed transactions:
their pump.fun events were emitted before the transaction reverted (checked against Helius,
Oct 31: about 1 in 60 sampled trades had failed, and some tokens show failed creates). Reading
status from BigQuery's Transactions table would scan about 400 GiB a day, so failures are found
from the reserves instead.

Every trade reports the curve's or pool's token reserves after it, and its token amount gives
the reserves before it. Successful trades chain: each starts where the one before it ended. A
failed trade starts from a real state but leads nowhere, so it's left off the chain. The chain
also gives the order of trades inside one slot, which the events don't.

Checked against Helius on Sep 15 curve trades: 49 of 50 trades left off the chain had failed,
and 50 of 50 on it had succeeded; about 1% of curve trades are failed.

Not chained (kept and marked unverified): Mayhem mode curves, which reset their virtual reserves
between trades, and PumpSwap pools. In a pool, an arbitrage bot's buy and sell of the same amount
returns the token reserves to where they started, so failed round trips loop back onto the real
chain; separating them needs the pool's quote reserves too.
"""

from collections import defaultdict

import numpy as np

from receipts.crypto import programs


def chain(pre: np.ndarray, post: np.ndarray, slot: np.ndarray) -> np.ndarray:
    """Positions of the trades on the chain, in chain order. Trades must be sorted by slot.

    `pre` and `post` are the token reserves before and after each trade. Where the chain forks,
    it follows the branch that goes furthest: a failed transaction can hold several trades that
    chain among themselves before dead-ending, so looking one step ahead isn't enough.
    """
    n = len(pre)
    by_pre: dict[int, list[int]] = defaultdict(list)
    first_made: dict[int, int] = {}
    for i in range(n):
        by_pre[int(pre[i])].append(i)
        first_made.setdefault(int(post[i]), int(slot[i]))

    def succ(i: int) -> list[int]:
        return [j for j in by_pre.get(int(post[i]), ()) if j != i and slot[j] >= slot[i]]

    # How many trades each trade can lead to (the longest path from it). Iterative, since chains
    # run to 100k trades; a state revisited inside one slot is cut off rather than followed.
    reach = np.zeros(n, np.int64)
    state = np.zeros(n, np.int8)  # 0 new, 1 on the stack, 2 done
    for root in range(n - 1, -1, -1):
        if state[root]:
            continue
        state[root] = 1
        stack = [(root, iter(succ(root)))]
        while stack:
            i, it = stack[-1]
            j = next(it, None)
            if j is None:
                reach[i] = 1 + max((reach[k] for k in succ(i) if state[k] == 2), default=0)
                state[i] = 2
                stack.pop()
            elif state[j] == 0:
                state[j] = 1
                stack.append((j, iter(succ(j))))

    def is_head(i: int) -> bool:
        p = int(pre[i])
        return p == programs.CURVE_START_TOKENS or first_made.get(p, np.iinfo(np.int64).max) > slot[i]

    used = np.zeros(n, bool)
    order: list[int] = []
    head = 0  # trades before this are used or can never start a chain
    cur, last = None, -1
    while True:
        cands = [] if cur is None else [i for i in by_pre.get(cur, ()) if not used[i] and slot[i] >= last]
        if not cands:
            while head < n and (used[head] or slot[head] < last or not is_head(head)):
                head += 1
            if head == n:
                break
            # Heads in the first slot left; a token launched inside the data starts from the curve's first state.
            cands = []
            i = head
            while i < n and slot[i] == slot[head]:
                if not used[i] and is_head(i):
                    cands.append(i)
                i += 1
            starts = [i for i in cands if int(pre[i]) == programs.CURVE_START_TOKENS]
            cands = starts or cands
        pick = max(cands, key=lambda i: (reach[i], -slot[i], -i))
        used[pick] = True
        order.append(pick)
        cur, last = int(post[pick]), int(slot[pick])
    return np.array(order, dtype=np.int64)


def verify(is_buy: np.ndarray, token_amount: np.ndarray, token_reserves: np.ndarray, slot: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(ok, seq) for one curve's or pool's trades sorted by slot: whether each is on the chain,
    and its position in trade order (off-chain trades keep their place after the trade before)."""
    post = token_reserves.astype(np.int64)
    amount = token_amount.astype(np.int64)
    pre = np.where(is_buy, post + amount, post - amount)
    order = chain(pre, post, slot)
    ok = np.zeros(len(pre), bool)
    ok[order] = True
    seq = np.empty(len(pre), np.float64)
    seq[order] = np.arange(len(order))
    # Off-chain trades sit just after the last chain trade at or before their slot.
    if len(order) < len(pre):
        chain_slots = slot[order]
        for i in np.flatnonzero(~ok):
            k = int(np.searchsorted(chain_slots, slot[i], side="right"))
            seq[i] = k - 0.5
    return ok, seq

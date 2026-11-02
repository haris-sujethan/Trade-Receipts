"""Records from a transaction in the Solana RPC's `json` encoding (as Helius returns it too).

Live scoring reads transactions this way; the BigQuery pull feeds the same `events.decode`.
"""

import base58

from receipts.crypto import events, programs

SYSTEM_TRANSFER = 2  # the System program's Transfer instruction (u32 tag, then u64 lamports)


def account_keys(tx: dict) -> list[str]:
    """Static keys followed by keys loaded from address lookup tables, in index order."""
    loaded = tx["meta"].get("loadedAddresses") or {}
    return tx["transaction"]["message"]["accountKeys"] + loaded.get("writable", []) + loaded.get("readonly", [])


def records(tx: dict) -> list[events.Record]:
    """Every launch, trade, graduation, migration and pool event in a successful transaction."""
    if tx["meta"].get("err") is not None:
        return []
    keys = account_keys(tx)
    signature = tx["transaction"]["signatures"][0]
    out: list[events.Record] = []
    for group in sorted(tx["meta"].get("innerInstructions") or [], key=lambda g: g["index"]):
        # BigQuery's `index` for an inner instruction is its position in its parent's list, and
        # training orders a slot's trades by it, so live scoring numbers events the same way.
        for index, ix in enumerate(group["instructions"]):
            ctx = events.Context(signature=signature, slot=tx["slot"], block_time=tx["blockTime"], index=index)
            record = events.decode(keys[ix["programIdIndex"]], base58.b58decode(ix["data"]), ctx)
            if record is not None:
                out.append(record)
    return out


def sol_transfers(tx: dict) -> list[tuple[int, str, str, int]]:
    """(ts, source, destination, lamports) for every System program transfer in a successful
    transaction, top level and inner, as BigQuery's decoded `transfer` instructions give them."""
    if tx["meta"].get("err") is not None:
        return []
    keys = account_keys(tx)
    message = tx["transaction"]["message"]
    ixs = list(message["instructions"])
    for group in tx["meta"].get("innerInstructions") or []:
        ixs += group["instructions"]
    out = []
    for ix in ixs:
        if keys[ix["programIdIndex"]] != programs.SYSTEM or len(ix.get("accounts") or []) < 2:
            continue
        data = base58.b58decode(ix["data"])
        if len(data) != 12 or int.from_bytes(data[:4], "little") != SYSTEM_TRANSFER:
            continue
        src, dst = keys[ix["accounts"][0]], keys[ix["accounts"][1]]
        if src != dst:
            out.append((tx["blockTime"], src, dst, int.from_bytes(data[4:], "little")))
    return out

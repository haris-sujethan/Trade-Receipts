"""Records from a transaction in the Solana RPC's `json` encoding (as Helius returns it too).

Live scoring reads transactions this way; the BigQuery pull feeds the same `events.decode`.
"""

import base58

from receipts.crypto import events


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
    index = 0
    for group in sorted(tx["meta"].get("innerInstructions") or [], key=lambda g: g["index"]):
        for ix in group["instructions"]:
            ctx = events.Context(signature=signature, slot=tx["slot"], block_time=tx["blockTime"], index=index)
            index += 1
            record = events.decode(keys[ix["programIdIndex"]], base58.b58decode(ix["data"]), ctx)
            if record is not None:
                out.append(record)
    return out

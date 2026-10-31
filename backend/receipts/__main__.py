"""Command line: `uv run python -m receipts <command>` from backend/."""

import argparse
import json


def bq_check(_args) -> None:
    from receipts.crypto import bq_check

    bq_check.run()


def decode_tx(args) -> None:
    """Decode one transaction's pump.fun and PumpSwap events (Helius if keyed, else the public RPC)."""
    import dataclasses

    import httpx

    from receipts.config import settings
    from receipts.crypto import transactions

    if settings.helius_api_key:
        from receipts.crypto.helius import Helius

        tx = Helius().transaction(args.signature)
    else:
        reply = httpx.post(
            "https://api.mainnet-beta.solana.com",
            json={"jsonrpc": "2.0", "id": 1, "method": "getTransaction",
                  "params": [args.signature, {"encoding": "json", "maxSupportedTransactionVersion": 1}]},
            timeout=30,
        )
        tx = reply.json().get("result")
    if not tx:
        raise SystemExit("Transaction not found")
    for record in transactions.records(tx):
        print(type(record).__name__, json.dumps(dataclasses.asdict(record), default=str))


def helius_check(_args) -> None:
    from receipts.crypto.helius import Helius

    helius = Helius()
    slot = helius.rpc("getSlot", [], fresh=True)
    print(f"Helius key works. Current slot {slot:,}. Credits used this month: {helius.spent_this_month():,}")


def goplus(args) -> None:
    from receipts.crypto.goplus import CREDIT, GoPlus

    print(json.dumps(GoPlus().token_security(args.mint), indent=2))
    print(CREDIT)


def decode_day(args) -> None:
    import datetime as dt
    import time

    from receipts.crypto import store

    for day in args.days:
        started = time.time()
        counts = store.decode_day(dt.date.fromisoformat(day))
        print(day, counts, f"{time.time() - started:.0f}s")


def pull_block(args) -> None:
    from receipts.crypto import sample

    sample.pull_block(*sample.BLOCKS[args.block])


def pull_funding(args) -> None:
    from receipts.crypto import funding

    print(funding.pull_funding(*funding.BLOCKS[args.block]))


def wallet_history(_args) -> None:
    from receipts.crypto import history

    print(history.build())


def main() -> None:
    parser = argparse.ArgumentParser(prog="receipts")
    sub = parser.add_subparsers(required=True)
    sub.add_parser("bq-check", help="BigQuery Solana tables, coverage and cost").set_defaults(run=bq_check)
    p = sub.add_parser("decode-tx", help="decode one transaction's pump.fun and PumpSwap events")
    p.add_argument("signature")
    p.set_defaults(run=decode_tx)
    sub.add_parser("helius-check", help="check the Helius key (1 credit)").set_defaults(run=helius_check)
    p = sub.add_parser("decode-day", help="decode pulled days into launches, trades, graduations and pools")
    p.add_argument("days", nargs="+", help="YYYY-MM-DD")
    p.set_defaults(run=decode_day)
    p = sub.add_parser("pull-block", help="pull and decode a block of days from BigQuery")
    p.add_argument("block", choices=["may", "may-late", "aug", "sep"])
    p.set_defaults(run=pull_block)
    p = sub.add_parser("pull-funding", help="trace SOL funding for a block's wallets, two hops back")
    p.add_argument("block", choices=["may", "aug", "sep"])
    p.set_defaults(run=pull_funding)
    sub.add_parser("wallet-history", help="build the wallet history table from pulled data").set_defaults(run=wallet_history)
    p = sub.add_parser("goplus", help="GoPlus token security for a mint")
    p.add_argument("mint")
    p.set_defaults(run=goplus)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()

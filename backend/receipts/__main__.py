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


DATASET_STAGES = ("tokens", "trades", "edges", "wallets", "team", "labels", "reputation", "signals")


def build_dataset(args) -> None:
    """The rug check's dataset for a block: tokens through snapshots (SPEC.md 7.4–7.7)."""
    import time

    from receipts.crypto import dataset, labels, signals

    stages = args.stages or DATASET_STAGES
    for block in args.blocks:
        for stage in DATASET_STAGES:
            if stage not in stages:
                continue
            started = time.time()
            if stage in dataset.STEPS:
                result = dataset.prepare(block, (stage,))
            elif stage == "team":
                result = labels.build_team(block)
            elif stage == "labels":
                result = len(labels.build(block))
            elif stage == "reputation":
                result = dataset.reputation(block, signals.LABEL_HOURS)
            else:
                result = signals.build(block)
            print(f"{block} {stage}: {result} ({time.time() - started:.0f}s)", flush=True)


def train_baselines(_args) -> None:
    from receipts.crypto import baselines

    report = baselines.run()
    for name, entry in report["models"].items():
        t = entry["test"]
        print(f"{name:10s} fair AUC {entry['fair_auc']}  pooled AUC {t.get('auc')}  Brier {t.get('brier')}  80%+: {t.get('at_80_plus')}")
    print(f"Report: {baselines.REPORT}")


def glimmer_data(_args) -> None:
    from receipts.crypto import glimmer_data

    print(glimmer_data.build(), "->", glimmer_data.RECORDS)


def glimmer_eval(args) -> None:
    import pathlib

    from receipts.crypto import glimmer_eval

    report = glimmer_eval.evaluate([pathlib.Path(f) / "predictions.jsonl" for f in args.folders], args.name)
    for file in ("test", "later_aug", "later_sep"):
        for model, m in report.get(file, {}).items():
            print(f"{file:10s} {model:22s} fair AUC {m.get('fair_auc')}  AUC {m.get('auc')}  Brier {m.get('brier')}  n {m.get('n')}")


def live_check(args) -> None:
    from receipts.crypto import live

    result = live.check(args.mint, as_of=args.as_of, progress=lambda **kv: print(kv, flush=True))
    print(json.dumps({k: v for k, v in result.items() if k != "signals"}, indent=2, default=str))


def live_parity(args) -> None:
    from receipts.crypto import live

    report = live.parity(args.n)
    print(json.dumps({k: v for k, v in report.items() if k not in ("checks", "signals_matching_share")}, indent=2, default=str))


def agent(args) -> None:
    from receipts.agent import loop

    def emit(event):
        if event["type"] == "step" and event["status"] != "running":
            print(f'  {event["tool"]}: {event["summary"]} ({event["ms"]} ms)', flush=True)
        elif event["type"] == "answer":
            print("\n" + event["text"] + "\n\naudit:", json.dumps(event["audit"]), flush=True)

    loop.run(args.message, emit=emit, as_of=args.as_of)


def save_demo(args) -> None:
    from receipts.agent import demo

    demo.save()


def meta_report(args) -> None:
    from receipts.agent.meta import Meta

    print(json.dumps(Meta().report(), indent=2))


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
    p = sub.add_parser("build-dataset", help="build the rug check's tokens, links, labels and snapshots")
    p.add_argument("blocks", nargs="+", choices=["may", "aug", "sep"])
    p.add_argument("--stages", nargs="+", choices=DATASET_STAGES, help="only these stages (default: all, in order)")
    p.set_defaults(run=build_dataset)
    sub.add_parser("train-baselines", help="train and test the checklist and LightGBM baselines").set_defaults(run=train_baselines)
    sub.add_parser("glimmer-data", help="write Glimmer's prompts, bubble maps and fine-tuning answers").set_defaults(run=glimmer_data)
    p = sub.add_parser("glimmer-eval", help="score a Kaggle job's Glimmer predictions against the outcomes")
    p.add_argument("folders", nargs="+", help="the downloaded job outputs (each holds predictions.jsonl)")
    p.add_argument("--name", default="glimmer")
    p.set_defaults(run=glimmer_eval)
    p = sub.add_parser("live-check", help="a live rug check of one token from Helius (no Meta API)")
    p.add_argument("mint")
    p.add_argument("--as-of", type=int, help="unix seconds (default now)")
    p.set_defaults(run=live_check)
    p = sub.add_parser("live-parity", help="live checks of May 16 test tokens compared with their training snapshots")
    p.add_argument("-n", type=int, default=8)
    p.set_defaults(run=live_parity)
    p = sub.add_parser("agent", help="the rug check agent on one message (Meta API, guarded)")
    p.add_argument("message")
    p.add_argument("--as-of", type=int, help="check tokens as they stood at this unix time")
    p.set_defaults(run=agent)
    sub.add_parser("save-demo", help="run the agent on the demo tokens and save the runs (Meta API, guarded)").set_defaults(run=save_demo)
    sub.add_parser("meta-report", help="Meta Model API spend so far against the guard's limit").set_defaults(run=meta_report)
    p = sub.add_parser("goplus", help="GoPlus token security for a mint")
    p.add_argument("mint")
    p.set_defaults(run=goplus)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()

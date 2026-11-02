"""The demo's saved runs (SPEC.md 13): the agent run once on each demo token, as it stood at a set
age after launch, with every event kept so the site can replay it with the Meta API off.

The tokens are past launches from the May 16 test day, which no model trained on: four that
rugged after the check and two that didn't. Each run starts from what a user would type, a
pump.fun link or a mint. `about` says only what happened next.

    uv run python -m receipts save-demo        runs the agent (Meta API, guarded) and saves
    data/demo/<mint>_<age>.json                 {"events": [...], "after": hindsight: price to 1 hour, rug time}
"""

import json

import pandas as pd

from receipts.agent import loop
from receipts.config import settings
from receipts.crypto import dataset

ROOT = settings.data_dir / "demo"
AGE = 900  # 15 minutes after launch (SPEC.md 13)
TOKENS = [
    # mint, what happened next, what the user types (a pump.fun link, as people paste them)
    ("8ieFgzKCkQj1eTLjpfSpXGS6vqkxDmYpu3avzWMhpump", "rugged 31 minutes later; 26 team wallets tied by funding",
     "is this a rug? pump.fun/coin/8ieFgzKCkQj1eTLjpfSpXGS6vqkxDmYpu3avzWMhpump"),
    ("CQLRgHND9E4K4ed8xPAmhyQY61EgLmsUqTN5MDFcpump", "rugged 7.7 hours later; the team held 74% through 7 wallets",
     "pump.fun/coin/CQLRgHND9E4K4ed8xPAmhyQY61EgLmsUqTN5MDFcpump rug?"),
    ("9vBnYs7Y6xEfysisxD6BXZhWz9p6F1UBEJretHJpump", "rugged 11.6 hours later; 8 wallets bought in the launch block",
     "check 9vBnYs7Y6xEfysisxD6BXZhWz9p6F1UBEJretHJpump"),
    ("4i8XQih162ZrpE5ATkowkUz2qm6DSKJeNVS6wZZcpump", "rugged 2.9 hours later",
     "is 4i8XQih162ZrpE5ATkowkUz2qm6DSKJeNVS6wZZcpump going to rug?"),
    ("2CqJo99Xwww753TfXDGjxUeVKPazn1sEwDZf4576Fcmm", "didn't rug: still trading a day later",
     "pump.fun/coin/2CqJo99Xwww753TfXDGjxUeVKPazn1sEwDZf4576Fcmm"),
    ("BnK8QgRW6BGPbPV2b1tAZgxVwAJvJpEC9xPoQikRpump", "didn't rug: faded within the day",
     "rug check BnK8QgRW6BGPbPV2b1tAZgxVwAJvJpEC9xPoQikRpump"),
]


def snapshot_time(mint: str, age: int) -> int:
    s = pd.read_parquet(dataset.block("may").path("snapshots"), columns=["mint", "age_s", "snapshot_ts"])
    return int(s[(s.mint == mint) & (s.age_s == age)].snapshot_ts.iloc[0])


def after(mint: str, age: int, until: int = 3600, candle_s: int = 60) -> dict:
    """Hindsight, kept outside the check: the token's market cap from the check to `until` seconds
    after launch (60-second closes, from the training data's trades), and when it rugged."""
    import duckdb

    b = dataset.block("may")
    launch, start = duckdb.sql(f"SELECT launch_ts, start_mcap FROM read_parquet('{b.path('tokens')}') WHERE mint = ?",
                               params=[mint]).fetchall()[0]
    rows = duckdb.sql(f"""
        SELECT block_time - {launch} AS t, mcap FROM read_parquet('{b.path('trades')}')
        WHERE mint = ? AND mcap IS NOT NULL AND block_time <= {launch} + {until}
        ORDER BY slot, venue = 'pumpswap'
    """, params=[mint]).fetchall()
    candles, close, k = [], start, 0
    for t0 in range(age - age % candle_s, until, candle_s):
        while k < len(rows) and rows[k][0] < t0 + candle_s:
            close = rows[k][1]
            k += 1
        if t0 + candle_s > age:
            candles.append({"t": t0 + candle_s, "close": round(float(close), 3)})
    rug = duckdb.sql(f"SELECT rug_ts FROM read_parquet('{b.path('labels')}') WHERE mint = ? AND hours = 24",
                     params=[mint]).fetchall()
    rug_ts = rug[0][0] if rug else None
    return {"candle_s": candle_s, "candles": candles,
            "rug_s": None if rug_ts is None or rug_ts != rug_ts else int(rug_ts - launch)}


def save(age: int = AGE) -> list[dict]:
    ROOT.mkdir(parents=True, exist_ok=True)
    saved = []
    for old in ROOT.glob("*.json"):  # the set is exactly TOKENS
        old.unlink()
    for mint, about, message in TOKENS:
        events: list = []
        answer = loop.run(message, as_of=snapshot_time(mint, age), emit=events.append)
        path = ROOT / f"{mint}_{age}.json"
        path.write_text(json.dumps({"mint": mint, "age_s": age, "about": about, "message": message, "events": events,
                                    "after": after(mint, age)}, default=str))
        saved.append({"mint": mint, "audit": answer["audit"], "path": str(path)})
        print(saved[-1], flush=True)
    return saved


def runs() -> list[dict]:
    """The saved runs in TOKENS order (the hero first), without their events (for the demo list)."""
    out = []
    order = {mint: i for i, (mint, _, _) in enumerate(TOKENS)}
    for path in sorted(ROOT.glob("*.json"), key=lambda p: order.get(p.stem.rsplit("_", 1)[0], len(order))):
        d = json.loads(path.read_text())
        answer = next((e for e in d["events"] if e["type"] == "answer"), {})
        check = answer.get("check") or {}
        out.append({"id": path.stem, "mint": d["mint"], "age_s": d["age_s"], "about": d["about"],
                    "symbol": check.get("symbol"), "verdict": check.get("verdict"),
                    "rug_chance": check.get("trees_rug_chance")})
    return out


def run(run_id: str) -> dict | None:
    path = ROOT / f"{run_id}.json"
    return json.loads(path.read_text()) if path.parent == ROOT and path.exists() else None

"""The demo's saved runs (SPEC.md 13): the agent run once on each demo token, as it stood at a set
age after launch, with every event kept so the site can replay it with the Meta API off.

The tokens are past launches from the May 16 test day, which no model trained on: three that
rugged hours after the check and two that didn't. `about` says only what happened next.

    uv run python -m receipts save-demo        runs the agent (Meta API, guarded) and saves
    data/demo/<mint>_<age>.json                 {"events": [...], "token": {...}}
"""

import json

import pandas as pd

from receipts.agent import loop
from receipts.config import settings
from receipts.crypto import dataset

ROOT = settings.data_dir / "demo"
CLIPS = settings.data_dir / "test-clips"
AGE = 900  # 15 minutes after launch (SPEC.md 13)
TOKENS = [
    # mint, what the demo shows, the clip that shills it (the builder's own mock clip)
    ("CQLRgHND9E4K4ed8xPAmhyQY61EgLmsUqTN5MDFcpump", "rugged 7.7 hours later; the team held 74% through 7 wallets", "drake-shill.mp4"),
    ("9vBnYs7Y6xEfysisxD6BXZhWz9p6F1UBEJretHJpump", "rugged 11.6 hours later; 8 wallets bought in the launch block", None),
    ("4i8XQih162ZrpE5ATkowkUz2qm6DSKJeNVS6wZZcpump", "rugged 2.9 hours later", None),
    ("2CqJo99Xwww753TfXDGjxUeVKPazn1sEwDZf4576Fcmm", "didn't rug: still trading a day later", None),
    ("BnK8QgRW6BGPbPV2b1tAZgxVwAJvJpEC9xPoQikRpump", "didn't rug: faded within the day", None),
]


def snapshot_time(mint: str, age: int) -> int:
    s = pd.read_parquet(dataset.block("may").path("snapshots"), columns=["mint", "age_s", "snapshot_ts"])
    return int(s[(s.mint == mint) & (s.age_s == age)].snapshot_ts.iloc[0])


def save(age: int = AGE) -> list[dict]:
    ROOT.mkdir(parents=True, exist_ok=True)
    saved = []
    for mint, about, clip in TOKENS:
        events: list = []
        video = (CLIPS / clip).read_bytes() if clip and (CLIPS / clip).exists() else None
        message = "Someone posted this clip. Is the token a rug?" if video else f"Is {mint} a rug?"
        answer = loop.run(message, video=video, as_of=snapshot_time(mint, age), emit=events.append)
        path = ROOT / f"{mint}_{age}.json"
        path.write_text(json.dumps({"mint": mint, "age_s": age, "about": about, "message": message,
                                    "clip": clip if video else None, "events": events}, default=str))
        saved.append({"mint": mint, "audit": answer["audit"], "path": str(path)})
        print(saved[-1], flush=True)
    return saved


def runs() -> list[dict]:
    """The saved runs, newest format first, without their events (for the demo list)."""
    out = []
    for path in sorted(ROOT.glob("*.json")):
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

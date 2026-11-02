"""Muse Glimmer's precomputed rug chances for the demo tokens (SPEC.md 7.10).

Glimmer has no free GPU to serve it live, so the fine-tuned model scores the demo tokens' snapshots
on Kaggle ahead of time (`kaggle/push.py score --ids ... --generate`), writing each rug chance and
the answer it gives.

The rug chance is Glimmer's own: the expected value of its distribution over 1–99, uncalibrated.
Isotonic calibration fit on the 300 calibration snapshots scored so far puts most values on one
step (56%), while the raw value scored about as well on the test day (Brier 0.077 vs 0.076).
Its written reasons are kept for "How the model saw it" but not given to the agent: fine-tuning
taught a fixed template, and the same phrase can appear as raising and lowering the chance.

    data/glimmer/runs/demo*/predictions.jsonl  the demo jobs' output
"""

import functools
import json

from receipts.config import settings

RUNS = settings.data_dir / "glimmer" / "runs"
MODEL = "Muse Glimmer 30B, fine-tuned by us on May 11–14 launches"


@functools.lru_cache(maxsize=1)
def _scores() -> dict[str, dict]:
    out = {}
    for demo in sorted(RUNS.glob("demo*/predictions.jsonl")):  # one folder per demo scoring job
        for line in demo.read_text().splitlines():
            r = json.loads(line)
            out[r["id"]] = {"rug_chance": r["p"], "answer": r.get("answer", ""), "model": MODEL}
    return out


def lookup(mint: str, age_s: int) -> dict | None:
    return _scores().get(f"{mint}_{age_s}")

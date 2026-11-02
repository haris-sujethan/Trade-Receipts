"""Muse Glimmer's precomputed rug chances for the demo tokens (SPEC.md 7.10).

Glimmer has no free GPU to serve it live, so the fine-tuned model scores the demo tokens' snapshots
on Kaggle ahead of time (`kaggle/push.py score --ids ... --generate`), writing each rug chance and
the reasons it gives. Its raw rug chance is calibrated with isotonic regression on the
fine-tuned model's calibration scores (May 15), the same way the receipt calibrates it.

    data/glimmer/runs/demo/predictions.jsonl       the demo job's output
    data/glimmer/runs/score-sft/predictions.jsonl  the fine-tuned model's calibration scores
"""

import functools
import json

import numpy as np
from sklearn.isotonic import IsotonicRegression

from receipts.config import settings

RUNS = settings.data_dir / "glimmer" / "runs"
MODEL = "Muse Glimmer 30B, fine-tuned by us on May 11–14 launches"


@functools.lru_cache(maxsize=1)
def _scores() -> dict[str, dict]:
    demo = RUNS / "demo" / "predictions.jsonl"
    cal = RUNS / "score-sft" / "predictions.jsonl"
    if not demo.exists() or not cal.exists():
        return {}
    rows = [json.loads(line) for line in cal.read_text().splitlines()]
    rows = [r for r in rows if r["file"] == "calibration"]
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.01, y_max=0.99).fit(
        np.array([r["p"] for r in rows]), np.array([int(r["rugged"]) for r in rows]))
    out = {}
    for line in demo.read_text().splitlines():
        r = json.loads(line)
        reasons = r.get("answer", "").partition("\n")[2].strip()
        out[r["id"]] = {"rug_chance": float(iso.predict([r["p"]])[0]), "raw": r["p"], "reasons": reasons, "model": MODEL}
    return out


def lookup(mint: str, age_s: int) -> dict | None:
    return _scores().get(f"{mint}_{age_s}")

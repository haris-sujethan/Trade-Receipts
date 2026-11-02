"""The model's receipt for Glimmer (SPEC.md 7.9): its rug chances against the real outcomes.

Reads Kaggle scoring jobs' predictions (rug chances for the calibration, test and later-check
files, from one job or split across several), fits isotonic calibration on the calibration file (May 15), and scores the test (May 16)
and the later checks (Aug 12, Sep 15, 6-hour labels) with the same metrics as the baselines:
the fair AUC within each mode and age, the pooled AUC, Brier, how often 80%+ really rugged, the
verdict bands, and the calibration curve. The trees are scored on exactly the same snapshots, and
so is the combination (the mean of Glimmer's and the trees' calibrated chances).

    uv run python -m receipts glimmer-eval <job output folder>... [--name glimmer-rl]
    data/reports/glimmer_<name>.json
"""

import json
import pathlib

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

from receipts.config import settings
from receipts.crypto import baselines

REPORTS = settings.data_dir / "reports"


def evaluate(predictions: list[pathlib.Path], name: str) -> dict:
    df = pd.concat([pd.read_json(p, lines=True) for p in predictions], ignore_index=True)
    df = df.drop_duplicates(["file", "id"])
    df["y"] = df.rugged.astype(int)
    cal = df[df.file == "calibration"]
    report: dict = {"name": name, "scored": df.groupby("file").size().to_dict()}
    if len(cal) >= 50 and cal.y.nunique() == 2:
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.01, y_max=0.99).fit(cal.p, cal.y)
        df["glimmer"] = iso.predict(df.p)
        report["calibrated_on"] = int(len(cal))
    else:
        df["glimmer"] = df.p
        report["calibrated_on"] = 0
    df["trees"] = df.tree_p
    df["combined"] = (df.glimmer + df.trees) / 2
    for file in ("test", "later_aug", "later_sep"):
        part = df[df.file == file]
        if part.empty:
            continue
        y = part.y.to_numpy()
        entry = {}
        for model in ("glimmer", "trees", "combined", "p"):
            p = part[model].to_numpy(float)
            _, fair = baselines.by_mode_age(part.assign(age_s=part.age_s), y, p)
            m = baselines.metrics(y, p)
            entry["glimmer_uncalibrated" if model == "p" else model] = {"fair_auc": fair, **m}
        report[file] = entry
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"glimmer_{name}.json").write_text(json.dumps(report, indent=2, default=str))
    return report

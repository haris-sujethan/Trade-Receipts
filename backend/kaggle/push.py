"""Push a Glimmer job to Kaggle: `uv run python kaggle/push.py <mode> [--limit N] [--adapter-from SLUG] [--hours H]`.

Writes kaggle/jobs/glimmer-<mode>/ (the job script with its settings filled in, plus Kaggle's
metadata) and starts it on 2× T4 with the private dataset attached. `--adapter-from` attaches an
earlier job's output (its saved adapter) as an input. Needs KAGGLE_API_TOKEN in .env.
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

from receipts.config import settings  # noqa: F401  (loads .env into the environment)

HERE = pathlib.Path(__file__).parent
USER = "harissujethan"
DATASET = f"{USER}/rug-check-glimmer-data"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["smoke", "sft", "rl", "score"])
    ap.add_argument("--limit", type=int)
    ap.add_argument("--adapter-from", help="slug of an earlier job whose output has adapter/")
    ap.add_argument("--hours", type=float, default=11.5, help="Kaggle run-time cap")
    ap.add_argument("--slug", help="job name (default glimmer-<mode>)")
    args = ap.parse_args()
    slug = args.slug or f"glimmer-{args.mode}"
    job = HERE / "jobs" / slug
    job.mkdir(parents=True, exist_ok=True)
    code = (HERE / "glimmer_job.py").read_text()
    adapter = args.adapter_from
    code = re.sub(r'^MODE = .*$', f'MODE = "{args.mode}"', code, count=1, flags=re.M)
    # stop about 20 minutes before the run-time cap, leaving time to save
    code = re.sub(r'^TIME_LIMIT = .*$', f"TIME_LIMIT = {max(0.1, args.hours - 0.35) * 3600:.0f}", code, count=1, flags=re.M)
    code = re.sub(r'^LIMIT = .*$', f"LIMIT = {args.limit!r}", code, count=1, flags=re.M)
    code = re.sub(r'^ADAPTER_FROM = .*$', f"ADAPTER_FROM = {adapter!r}", code, count=1, flags=re.M)
    (job / "run.py").write_text(code)
    meta = {
        "id": f"{USER}/{slug}", "title": slug, "code_file": "run.py", "language": "python",
        "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_tpu": False,
        "enable_internet": True, "dataset_sources": [DATASET], "competition_sources": [],
        "kernel_sources": [f"{USER}/{args.adapter_from}"] if args.adapter_from else [], "model_sources": [],
    }
    (job / "kernel-metadata.json").write_text(json.dumps(meta, indent=2))
    cmd = ["kaggle", "kernels", "push", "-p", str(job), "--accelerator", "NvidiaTeslaT4",
           "--timeout", str(int(args.hours * 3600))]
    sys.exit(subprocess.run(cmd).returncode)


if __name__ == "__main__":
    main()

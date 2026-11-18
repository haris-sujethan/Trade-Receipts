"""The backend on Vercel: one Python function serving the FastAPI app for every /api path.

Vercel's filesystem is read-only except /tmp, and live checks write their working tables and caches, so the
bundled data (the trees, the pump.fun interface files, the saved demo runs and past snapshots) is copied to
/tmp once per instance and the app runs from there.
"""

import os
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path("/tmp/receipts-data")
if not (DATA / ".ready").exists():
    shutil.copytree(ROOT / "data", DATA, dirs_exist_ok=True)
    (DATA / ".ready").touch()
os.environ.setdefault("RECEIPTS_DATA_DIR", str(DATA))
# Vercel's free plan stops a request at 300 s: checks stop fetching in time to build what they have.
os.environ.setdefault("LIVE_TIME_BUDGET_S", "200")
sys.path.insert(0, str(ROOT))

from receipts.server import app  # noqa: E402

__all__ = ["app"]

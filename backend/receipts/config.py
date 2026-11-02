"""Settings read from the environment and the repo's `.env`.

Keys live only in `.env` (gitignored) or the environment; nothing here has a default key.
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(REPO_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    google_cloud_project: str | None
    helius_api_key: str | None
    data_dir: Path
    # BigQuery sandbox: 1 TiB of queries a month. Stop well short of it.
    bq_monthly_budget_bytes: int
    bq_query_cap_bytes: int
    # Helius free plan: 1M credits a month.
    helius_monthly_budget_credits: int
    # Meta Model API (SPEC.md 12): off unless META_API_ENABLED is true; see receipts/agent/meta.py.
    model_api_key: str | None
    meta_api_enabled: bool
    meta_contributor: bool

    def require(self, name: str) -> str:
        value = getattr(self, name)
        if not value:
            env = name.upper()
            raise RuntimeError(f"{env} is not set. Add it to .env at the repo root (see .env.example).")
        return value


def _gib(name: str, default: float) -> int:
    return int(float(os.environ.get(name, default)) * 2**30)


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    return default if value is None or value == "" else value.strip().lower() in ("1", "true", "yes", "on")


def load() -> Settings:
    data_dir = Path(os.environ.get("RECEIPTS_DATA_DIR", REPO_ROOT / "data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        google_cloud_project=os.environ.get("GOOGLE_CLOUD_PROJECT") or None,
        helius_api_key=os.environ.get("HELIUS_API_KEY") or None,
        data_dir=data_dir,
        bq_monthly_budget_bytes=_gib("BQ_MONTHLY_BUDGET_GIB", 900),
        bq_query_cap_bytes=_gib("BQ_QUERY_CAP_GIB", 60),
        helius_monthly_budget_credits=int(os.environ.get("HELIUS_MONTHLY_BUDGET_CREDITS", 900_000)),
        model_api_key=os.environ.get("MODEL_API_KEY") or None,
        meta_api_enabled=_flag("META_API_ENABLED", False),
        meta_contributor=_flag("META_CONTRIBUTOR", True),
    )


settings = load()

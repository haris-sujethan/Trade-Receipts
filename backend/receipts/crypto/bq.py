"""The one way the pipeline queries BigQuery.

The sandbox gives 1 TiB of queries a month for free and can't be billed, so the risk is running
out of quota mid-pull rather than a charge. Every query:
- is dry-run first, and refused if it would scan more than the per-query cap or push this
  month's ledger past the budget (BQ_QUERY_CAP_GIB, BQ_MONTHLY_BUDGET_GIB);
- runs with `maximum_bytes_billed` set, so BigQuery itself enforces the cap;
- is logged with the bytes actually billed to `data/ledger/bigquery.jsonl`;
- is cached by its SQL and parameters as Parquet, so reruns cost nothing.

Months follow Pacific time, as the sandbox's quota does. This month's use is read from BigQuery's
own job list (a free metadata call), so a query whose download was interrupted still counts.
Results download through the Storage Read API in parallel, LZ4-compressed streams, which is far
faster than the REST API for millions of rows and works in the sandbox.
"""

import datetime as dt
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq
from google.cloud import bigquery, bigquery_storage

from receipts.config import Settings, settings as default_settings

MIN_BILLED_BYTES = 10 * 2**20  # BigQuery bills at least 10 MB per query
QUOTA_TZ = ZoneInfo("America/Los_Angeles")
DOWNLOAD_STREAMS = 16


class BudgetExceeded(RuntimeError):
    pass


def _param_repr(params: list) -> list:
    return [p.to_api_repr() for p in params]


class GuardedBigQuery:
    def __init__(self, settings: Settings = default_settings, client: bigquery.Client | None = None):
        self.settings = settings
        self.client = client or bigquery.Client(project=settings.require("google_cloud_project"))
        self.ledger_path = settings.data_dir / "ledger" / "bigquery.jsonl"
        self.cache_dir = settings.data_dir / "cache" / "bigquery"

    def _config(self, params: list, **kwargs) -> bigquery.QueryJobConfig:
        return bigquery.QueryJobConfig(query_parameters=params, **{"use_query_cache": True} | kwargs)

    def estimate(self, sql: str, params: list = ()) -> int:
        """Bytes the query would scan, from a free dry run."""
        job = self.client.query(sql, job_config=self._config(list(params), dry_run=True, use_query_cache=False))
        return job.total_bytes_processed or 0

    def spent_this_month(self) -> int:
        """Bytes billed this quota month: BigQuery's job list when reachable, else the local ledger."""
        now = dt.datetime.now(QUOTA_TZ)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        try:
            jobs = self.client.list_jobs(min_creation_time=month_start.astimezone(dt.UTC), all_users=False)
            return sum(j.total_bytes_billed or 0 for j in jobs if j.job_type == "query")
        except Exception:
            return self._ledger_spent(now.strftime("%Y-%m"))

    def _ledger_spent(self, month: str) -> int:
        if not self.ledger_path.exists():
            return 0
        total = 0
        for line in self.ledger_path.read_text().splitlines():
            entry = json.loads(line)
            at = dt.datetime.fromisoformat(entry["at"]).astimezone(QUOTA_TZ)
            if at.strftime("%Y-%m") == month:
                total += entry["bytes_billed"]
        return total

    def _cache_path(self, sql: str, params: list) -> Path:
        key = hashlib.sha256(json.dumps([sql, _param_repr(params)], sort_keys=True).encode()).hexdigest()[:24]
        return self.cache_dir / f"{key}.parquet"

    def query(self, sql: str, params: list = (), *, label: str, cap_bytes: int | None = None) -> pa.Table:
        """Run a query within the budget and return its rows, from the cache when possible."""
        params = list(params)
        cache = self._cache_path(sql, params)
        if cache.exists():
            return pq.read_table(cache)

        cap = cap_bytes or self.settings.bq_query_cap_bytes
        estimate = max(self.estimate(sql, params), MIN_BILLED_BYTES)
        if estimate > cap:
            raise BudgetExceeded(f"{label}: would scan {estimate / 2**30:.1f} GiB, over the {cap / 2**30:.0f} GiB cap per query")
        spent = self.spent_this_month()
        budget = self.settings.bq_monthly_budget_bytes
        if spent + estimate > budget:
            raise BudgetExceeded(
                f"{label}: {estimate / 2**30:.1f} GiB would take this month to {(spent + estimate) / 2**30:.0f} GiB, "
                f"over the {budget / 2**30:.0f} GiB budget"
            )

        job = self.client.query(
            sql,
            job_config=self._config(params, maximum_bytes_billed=cap, labels={"pipeline": _label(label)}),
        )
        job.result()
        self._log(label, cache.stem, estimate, job.total_bytes_billed or 0, job.result().total_rows)
        table = self.download(job)
        cache.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(table, cache)
        return table

    def download(self, job: bigquery.QueryJob) -> pa.Table:
        """A finished query's rows, read in parallel LZ4-compressed Arrow streams."""
        dest = job.destination
        storage = bigquery_storage.BigQueryReadClient()
        types = bigquery_storage.types
        session = storage.create_read_session(
            parent=f"projects/{self.client.project}",
            read_session=types.ReadSession(
                table=f"projects/{dest.project}/datasets/{dest.dataset_id}/tables/{dest.table_id}",
                data_format=types.DataFormat.ARROW,
                read_options=types.ReadSession.TableReadOptions(
                    arrow_serialization_options=types.ArrowSerializationOptions(
                        buffer_compression=types.ArrowSerializationOptions.CompressionCodec.LZ4_FRAME
                    )
                ),
            ),
            max_stream_count=DOWNLOAD_STREAMS,
        )
        if not session.streams:
            return job.result().to_arrow(create_bqstorage_client=False)
        with ThreadPoolExecutor(len(session.streams)) as pool:
            parts = list(pool.map(lambda s: storage.read_rows(s.name).to_arrow(session), session.streams))
        return pa.concat_tables(parts)

    def _log(self, label: str, key: str, estimated: int, billed: int, rows: int) -> None:
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
            "label": label, "key": key, "bytes_estimated": estimated, "bytes_billed": billed, "rows": rows,
        }
        with self.ledger_path.open("a") as f:
            f.write(json.dumps(entry) + "\n")


def _label(text: str) -> str:
    """BigQuery labels allow lowercase letters, digits, - and _ (63 chars)."""
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in text.lower())[:63]

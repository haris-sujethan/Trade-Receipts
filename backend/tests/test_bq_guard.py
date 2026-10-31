"""The BigQuery guard, against a fake client (no network, no quota)."""

import dataclasses
import json

import pyarrow as pa
import pytest

from receipts.config import settings
from receipts.crypto.bq import BudgetExceeded, GuardedBigQuery

GIB = 2**30


class FakeJob:
    def __init__(self, scanned: int):
        self.total_bytes_processed = scanned
        self.total_bytes_billed = scanned
        self.total_rows = 3

    def result(self):
        return self

    def to_arrow(self, create_bqstorage_client=False):
        return pa.table({"n": [1, 2, 3]})


class FakeClient:
    def __init__(self, scanned: int):
        self.scanned = scanned
        self.runs = []

    def query(self, sql, job_config):
        if not job_config.dry_run:
            self.runs.append(job_config.maximum_bytes_billed)
        return FakeJob(self.scanned)


@pytest.fixture
def guard(tmp_path):
    def make(scanned: int, **limits):
        s = dataclasses.replace(settings, data_dir=tmp_path, google_cloud_project="test", **limits)
        bq = GuardedBigQuery(s, client=FakeClient(scanned))
        bq.download = lambda job: job.to_arrow()
        return bq
    return make


def test_runs_logs_and_caches(guard):
    bq = guard(2 * GIB)
    assert bq.query("SELECT 1", label="t").num_rows == 3
    assert bq.query("SELECT 1", label="t").num_rows == 3  # second time from the cache
    assert len(bq.client.runs) == 1
    assert bq.client.runs[0] == bq.settings.bq_query_cap_bytes  # BigQuery enforces the cap too
    entry = json.loads(bq.ledger_path.read_text())
    assert entry["bytes_billed"] == 2 * GIB and entry["label"] == "t"
    assert bq.spent_this_month() == 2 * GIB


def test_refuses_a_query_over_the_cap(guard):
    bq = guard(100 * GIB, bq_query_cap_bytes=60 * GIB)
    with pytest.raises(BudgetExceeded, match="cap"):
        bq.query("SELECT big", label="t")
    assert bq.client.runs == []


def test_refuses_once_the_month_is_spent(guard):
    bq = guard(40 * GIB, bq_monthly_budget_bytes=100 * GIB)
    bq.query("SELECT 1", label="a")
    bq.query("SELECT 2", label="b")
    with pytest.raises(BudgetExceeded, match="budget"):
        bq.query("SELECT 3", label="c")
    assert len(bq.client.runs) == 2

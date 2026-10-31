"""Local storage for pulled pump.fun data: one Parquet file per day per record type.

    data/pump/raw/<day>.parquet              the rows BigQuery returned (event bytes)
    data/pump/<kind>/<day>/part-<n>.parquet  decoded launches, trades, graduations, migrations, pools

Everything lives under the gitignored `data/` folder. DuckDB reads the folders as tables.
Raw files are written in row groups of CHUNK rows; each decode worker reads one group and
writes its own part, so memory stays small however big the day is.
"""

import dataclasses
import datetime as dt
import os
import shutil
from concurrent.futures import ProcessPoolExecutor

import pyarrow as pa
import pyarrow.parquet as pq

from receipts.config import settings
from receipts.crypto import events

ROOT = settings.data_dir / "pump"
KINDS = {
    "launches": events.Launch,
    "trades": events.Trade,
    "graduations": events.Graduation,
    "migrations": events.Migration,
    "pools": events.Pool,
}
_KIND_OF = {cls: kind for kind, cls in KINDS.items()}
CHUNK = 200_000


def raw_path(day: dt.date):
    return ROOT / "raw" / f"{day.isoformat()}.parquet"


def kind_dir(kind: str, day: dt.date):
    return ROOT / kind / day.isoformat()


def save_raw(day: dt.date, table: pa.Table) -> None:
    path = raw_path(day)
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, row_group_size=CHUNK)


def _columns(cls) -> list[str]:
    return [f.name for f in dataclasses.fields(cls) if f.name != "ctx"] + ["signature", "slot", "block_time", "ix_index"]


def _decode_group(day: dt.date, group: int) -> dict[str, int]:
    """Decode one row group of a day's raw file and write a part per kind (runs in a worker)."""
    cols = pq.ParquetFile(raw_path(day)).read_row_group(group).to_pydict()
    out = {kind: {c: [] for c in _columns(cls)} for kind, cls in KINDS.items()}
    failures = 0
    for i in range(len(cols["raw"])):
        ctx = events.Context(cols["tx_signature"][i], cols["block_slot"][i], cols["block_time"][i], cols["ix_index"][i])
        try:
            record = events.decode(cols["program_id"][i], cols["raw"][i], ctx)
        except ValueError:
            failures += 1
            continue
        if record is None:
            continue
        target = out[_KIND_OF[type(record)]]
        for f in dataclasses.fields(record):
            if f.name != "ctx":
                target[f.name].append(getattr(record, f.name))
        target["signature"].append(ctx.signature)
        target["slot"].append(ctx.slot)
        target["block_time"].append(ctx.block_time)
        target["ix_index"].append(ctx.index)
    counts = {"failures": failures}
    for kind, columns in out.items():
        table = pa.table(_typed(columns))
        pq.write_table(table, kind_dir(kind, day) / f"part-{group:04d}.parquet")
        counts[kind] = table.num_rows
    return counts


def decode_day(day: dt.date, workers: int | None = None) -> dict[str, int]:
    """Decode a day's raw rows into per-kind Parquet parts. Returns row counts and failures."""
    for kind in KINDS:
        shutil.rmtree(kind_dir(kind, day), ignore_errors=True)
        kind_dir(kind, day).mkdir(parents=True)
    groups = pq.ParquetFile(raw_path(day)).num_row_groups
    totals: dict[str, int] = {}
    with ProcessPoolExecutor(max_workers=workers or max(1, (os.cpu_count() or 2) - 2)) as pool:
        for counts in pool.map(_decode_group, [day] * groups, range(groups)):
            for name, n in counts.items():
                totals[name] = totals.get(name, 0) + n
    return totals


def _typed(cols: dict[str, list]) -> dict[str, pa.Array]:
    """u64 amounts can pass int64's range, so integers that don't fit are stored as decimal."""
    out = {}
    for name, values in cols.items():
        try:
            out[name] = pa.array(values)
        except (pa.ArrowInvalid, OverflowError):
            out[name] = pa.array(values, type=pa.decimal128(38, 0))
    return out

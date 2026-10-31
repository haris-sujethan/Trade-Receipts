"""Check BigQuery's public Solana dataset before the pump.fun pull relies on it.

Reports each table's schema, partitioning and clustering (free metadata calls), the daily row
counts from May to October 2026 with any missing or thin days, and the dry-run cost of one
day of pump.fun and PumpSwap instructions. Writes `data/reports/bq_check.json`.
"""

import datetime as dt
import json
import statistics

from google.api_core import exceptions as gexc
from google.cloud import bigquery

from receipts.config import settings
from receipts.crypto import programs
from receipts.crypto.bq import GuardedBigQuery

DATASET = "bigquery-public-data.crypto_solana_mainnet_us"
START, END = dt.date(2026, 5, 1), dt.date(2026, 10, 31)
THIN = 0.5  # a day with under half the median row count is flagged


def _field(f: bigquery.SchemaField) -> dict:
    out = {"name": f.name, "type": f.field_type, "mode": f.mode}
    if f.fields:
        out["fields"] = [_field(sub) for sub in f.fields]
    return out


def tables(bq: GuardedBigQuery) -> list[dict]:
    out = []
    for item in bq.client.list_tables(DATASET):
        t = bq.client.get_table(item.reference)
        out.append({
            "table": t.table_id,
            "rows": t.num_rows,
            "gib": round((t.num_bytes or 0) / 2**30, 1),
            "partitioned_by": t.time_partitioning.field if t.time_partitioning else None,
            "partition_type": t.time_partitioning.type_ if t.time_partitioning else None,
            "clustered_by": t.clustering_fields,
            "modified": t.modified.isoformat() if t.modified else None,
            "schema": [_field(f) for f in t.schema],
        })
    return out


def coverage(bq: GuardedBigQuery, table_ids: list[str]) -> dict:
    """Daily row counts from the partitions view, with missing and thin days."""
    sql = f"""
        SELECT table_name, partition_id, total_rows
        FROM `{DATASET}.INFORMATION_SCHEMA.PARTITIONS`
        WHERE table_name IN UNNEST(@tables)
          AND partition_id BETWEEN @start AND @end
    """
    params = [
        bigquery.ArrayQueryParameter("tables", "STRING", table_ids),
        bigquery.ScalarQueryParameter("start", "STRING", START.strftime("%Y%m%d")),
        bigquery.ScalarQueryParameter("end", "STRING", END.strftime("%Y%m%d")),
    ]
    try:
        rows = bq.query(sql, params, label="bq-check-partitions").to_pylist()
    except (gexc.Forbidden, gexc.BadRequest, gexc.NotFound) as e:
        return {"error": f"partitions view unavailable: {e.message}"}

    days = [START + dt.timedelta(n) for n in range((END - START).days + 1)]
    out = {}
    for table in table_ids:
        counts = {r["partition_id"]: r["total_rows"] for r in rows if r["table_name"] == table}
        if not counts:
            continue
        median = statistics.median(counts.values())
        daily = {d.isoformat(): counts.get(d.strftime("%Y%m%d"), 0) for d in days}
        out[table] = {
            "median_rows_per_day": median,
            "first_day": min(counts), "last_day": max(counts),
            "missing_days": [d for d, n in daily.items() if n == 0],
            "thin_days": [d for d, n in daily.items() if 0 < n < THIN * median],
            "daily": daily,
        }
    return out


def instruction_cost(bq: GuardedBigQuery, table: dict) -> dict:
    """Dry-run one day of pump.fun and PumpSwap instructions, using the table's own partition and cluster columns."""
    part = table["partitioned_by"]
    cluster = (table["clustered_by"] or [None])[0]
    if not part or not cluster:
        return {"error": f"{table['table']} isn't both partitioned and clustered; check the schema by hand"}
    day = dt.date(2026, 9, 15)
    columns = [f["name"] for f in table["schema"]]
    sql = f"""
        SELECT {", ".join(f"`{c}`" for c in columns)}
        FROM `{DATASET}.{table["table"]}`
        WHERE DATE(`{part}`) = @day AND `{cluster}` IN UNNEST(@programs)
    """
    params = [
        bigquery.ScalarQueryParameter("day", "DATE", day),
        bigquery.ArrayQueryParameter("programs", "STRING", [programs.PUMP, programs.PUMP_AMM]),
    ]
    one_day = bq.estimate(sql, params)
    return {
        "day": day.isoformat(),
        "filter": f"{cluster} in (pump, pump_amm)",
        "all_columns_gib_per_day": round(one_day / 2**30, 2),
        "note": "Upper bound: the pull selects fewer columns.",
    }


def run() -> dict:
    bq = GuardedBigQuery()
    report: dict = {"dataset": DATASET, "checked": dt.datetime.now(dt.UTC).isoformat(timespec="seconds")}
    report["tables"] = tables(bq)
    partitioned = [t["table"] for t in report["tables"] if t["partitioned_by"]]
    report["coverage"] = coverage(bq, partitioned)
    instructions = next((t for t in report["tables"] if t["table"].lower() == "instructions"), None)
    report["instruction_cost"] = instruction_cost(bq, instructions) if instructions else {"error": "no Instructions table"}
    report["quota_used_this_month_gib"] = round(bq.spent_this_month() / 2**30, 2)

    path = settings.data_dir / "reports" / "bq_check.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, default=str))
    _print(report)
    print(f"\nFull report: {path}")
    return report


def _print(report: dict) -> None:
    print(f"Dataset {report['dataset']}")
    for t in report["tables"]:
        print(f"\n{t['table']}: {t['rows']:,} rows, {t['gib']:,} GiB, partitioned by {t['partitioned_by']} "
              f"({t['partition_type']}), clustered by {t['clustered_by']}")
        for f in t["schema"]:
            nested = f" {{{', '.join(s['name'] for s in f.get('fields', []))}}}" if f.get("fields") else ""
            print(f"  {f['name']}: {f['type']} {f['mode']}{nested}")
    print("\nCoverage, May 1 – Oct 31, 2026")
    cov = report["coverage"]
    if "error" in cov:
        print(f"  {cov['error']}")
    for table, c in cov.items() if "error" not in cov else []:
        print(f"  {table}: {c['first_day']}–{c['last_day']}, median {c['median_rows_per_day']:,.0f} rows a day, "
              f"{len(c['missing_days'])} missing days, {len(c['thin_days'])} thin days")
        for label in ("missing_days", "thin_days"):
            if c[label]:
                print(f"    {label.replace('_', ' ')}: {', '.join(c[label][:20])}{' …' if len(c[label]) > 20 else ''}")
    print("\nCost of one day of pump.fun and PumpSwap instructions")
    print(f"  {report['instruction_cost']}")
    print(f"\nQuota used this month: {report['quota_used_this_month_gib']} GiB")

"""Pull pump.fun and PumpSwap events from BigQuery's public Solana `Instructions` table.

One query per day scans that day's pump.fun and PumpSwap instructions (about 27 GiB) and
keeps only the events the rug check uses, for the tokens being sampled:
- every CreateEvent (they're few, and give each creator's launch history);
- curve trades, graduations, migrations and new pools for the sampled mints;
- PumpSwap trades in those mints' pools.

`data` is base58 in the table, so a JavaScript UDF decodes it inside BigQuery and pulls out
just the key needed for filtering (the mint or the pool). The full event is decoded in Python
by `events.decode`, from the same IDL, so the two can't disagree about layouts.
"""

import datetime as dt
import json

import base58
import pyarrow as pa
from google.cloud import bigquery

from receipts.crypto import events, idl, programs
from receipts.crypto.bq import GuardedBigQuery

TABLE = "bigquery-public-data.crypto_solana_mainnet_us.Instructions"

# event -> (field filtered on, a second field kept for joins)
KEYS = {
    (programs.PUMP, "CreateEvent"): ("mint", None),
    (programs.PUMP, "TradeEvent"): ("mint", None),
    (programs.PUMP, "CompleteEvent"): ("mint", None),
    (programs.PUMP, "CompletePumpAmmMigrationEvent"): ("mint", "pool"),
    (programs.PUMP_AMM, "BuyEvent"): ("pool", None),
    (programs.PUMP_AMM, "SellEvent"): ("pool", None),
    (programs.PUMP_AMM, "CreatePoolEvent"): ("base_mint", "pool"),
}
# The shortest kept event (CompleteEvent, 160 bytes) is 218 base58 characters; most other
# pump.fun instructions are far shorter, so this drops them before decoding.
MIN_DATA_CHARS = 200
_SKIPPABLE = {"string", "pubkey", "u8", "bool", "u16", "u32", "u64", "i64", "u128", "i128"}


def _prefix(program_id: str, event: str, field: str | None) -> list[str] | None:
    """The types of the fields before `field`, which the UDF skips to reach it."""
    if field is None:
        return None
    types = []
    for f in idl.load(program_id).types[event]["fields"]:
        if f["name"] == field:
            return types
        if f["type"] not in _SKIPPABLE:
            raise ValueError(f"{event}.{f['name']} has a type the UDF can't skip: {f['type']}")
        types.append(f["type"])
    raise ValueError(f"{event} has no field {field}")


def event_specs() -> dict[str, list]:
    """Discriminator (hex) -> [event name, prefix to key, prefix to key2]."""
    specs = {}
    for (program_id, event), (key, key2) in KEYS.items():
        disc = idl.load(program_id).event_discriminators[event].hex()
        specs[disc] = [event, _prefix(program_id, event, key), _prefix(program_id, event, key2)]
    return specs


UDF_JS = r"""
const SPECS = __SPECS__;
const TAG = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d];
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAP = {};
for (let i = 0; i < ALPHABET.length; i++) MAP[ALPHABET[i]] = i;
const SIZES = {pubkey: 32, u8: 1, bool: 1, u16: 2, u32: 4, u64: 8, i64: 8, u128: 16, i128: 16};

// 24-bit limbs, 4 base58 digits per step (58^4 < 2^24), so products stay below 2^53.
// About 5.6x faster than byte-at-a-time decoding (Node benchmark, Oct 31).
const LIMB = 16777216;
function b58decode(s) {
  const limbs = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    let mul = 1, add = 0;
    for (let k = 0; k < 4 && i < n; k++, i++) {
      const d = MAP[s[i]];
      if (d === undefined) return null;
      mul *= 58;
      add = add * 58 + d;
    }
    let carry = add;
    for (let j = 0; j < limbs.length; j++) {
      const x = limbs[j] * mul + carry;
      carry = Math.floor(x / LIMB);
      limbs[j] = x - carry * LIMB;
    }
    while (carry > 0) { const q = Math.floor(carry / LIMB); limbs.push(carry - q * LIMB); carry = q; }
  }
  const bytes = [];
  for (let j = 0; j < limbs.length; j++) {
    const v = limbs[j];
    bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255);
  }
  while (bytes.length && bytes[bytes.length - 1] === 0) bytes.pop();
  for (let k = 0; k < n && s[k] === '1'; k++) bytes.push(0);
  return bytes.reverse();
}

function b64(bytes, start, end) {
  let out = '';
  for (let i = start; i < end; i += 3) {
    const a = bytes[i], b = i + 1 < end ? bytes[i + 1] : 0, c = i + 2 < end ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < end ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < end ? B64[n & 63] : '=';
  }
  return out;
}

function keyAt(bytes, prefix) {
  if (prefix === null) return null;
  let pos = 16;
  for (const t of prefix) {
    if (t === 'string') {
      if (pos + 4 > bytes.length) return null;
      pos += 4 + (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24));
    } else {
      pos += SIZES[t];
    }
  }
  return pos + 32 <= bytes.length ? b64(bytes, pos, pos + 32) : null;
}

const bytes = data === null ? null : b58decode(data);
if (bytes === null || bytes.length < 16) return null;
for (let i = 0; i < 8; i++) if (bytes[i] !== TAG[i]) return null;
let disc = '';
for (let i = 8; i < 16; i++) disc += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
const spec = SPECS[disc];
if (spec === undefined) return null;
return {event: spec[0], key: keyAt(bytes, spec[1]), key2: keyAt(bytes, spec[2]), raw: b64(bytes, 0, bytes.length)};
"""


def udf_sql() -> str:
    js = UDF_JS.replace("__SPECS__", json.dumps(event_specs()))
    return (
        "CREATE TEMP FUNCTION pump_event(data STRING)\n"
        "RETURNS STRUCT<event STRING, key BYTES, key2 BYTES, raw BYTES>\n"
        f'LANGUAGE js AS r"""{js}""";\n'
    )


def day_sql() -> str:
    return udf_sql() + f"""
WITH kept AS (
  SELECT block_slot, UNIX_SECONDS(block_timestamp) AS block_time, tx_signature, `index` AS ix_index,
         program_id, pump_event(data) AS e
  FROM `{TABLE}`
  WHERE DATE(block_timestamp) = @day
    AND program_id IN UNNEST(@programs)
    AND parent_index IS NOT NULL
    AND LENGTH(data) >= {MIN_DATA_CHARS}
),
events AS (SELECT * FROM kept WHERE e IS NOT NULL),
-- BigQuery bills the scan once however many times `events` is referenced, but reruns the UDF
-- for each reference. So `events` is referenced exactly twice: once here, once at the end.
sets AS (
  SELECT
    ARRAY_AGG(DISTINCT IF(e.event = 'CreateEvent', e.key, NULL) IGNORE NULLS) AS launched,
    ARRAY_AGG(
      IF(e.event IN ('CompletePumpAmmMigrationEvent', 'CreatePoolEvent'), STRUCT(e.key AS mint, e.key2 AS pool), NULL)
      IGNORE NULLS
    ) AS graduated
  FROM events
),
wanted AS (
  SELECT DISTINCT k.key, k.kind
  FROM sets, UNNEST(ARRAY_CONCAT(
    ARRAY(SELECT AS STRUCT m AS key, 'mint' AS kind FROM UNNEST(sets.launched) AS m WHERE @include_new_launches),
    ARRAY(SELECT AS STRUCT m AS key, 'mint' AS kind FROM UNNEST(@mints) AS m),
    ARRAY(
      SELECT AS STRUCT g.pool AS key, 'pool' AS kind FROM UNNEST(sets.graduated) AS g
      WHERE (@include_new_launches AND g.mint IN UNNEST(sets.launched)) OR g.mint IN UNNEST(@mints)
    ),
    ARRAY(SELECT AS STRUCT p AS key, 'pool' AS kind FROM UNNEST(@pools) AS p)
  )) AS k
)
SELECT ev.block_slot, ev.block_time, ev.tx_signature, ev.ix_index, ev.program_id, ev.e.event AS event, ev.e.raw AS raw
FROM events AS ev
LEFT JOIN wanted AS w
  ON ev.e.key = w.key AND w.kind = IF(ev.e.event IN ('BuyEvent', 'SellEvent'), 'pool', 'mint')
WHERE ev.e.event = 'CreateEvent' OR w.key IS NOT NULL
"""


def _keys(addresses: list[str]) -> list[bytes]:
    return [base58.b58decode(a) for a in addresses]


def pull_day(
    bq: GuardedBigQuery,
    day: dt.date,
    *,
    mints: list[str] = (),
    pools: list[str] = (),
    include_new_launches: bool = True,
) -> pa.Table:
    """One day's kept events for the given mints and pools, plus that day's own launches."""
    params = [
        bigquery.ScalarQueryParameter("day", "DATE", day),
        bigquery.ArrayQueryParameter("programs", "STRING", [programs.PUMP, programs.PUMP_AMM]),
        bigquery.ArrayQueryParameter("mints", "BYTES", _keys(sorted(mints))),
        bigquery.ArrayQueryParameter("pools", "BYTES", _keys(sorted(pools))),
        bigquery.ScalarQueryParameter("include_new_launches", "BOOL", include_new_launches),
    ]
    return bq.query(day_sql(), params, label=f"pump-events-{day.isoformat()}")


def decode(raw: pa.Table) -> dict[str, list[events.Record]]:
    """Decode a pulled table into records grouped by type; undecodable rows are counted, not dropped silently."""
    out: dict[str, list] = {}
    failures = 0
    cols = raw.to_pydict()
    for i in range(raw.num_rows):
        ctx = events.Context(
            signature=cols["tx_signature"][i], slot=cols["block_slot"][i],
            block_time=cols["block_time"][i], index=cols["ix_index"][i],
        )
        try:
            record = events.decode(cols["program_id"][i], cols["raw"][i], ctx)
        except ValueError:
            failures += 1
            continue
        if record is not None:
            out.setdefault(type(record).__name__, []).append(record)
    out["_failures"] = failures
    return out

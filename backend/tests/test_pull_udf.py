"""Run the BigQuery UDF's JavaScript in Node and check it against the Python decoder."""

import base64
import json
import shutil
import subprocess

import base58
import pytest

from receipts.crypto import events, idl, programs, pull

MINT = "4aG7WqXQJEPA3DSfhQnfhfs9LFkjf4hEBTE537U9pump"
POOL = "GzAciVeYU1McB97d2R36JSysrGkBVYWH86vYSxxKdupo"
WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node to run the UDF")


def event_data(program_id: str, name: str, overrides: dict) -> bytes:
    spec = idl.load(program_id)
    values = {}
    for f in spec.types[name]["fields"]:
        t = f["type"]
        if t == "pubkey":
            values[f["name"]] = WALLET
        elif t == "string":
            values[f["name"]] = "x"
        elif t == "bool":
            values[f["name"]] = False
        elif isinstance(t, dict) and "vec" in t:
            values[f["name"]] = []
        else:
            values[f["name"]] = 7
    values |= overrides
    return events.EVENT_IX_TAG + spec.event_discriminators[name] + spec.encode_struct(name, values)


def run_udf(inputs: list[str | None]) -> list:
    body = pull.UDF_JS.replace("__SPECS__", json.dumps(pull.event_specs()))
    script = f"const f = (data) => {{ {body} }};\nconsole.log(JSON.stringify({json.dumps(inputs)}.map(f)));"
    return json.loads(subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True).stdout)


CASES = [
    (programs.PUMP, "CreateEvent", {"name": "Moon Dog", "symbol": "MOON", "uri": "https://example.com/" + "a" * 90, "mint": MINT}, MINT, None),
    (programs.PUMP, "TradeEvent", {"mint": MINT, "ix_name": "buy_v2"}, MINT, None),
    (programs.PUMP, "CompleteEvent", {"mint": MINT}, MINT, None),
    (programs.PUMP, "CompletePumpAmmMigrationEvent", {"mint": MINT, "pool": POOL}, MINT, POOL),
    (programs.PUMP_AMM, "BuyEvent", {"pool": POOL, "ix_name": "buy"}, POOL, None),
    (programs.PUMP_AMM, "SellEvent", {"pool": POOL}, POOL, None),
    (programs.PUMP_AMM, "CreatePoolEvent", {"base_mint": MINT, "pool": POOL}, MINT, POOL),
]


def test_udf_finds_the_same_keys_and_bytes_as_python():
    datas = [event_data(p, name, o) for p, name, o, _, _ in CASES]
    results = run_udf([base58.b58encode(d).decode() for d in datas])
    for (program_id, name, _, key, key2), data, got in zip(CASES, datas, results):
        assert got["event"] == name
        assert base64.b64decode(got["raw"]) == data
        assert base58.b58encode(base64.b64decode(got["key"])).decode() == key
        assert (got["key2"] and base58.b58encode(base64.b64decode(got["key2"])).decode()) == key2
        assert events.decode(program_id, data, events.Context("s", 1, 1, 0)) is not None


def test_udf_skips_what_it_should():
    other = idl.load(programs.PUMP).event_discriminators["ExtendAccountEvent"]
    inputs = [
        None,
        "",
        "0OIl",  # not base58
        base58.b58encode(bytes(40)).decode(),  # leading zeros, no event tag
        base58.b58encode(events.EVENT_IX_TAG + other + bytes(64)).decode(),  # an event we don't keep
    ]
    assert run_udf(inputs) == [None] * len(inputs)

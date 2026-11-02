"""The Meta Model API guard, against a fake API (no network, no spend)."""

import dataclasses
import datetime as dt
import json

import httpx
import pytest

from receipts.agent import meta
from receipts.config import settings

USAGE = {"input_tokens": 1200, "input_tokens_details": {"cached_tokens": 200}, "output_tokens": 300,
         "output_tokens_details": {"reasoning_tokens": 100}, "total_tokens": 1500}


class FakeAPI:
    def __init__(self, status=200, count=None):
        self.status = status
        self.count = count
        self.requests = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path.endswith("/responses/input_tokens"):
            return httpx.Response(200, json={"object": "response.input_tokens", "input_tokens": self.count})
        if self.status != 200:
            return httpx.Response(self.status, json={"error": {"message": "nope"}})
        body = json.loads(request.content)
        return httpx.Response(200, json={
            "id": "resp_1", "object": "response", "status": "completed", "model": body["model"],
            "output": [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "Rug chance: 80%"}]}],
            "usage": USAGE,
        })

    def calls(self, path="/v1/responses"):
        return [r for r in self.requests if r.url.path == path]


def client(tmp_path, api, *, enabled=True, contributor=True, now=dt.datetime(2026, 11, 2, tzinfo=dt.UTC)):
    s = dataclasses.replace(settings, data_dir=tmp_path, meta_api_enabled=enabled, meta_contributor=contributor,
                            model_api_key="test-key")
    m = meta.Meta(s, http=httpx.Client(transport=httpx.MockTransport(api)), now=lambda: now)
    m._last_call = -1e9
    return m


BODY = {"model": "muse-spark-1.3", "input": "Explain this token.", "max_output_tokens": 500}


def test_actual_cost_replaces_the_worst_case(tmp_path):
    api = FakeAPI()
    m = client(tmp_path, api)
    assert meta.text_of(m.respond(BODY, purpose="test")) == "Rug chance: 80%"
    sent = json.loads(api.calls()[0].content)
    assert sent["model"] == "muse-spark-1.3-contributor" and sent["stream"] is False
    expected = (1000 * 0.10 + 200 * 0.002 + 300 * 0.20) / 1e6
    assert m.spent() == pytest.approx(expected)
    entries = [json.loads(line) for line in m.ledger_path.read_text().splitlines()]
    assert [e["kind"] for e in entries] == ["reserve", "settle"]
    assert entries[0]["usd"] >= expected  # reserved at least what it cost


def test_repeat_requests_come_from_the_cache_even_when_switched_off(tmp_path):
    api = FakeAPI()
    client(tmp_path, api).respond(BODY, purpose="test")
    off = client(tmp_path, api, enabled=False)
    assert meta.text_of(off.respond(BODY, purpose="test")) == "Rug chance: 80%"
    assert len(api.calls()) == 1
    with pytest.raises(meta.MetaDisabled):
        off.respond({**BODY, "input": "Something new."}, purpose="test")
    assert len(api.calls()) == 1


def test_refuses_past_the_ledger_limit_without_calling(tmp_path):
    api = FakeAPI()
    m = client(tmp_path, api)
    m._log(call="old", kind="settle", model="muse-spark-1.3", purpose="earlier", usd=99.9999, cost=99.9999, usage=None)
    with pytest.raises(meta.BudgetExceeded):
        m.respond(BODY, purpose="test")
    assert api.requests == []


def test_refuses_after_the_credit_window(tmp_path):
    api = FakeAPI()
    m = client(tmp_path, api, now=meta.WINDOW_ENDS)
    with pytest.raises(meta.MetaDisabled):
        m.respond(BODY, purpose="test")
    assert api.requests == []


def test_rejected_calls_cost_nothing_and_server_errors_keep_the_worst_case(tmp_path):
    m = client(tmp_path / "a", FakeAPI(status=400))
    with pytest.raises(meta.MetaError):
        m.respond(BODY, purpose="test")
    assert m.spent() == 0
    m = client(tmp_path / "b", FakeAPI(status=500))
    with pytest.raises(meta.MetaError):
        m.respond(BODY, purpose="test")
    assert m.spent() > 0


def test_worst_case_prices_the_output_cap_and_searches(tmp_path):
    body = meta.Meta.request_body(client(tmp_path, FakeAPI()), {**BODY, "tools": [{"type": "web_search"}]})
    usd = meta.worst_case_usd(body["model"], 10_000, body)
    assert usd == pytest.approx((10_000 * 0.10 + 500 * 0.20) / 1e6 + 3 * meta.WEB_SEARCH_USD)


def test_media_is_counted_by_meta(tmp_path):
    api = FakeAPI(count=5_000)
    m = client(tmp_path, api)
    image = {"role": "user", "content": [{"type": "input_text", "text": "Read the mint."},
                                         {"type": "input_image", "image_url": "data:image/png;base64," + "A" * 400_000}]}
    m.respond({"model": "muse-spark-1.3", "input": [image], "max_output_tokens": 200}, purpose="test")
    assert len(api.calls("/v1/responses/input_tokens")) == 1
    reserve = json.loads(m.ledger_path.read_text().splitlines()[1])
    assert reserve["usd"] == pytest.approx(((5_000 + meta.SCAFFOLD_TOKENS) * 0.10 + 200 * 0.20) / 1e6)


def test_standard_model_when_contributor_is_off_and_unknown_models_refused(tmp_path):
    api = FakeAPI()
    m = client(tmp_path, api, contributor=False)
    m.respond(BODY, purpose="test")
    assert json.loads(api.calls()[0].content)["model"] == "muse-spark-1.3"
    with pytest.raises(meta.MetaError):
        m.respond({**BODY, "model": "muse-mystery"}, purpose="test")
    with pytest.raises(meta.MetaError):
        m.respond({**BODY, "previous_response_id": "resp_0"}, purpose="test")


def test_refuses_past_the_daily_cap(tmp_path):
    api = FakeAPI()
    m = client(tmp_path, api)
    m._log(call="old", kind="settle", model="muse-spark-1.3", purpose="earlier today", usd=9.9999, cost=9.9999, usage=None)
    with pytest.raises(meta.BudgetExceeded, match="a day"):
        m.respond(BODY, purpose="test")
    assert api.requests == []
    tomorrow = client(tmp_path, api, now=dt.datetime(2026, 11, 3, tzinfo=dt.UTC))
    tomorrow.respond(BODY, purpose="test")  # a new day, well under the total
    assert len(api.calls()) == 1

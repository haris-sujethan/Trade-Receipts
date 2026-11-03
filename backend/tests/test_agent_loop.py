"""The rug check agent's loop against a scripted fake Meta API (no network, no spend)."""

import dataclasses
import datetime as dt
import json

import httpx

from receipts.agent import loop, meta
from receipts.config import settings

MINT = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
USAGE = {"input_tokens": 100, "input_tokens_details": {"cached_tokens": 0}, "output_tokens": 50,
         "output_tokens_details": {"reasoning_tokens": 0}, "total_tokens": 150}


def reply(output):
    return httpx.Response(200, json={"id": "r", "object": "response", "status": "completed", "output": output, "usage": USAGE})


def message(text):
    return [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}]


class Script:
    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.bodies = []

    def __call__(self, request):
        self.bodies.append(json.loads(request.content))
        return reply(self.outputs.pop(0))


def client(tmp_path, script):
    s = dataclasses.replace(settings, data_dir=tmp_path, meta_api_enabled=True, model_api_key="test-key")
    m = meta.Meta(s, http=httpx.Client(transport=httpx.MockTransport(script)), now=lambda: dt.datetime(2026, 11, 2, tzinfo=dt.UTC))
    m._last_call = -1e9
    return m


def fake_check(self, mint):
    return {"mint": mint, "status": "scored", "verdict": "Likely rug", "rug_chance": "91%",
            "signals": ["Team: 4 wallets; hold 8.1% now, 14.5% at peak; sold 44.0% of peak holdings"]}


def run(tmp_path, monkeypatch, script):
    monkeypatch.setattr(loop.Run, "check_token", fake_check)
    monkeypatch.setattr(loop.audit, "LOG", tmp_path / "audit.jsonl")
    events = []
    answer = loop.run(f"Is {MINT} a rug?", emit=events.append, client=client(tmp_path, script))
    return answer, events


def test_tools_then_an_audited_answer(tmp_path, monkeypatch):
    script = Script(
        [{"type": "function_call", "call_id": "c1", "name": "check_token", "arguments": json.dumps({"mint": MINT})}],
        message("Likely rug · 91% rug chance. The team holds 8.1% now and sold 44.0% of its peak holdings."),
    )
    answer, events = run(tmp_path, monkeypatch, script)
    assert answer["audit"] == {"numbers": 3, "passed": True, "first_try_passed": True, "unverified": []}
    assert answer["text"].endswith(loop.NOT_ADVICE)
    assert [e["status"] for e in events if e["type"] == "step"] == ["running", "done"]
    sent = script.bodies[1]["input"]
    assert sent[-1]["type"] == "function_call_output" and json.loads(sent[-1]["output"])["rug_chance"] == "91%"
    assert script.bodies[0]["model"] == "muse-spark-1.3-contributor"


def test_an_invented_number_gets_one_rewrite_then_is_marked(tmp_path, monkeypatch):
    script = Script(
        [{"type": "function_call", "call_id": "c1", "name": "check_token", "arguments": json.dumps({"mint": MINT})}],
        message("Likely rug · 91% rug chance. The team holds 30% of supply."),
        message("Likely rug · 91% rug chance. The team holds 30% of supply."),
    )
    answer, _ = run(tmp_path, monkeypatch, script)
    assert len(script.bodies) == 3 and "30%" in script.bodies[2]["input"][-1]["content"]
    assert answer["audit"]["unverified"] == ["30%"]
    assert "[[unverified:30%]]" in answer["text"]


def test_with_meta_off_the_check_still_runs_and_shows_its_findings(tmp_path, monkeypatch):
    script = Script()
    s = dataclasses.replace(settings, data_dir=tmp_path, meta_api_enabled=False, model_api_key="test-key")
    off = meta.Meta(s, http=httpx.Client(transport=httpx.MockTransport(script)))
    monkeypatch.setattr(loop.Run, "check_token", lambda self, mint: {
        "mint": mint, "symbol": "MOON", "status": "scored", "verdict": "Likely rug", "rug_chance": "91%", "age": "15m",
        "signals": ["Team: 4 wallets; hold 8.1% now", "Chart: 12 one-minute candles"]})
    monkeypatch.setattr(loop.Run, "token_security", lambda self, mint: {
        "source": "Powered by GoPlus", "new tokens can be minted": "no", "holders' accounts can be frozen": "no"})
    monkeypatch.setattr(loop.audit, "LOG", tmp_path / "audit.jsonl")
    events = []
    answer = loop.run(f"is this a rug? pump.fun/coin/{MINT}", emit=events.append, client=off)
    assert script.bodies == []  # no Meta call
    assert answer["explained_by"] is None and answer["audit"]["passed"]
    assert "MOON: Likely rug · 91% rug chance" in answer["text"] and "Team: 4 wallets" in answer["text"]
    assert "Chart:" not in answer["text"] and answer["text"].endswith(loop.NOT_ADVICE)
    assert any(e["type"] == "notice" for e in events)


def test_follow_ups_send_the_conversation_so_far(tmp_path, monkeypatch):
    script = Script(message("Which one do you mean?"))
    history = [{"role": "user", "text": "is $MOON a rug?"}, {"role": "assistant", "text": "I found 3 tokens named MOON."}]
    monkeypatch.setattr(loop.audit, "LOG", tmp_path / "audit.jsonl")
    loop.run("the first one", emit=lambda e: None, client=client(tmp_path, script), history=history)
    sent = script.bodies[0]["input"]
    assert [i["role"] for i in sent] == ["user", "assistant", "user"] and sent[1]["content"] == "I found 3 tokens named MOON."

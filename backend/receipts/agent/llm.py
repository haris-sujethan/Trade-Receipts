"""The agent's model, on the visitor's own API key (OpenAI or Anthropic).

The key comes with each request and is used for that request only: it's never stored, logged or
cached here. Both providers are driven through one shape, the Responses API's (`instructions`,
`input` items, function tools, `output` items), which OpenAI takes as is and which is translated
for Anthropic's Messages API below.

    LLM(provider, key, model).respond(body) -> {"status": ..., "output": [...]}
"""

import json
from dataclasses import dataclass

import anthropic
import httpx

PROVIDERS = ("openai", "anthropic")
DEFAULT_MODEL = {"openai": "gpt-5", "anthropic": "claude-opus-5-5"}
OPENAI_URL = "https://api.openai.com/v1/responses"
# Anthropic models think before answering; their output cap has to leave room for it.
ANTHROPIC_MAX_TOKENS = 16_000
# Models that take the server-side refusal fallback.
FALLBACK_MODELS = ("claude-opus-5", "claude-sonnet-5-5", "claude-fable-5")
EFFORT = {"minimal": "low", "low": "low", "medium": "medium", "high": "high"}


class NoModel(RuntimeError):
    """No key was given, so the check runs without a written explanation."""


class LLMError(RuntimeError):
    pass


@dataclass
class LLM:
    provider: str
    key: str
    model: str
    http: httpx.Client | None = None

    @classmethod
    def from_request(cls, provider: str | None, key: str | None, model: str | None) -> "LLM":
        if not key or provider not in PROVIDERS:
            raise NoModel("Add an OpenAI or Anthropic key in Settings for written explanations.")
        return cls(provider, key, (model or "").strip() or DEFAULT_MODEL[provider])

    @property
    def name(self) -> str:
        return self.model

    def respond(self, body: dict) -> dict:
        return self._openai(body) if self.provider == "openai" else self._anthropic(body)

    # OpenAI: the Responses API as is.

    def _openai(self, body: dict) -> dict:
        body = {k: v for k, v in body.items() if k != "model"} | {"model": self.model, "store": False}
        body["input"] = [_public(i) for i in body.get("input", [])]
        # Only reasoning models take a reasoning effort.
        if not self.model.startswith(("gpt-5", "o")):
            body.pop("reasoning", None)
        http = self.http or httpx.Client(timeout=120)
        reply = http.post(OPENAI_URL, headers={"Authorization": f"Bearer {self.key}"}, json=body)
        if reply.status_code == 401:
            raise LLMError("OpenAI rejected the API key. Check it in Settings.")
        if reply.status_code != 200:
            raise LLMError(f"OpenAI {reply.status_code}: {reply.text[:300]}")
        return reply.json()

    # Anthropic: translated to and from the Messages API.

    def _anthropic(self, body: dict) -> dict:
        client = anthropic.Anthropic(api_key=self.key, max_retries=2)
        request = {
            "model": self.model,
            "max_tokens": ANTHROPIC_MAX_TOKENS,
            "messages": _messages(body.get("input", [])),
        }
        if body.get("instructions"):
            request["system"] = body["instructions"]
        if body.get("tools"):
            request["tools"] = [{"name": t["name"], "description": t.get("description", ""), "input_schema": t["parameters"]}
                                for t in body["tools"]]
        config = {}
        if effort := EFFORT.get((body.get("reasoning") or {}).get("effort", "")):
            config["effort"] = effort
        fmt = (body.get("text") or {}).get("format")
        if fmt and fmt.get("type") == "json_schema":
            config["format"] = {"type": "json_schema", "schema": fmt["schema"]}
        if config:
            request["output_config"] = config
        try:
            if self.model.startswith(FALLBACK_MODELS):
                # A safety decline is retried on a fallback model inside the same call.
                message = client.beta.messages.create(**request, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
            else:
                message = client.messages.create(**request)
        except anthropic.AuthenticationError:
            raise LLMError("Anthropic rejected the API key. Check it in Settings.") from None
        except anthropic.APIStatusError as e:
            raise LLMError(f"Anthropic {e.status_code}: {e.message[:300]}") from None
        except anthropic.APIConnectionError:
            raise LLMError("Couldn't reach Anthropic. Try again.") from None
        raw = [b.model_dump(mode="json", exclude_none=True) for b in message.content]
        text = "".join(b.text for b in message.content if b.type == "text")
        # The assistant turn goes back verbatim (thinking blocks included); the function calls ride inside it.
        output = [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}], "_raw": raw}]
        output += [{"type": "function_call", "call_id": b.id, "name": b.name, "arguments": json.dumps(b.input), "_in_raw": True}
                   for b in message.content if b.type == "tool_use"]
        done = message.stop_reason in ("end_turn", "tool_use", "stop_sequence")
        return {"status": "completed" if done else "incomplete", "output": output}


def _public(item: dict) -> dict:
    """An input item without this module's own bookkeeping keys."""
    return {k: v for k, v in item.items() if not k.startswith("_")}


def _content(content) -> list[dict] | str:
    """Responses-style user content as Messages content blocks."""
    if isinstance(content, str):
        return content
    blocks = []
    for part in content:
        if part.get("type") == "input_text":
            blocks.append({"type": "text", "text": part["text"]})
        elif part.get("type") == "input_image":
            header, _, data = part["image_url"].partition(",")
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": header[5:].split(";")[0], "data": data}})
    return blocks


def _messages(items: list[dict]) -> list[dict]:
    """Responses input items as Messages API messages. Consecutive turns of one role are merged."""
    out: list[dict] = []

    def add(role: str, content):
        blocks = [{"type": "text", "text": content}] if isinstance(content, str) else content
        if out and out[-1]["role"] == role:
            out[-1]["content"] += blocks
        else:
            out.append({"role": role, "content": list(blocks)})

    for item in items:
        if item.get("_in_raw"):
            continue  # already part of its assistant turn
        if item.get("type") == "message" and "_raw" in item:
            add("assistant", item["_raw"])
        elif item.get("type") == "function_call":
            add("assistant", [{"type": "tool_use", "id": item["call_id"], "name": item["name"],
                               "input": json.loads(item.get("arguments") or "{}")}])
        elif item.get("type") == "function_call_output":
            add("user", [{"type": "tool_result", "tool_use_id": item["call_id"], "content": item["output"]}])
        elif item.get("role") in ("user", "assistant"):
            add(item["role"], _content(item["content"]))
    return out


def text_of(response: dict) -> str:
    """The assistant's text from a response's message items."""
    return "".join(part.get("text", "") for item in response.get("output") or [] if item.get("type") == "message"
                   for part in item.get("content") or [] if part.get("type") == "output_text")

"""The one way the app calls the Meta Model API (SPEC.md 12).

The builder's card is on file, Meta has no hard cap (its spend limit only emails), and the $150
credits end with the hackathon, so going over charges the card. Every call:
- is served from the cache when the same request was made before: free, and it works with the
  API switched off, which is how the judged deployment shows its cached demo results;
- is refused unless META_API_ENABLED is on and the credit window hasn't ended;
- is priced before it's sent (its input counted, its output at the cap it's sent with) and
  refused once the ledger plus the calls in flight would pass LEDGER_LIMIT_USD, or once today's
  spend would pass DAILY_LIMIT_USD (a loop gone wrong stops at a day's cap, not the whole budget);
- is logged to `data/ledger/meta.jsonl` with the usage Meta reports.

While META_CONTRIBUTOR is on (the default), Muse Spark requests go to the contributor model: the
same model at a twelfth of the price, and Meta may train on what it's sent. Use it for public
chain data and the builder's own clips, never for visitors' uploads.
"""

import datetime as dt
import fcntl
import hashlib
import json
import pathlib
import sqlite3
import time
import uuid
from contextlib import contextmanager

import httpx

from receipts.config import Settings, settings as default_settings

BASE_URL = "https://api.meta.ai/v1"

# dev.meta.ai/docs/pricing-rate-limits (Nov 1, 2026), USD per million tokens: cached input, input, output.
PRICES = {
    "muse-spark-1.3": (0.15, 1.25, 4.25),
    "muse-spark-1.2": (0.15, 1.25, 4.25),
    "muse-spark-1.1": (0.15, 1.25, 4.25),
    "muse-spark-1.3-contributor": (0.002, 0.10, 0.20),
    "muse-spark-1.2-contributor": (0.002, 0.10, 0.20),
    "muse-wonder-1.0": (0.20, 4.00, 20.00),
}
CONTRIBUTOR = {"muse-spark-1.3": "muse-spark-1.3-contributor", "muse-spark-1.2": "muse-spark-1.2-contributor"}
WEB_SEARCH_USD = 2.50 / 1000  # per search query, on top of tokens

# Refuse at $100 of the $150: margin for estimation error and billing lag.
LEDGER_LIMIT_USD = 100.0
# Expected use is a few dollars in all (an agent run on the contributor model costs under a cent).
DAILY_LIMIT_USD = 10.0
# The credits end with the hackathon, Nov 4 at 9 PM Eastern (user, Nov 1); every later call is charged.
WINDOW_ENDS = dt.datetime(2026, 11, 5, 2, 0, tzinfo=dt.UTC)

DEFAULT_MAX_OUTPUT = 4096
DEFAULT_MAX_TOOL_CALLS = 3
# Used only when the token-count endpoint can't count a request with media in it.
FALLBACK_TOKENS = {"input_image": 3_000, "input_file": 30_000, "input_video": 100_000, "input_audio": 30_000}
CHARS_PER_TOKEN = 3  # text estimate; real text runs nearer 4, so this overestimates
SCAFFOLD_TOKENS = 1_000  # server-injected prompt scaffolding
MIN_INTERVAL = 0.45  # the contributor model allows 150 requests a minute


class MetaDisabled(RuntimeError):
    """The API is switched off, the key is missing, or the credit window has ended."""


class BudgetExceeded(RuntimeError):
    pass


class MetaError(RuntimeError):
    pass


def _media_parts(value) -> list[str]:
    """The types of every media part anywhere in a request's input."""
    found = []
    if isinstance(value, dict):
        if value.get("type") in FALLBACK_TOKENS:
            found.append(value["type"])
        for v in value.values():
            found += _media_parts(v)
    elif isinstance(value, list):
        for v in value:
            found += _media_parts(v)
    return found


def _strip_media(value):
    """The request with inline media data removed, for a text-only size estimate."""
    if isinstance(value, dict):
        if value.get("type") in FALLBACK_TOKENS:
            return {"type": value["type"]}
        return {k: _strip_media(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_strip_media(v) for v in value]
    return value


def text_tokens(body: dict) -> int:
    text = json.dumps(_strip_media({k: body.get(k) for k in ("instructions", "input", "tools", "text")}))
    return len(text) // CHARS_PER_TOKEN + SCAFFOLD_TOKENS


def searches_allowed(body: dict) -> int:
    if any(t.get("type", "").startswith("web_search") for t in body.get("tools") or []):
        return int(body.get("max_tool_calls") or DEFAULT_MAX_TOOL_CALLS)
    return 0


def worst_case_usd(model: str, input_tokens: int, body: dict) -> float:
    """The most a request can cost: all input uncached, output at its cap, every search used."""
    _, input_price, output_price = PRICES[model]
    return (input_tokens * input_price + body["max_output_tokens"] * output_price) / 1e6 + searches_allowed(body) * WEB_SEARCH_USD


def actual_usd(model: str, response: dict) -> float | None:
    usage = response.get("usage")
    if not usage:
        return None
    cached_price, input_price, output_price = PRICES[model]
    cached = (usage.get("input_tokens_details") or {}).get("cached_tokens", 0)
    tokens = ((usage["input_tokens"] - cached) * input_price + cached * cached_price + usage["output_tokens"] * output_price) / 1e6
    searches = sum(1 for item in response.get("output") or [] if item.get("type") == "web_search_call")
    return tokens + searches * WEB_SEARCH_USD


class Meta:
    def __init__(self, settings: Settings = default_settings, http: httpx.Client | None = None,
                 now=lambda: dt.datetime.now(dt.UTC)):
        self.settings = settings
        self.http = http or httpx.Client(timeout=300)
        self.now = now
        self.ledger_path = settings.data_dir / "ledger" / "meta.jsonl"
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path = settings.data_dir / "cache" / "meta.sqlite"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache = sqlite3.connect(cache_path, check_same_thread=False)
        self.cache.execute("CREATE TABLE IF NOT EXISTS responses (key TEXT PRIMARY KEY, at TEXT, purpose TEXT, response TEXT)")
        self._last_call = 0.0

    # The ledger

    def spent(self, day: str | None = None) -> float:
        """Everything logged (or logged on `day`, YYYY-MM-DD UTC), including calls in flight at
        their worst case."""
        if not self.ledger_path.exists():
            return 0.0
        entries = (json.loads(line) for line in self.ledger_path.read_text().splitlines() if line)
        return sum(e["usd"] for e in entries if day is None or e["at"].startswith(day))

    @contextmanager
    def _locked(self):
        with open(self.ledger_path.with_suffix(".lock"), "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)

    def _log(self, **entry) -> None:
        entry = {"at": self.now().isoformat(timespec="seconds"), **entry}
        with self.ledger_path.open("a") as f:
            f.write(json.dumps(entry) + "\n")

    def _reserve(self, model: str, usd: float, purpose: str) -> str:
        """Count a call at its worst case before it's sent, or refuse it."""
        with self._locked():
            spent = self.spent()
            if spent + usd > LEDGER_LIMIT_USD:
                raise BudgetExceeded(
                    f"Meta API: this call could cost ${usd:.4f}, and ${spent:.2f} is already logged; "
                    f"calls stop at ${LEDGER_LIMIT_USD:.0f} of the $150 credits")
            today = self.spent(self.now().strftime("%Y-%m-%d"))
            if today + usd > DAILY_LIMIT_USD:
                raise BudgetExceeded(
                    f"Meta API: this call could cost ${usd:.4f}, and ${today:.2f} is already logged today; "
                    f"calls stop at ${DAILY_LIMIT_USD:.0f} a day")
            call = uuid.uuid4().hex[:12]
            self._log(call=call, kind="reserve", model=model, purpose=purpose, usd=usd)
            return call

    def _settle(self, call: str, model: str, reserved: float, actual: float, usage: dict | None, purpose: str) -> None:
        """Replace a call's worst case with what it actually cost."""
        with self._locked():
            self._log(call=call, kind="settle", model=model, purpose=purpose, usd=actual - reserved,
                      cost=actual, usage=usage)

    # Calls

    def _check_open(self) -> None:
        if not self.settings.meta_api_enabled:
            raise MetaDisabled("Meta API is off (META_API_ENABLED); only cached responses are available")
        if self.now() >= WINDOW_ENDS:
            raise MetaDisabled("Meta API credits ended on Nov 4; only cached responses are available")
        if not self.settings.model_api_key:
            raise MetaDisabled("MODEL_API_KEY is not set in .env")

    def _post(self, path: str, **kwargs) -> httpx.Response:
        wait = self._last_call + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        headers = {"Authorization": f"Bearer {self.settings.model_api_key}"}
        for attempt in range(4):
            self._last_call = time.monotonic()
            reply = self.http.post(f"{BASE_URL}{path}", headers=headers, **kwargs)
            if reply.status_code != 429:
                return reply
            time.sleep(float(reply.headers.get("retry-after") or 2**attempt))
        return reply

    def resolve_model(self, model: str) -> str:
        if self.settings.meta_contributor:
            model = CONTRIBUTOR.get(model, model)
        if model not in PRICES:
            raise MetaError(f"no price for {model}; add it to PRICES before calling it")
        return model

    def request_body(self, body: dict) -> dict:
        """The request as it will be sent: the routed model, a capped output, no streaming."""
        if body.get("previous_response_id") or body.get("conversation"):
            raise MetaError("server-side history can't be priced before sending; resend the input instead")
        if body.get("stream") or body.get("background"):
            raise MetaError("streaming and background responses aren't supported by the guarded client")
        body = {**body, "model": self.resolve_model(body["model"]), "stream": False}
        body.setdefault("max_output_tokens", DEFAULT_MAX_OUTPUT)
        if searches_allowed(body):
            body.setdefault("max_tool_calls", DEFAULT_MAX_TOOL_CALLS)
        return body

    def cache_key(self, body: dict) -> str:
        return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()

    def cached(self, body: dict) -> dict | None:
        row = self.cache.execute("SELECT response FROM responses WHERE key = ?", (self.cache_key(self.request_body(body)),)).fetchone()
        return json.loads(row[0]) if row else None

    def input_tokens(self, body: dict) -> int:
        """Text is estimated locally; requests with media are counted by Meta (no response generated)."""
        media = _media_parts(body.get("input"))
        if not media:
            return text_tokens(body)
        count = {k: body[k] for k in ("model", "input", "instructions", "tools", "text") if body.get(k) is not None}
        try:
            reply = self._post("/responses/input_tokens", json=count)
            self._log(call=None, kind="count", model=body["model"], purpose="count input tokens", usd=0.0)
            if reply.status_code == 200 and isinstance(reply.json().get("input_tokens"), int):
                return reply.json()["input_tokens"] + SCAFFOLD_TOKENS
        except httpx.HTTPError:
            pass
        return text_tokens(body) + sum(FALLBACK_TOKENS[m] for m in media)

    def respond(self, body: dict, *, purpose: str) -> dict:
        """POST /v1/responses through the guard. `purpose` is logged with the cost."""
        body = self.request_body(body)
        key = self.cache_key(body)
        row = self.cache.execute("SELECT response FROM responses WHERE key = ?", (key,)).fetchone()
        if row:
            return json.loads(row[0])
        self._check_open()
        model = body["model"]
        reserved = worst_case_usd(model, self.input_tokens(body), body)
        call = self._reserve(model, reserved, purpose)
        # A network error leaves the worst case logged: the call may have run.
        reply = self._post("/responses", json=body)
        if 400 <= reply.status_code < 500:
            self._settle(call, model, reserved, 0.0, None, purpose)  # rejected, not billed
            raise MetaError(f"Meta API {reply.status_code}: {reply.text[:500]}")
        if reply.status_code != 200:
            raise MetaError(f"Meta API {reply.status_code}: {reply.text[:500]}")  # worst case stays logged
        response = reply.json()
        cost = actual_usd(model, response)
        self._settle(call, model, reserved, reserved if cost is None else cost, response.get("usage"), purpose)
        if response.get("status") == "completed":
            self.cache.execute("INSERT OR REPLACE INTO responses VALUES (?, ?, ?, ?)",
                               (key, self.now().isoformat(timespec="seconds"), purpose, json.dumps(response)))
            self.cache.commit()
        return response

    def upload(self, path: pathlib.Path, *, purpose: str = "user_data") -> str:
        """Upload a file (a clip) for a later request; returns its file id. Uploads are free."""
        self._check_open()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        key = f"file:{digest}:{purpose}"
        row = self.cache.execute("SELECT response FROM responses WHERE key = ?", (key,)).fetchone()
        if row:
            return json.loads(row[0])["id"]
        with path.open("rb") as f:
            reply = self._post("/files", data={"purpose": purpose}, files={"file": (path.name, f)})
        self._log(call=None, kind="upload", model=None, purpose=f"upload {path.name}", usd=0.0)
        if reply.status_code != 200:
            raise MetaError(f"Meta API upload {reply.status_code}: {reply.text[:500]}")
        file = reply.json()
        self.cache.execute("INSERT OR REPLACE INTO responses VALUES (?, ?, ?, ?)",
                           (key, self.now().isoformat(timespec="seconds"), "upload", json.dumps(file)))
        self.cache.commit()
        return file["id"]

    def report(self) -> dict:
        """What's been spent, by model and purpose, and what's left before the guard stops calls."""
        entries = [json.loads(line) for line in self.ledger_path.read_text().splitlines() if line] if self.ledger_path.exists() else []
        settled = [e for e in entries if e["kind"] == "settle"]
        reserved = {e["call"] for e in entries if e["kind"] == "reserve"}
        open_calls = reserved - {e["call"] for e in settled}
        by = {}
        for e in settled:
            k = f'{e["model"]} · {e["purpose"]}'
            by[k] = round(by.get(k, 0.0) + e["cost"], 6)
        return {"logged_usd": round(self.spent(), 6), "limit_usd": LEDGER_LIMIT_USD,
                "today_usd": round(self.spent(self.now().strftime("%Y-%m-%d")), 6), "daily_limit_usd": DAILY_LIMIT_USD,
                "calls": len(settled),
                "unsettled_calls": len(open_calls), "by_model_and_purpose": by,
                "enabled": self.settings.meta_api_enabled, "window_ends": WINDOW_ENDS.isoformat()}


def text_of(response: dict) -> str:
    """The assistant's text from a response's message items."""
    return "".join(part.get("text", "") for item in response.get("output") or [] if item.get("type") == "message"
                   for part in item.get("content") or [] if part.get("type") == "output_text")

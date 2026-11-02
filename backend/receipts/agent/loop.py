"""The rug check agent (SPEC.md 8.1): Muse Spark reads the request (a mint, or a screenshot of
one), calls the tools, and explains the evidence in plain language. It never computes a number
itself: every number it writes must pass the numbers audit against this run's tool outputs.

Every Meta call goes through the guarded client (meta.py), so a repeat of the same check is
served from its cache. To keep repeats identical, tool outputs carry no timings or credit counts.

    run(message, image=None, emit=print) -> the answer event

Events for the thread (server-sent events, SPEC.md 8.3):
    {"type": "step", "tool": ..., "status": "running" | "done" | "error", "summary": ..., "ms": ...}
    {"type": "answer", "text": ..., "audit": {...}, "check": {...}}
"""

import base64
import hashlib
import json
import math
import time
import uuid

import base58

from receipts.agent import audit, meta
from receipts.config import settings
from receipts.crypto import copycats, live, prompt
from receipts.crypto.goplus import CREDIT as GOPLUS_CREDIT, GoPlus

MODEL = "muse-spark-1.3"
UPLOADS = settings.data_dir / "uploads"  # clips sent to the agent (gitignored with data/)
MAX_ROUNDS = 6
MAX_OUTPUT = 1500
NOT_ADVICE = "Not financial advice."
# Constants the product states, which the explanation may cite (audit `allowed`).
CONSTANTS = (24, 10, 50, 1, 99, 4)
# Past rugs need other tokens' outcomes, which a live check doesn't fetch (live.py): shown as n/a.
NOT_CHECKED_LIVE = ("creator_rugs_24h", "group_rugs_24h", "group_launches_24h", "team_recycled_wallets",
                    "recycled_wallets", "recycled_supply_share")

SYSTEM = f"""You are the rug check in Trade Receipts. You check new pump.fun tokens on Solana for the chance that their team rugs: sells its supply into buyers.

How to work:
- Get the token's mint. If the user sent a screenshot or clip, call read_address on it. If they gave only a name or ticker, call find_token, list the tokens it finds with their age, market cap and holders, and ask which one they mean. Never pick one for them.
- Call check_token with the mint. Call token_security as a cross-check.
- Then explain in plain, short sentences what the evidence shows: the verdict and rug chance first, then the 2 to 4 signals that matter most, with their numbers. If check_token has a second opinion from Muse Glimmer, give its rug chance and say whether it agrees.

Rules:
- Never compute, estimate or convert a number. Use only numbers that appear in tool results, written as they appear there.
- Facts and flags, never advice: never say buy, sell or hold, and never call a token safe. A low rug chance means fewer of the warning signs past rugs showed, nothing more.
- Describe wallets, not people. No names, no accusations.
- Say "token", not "coin".
- If check_token says the token is below the activity floor, already rugged, or older than a day, say so plainly instead of giving a rug chance.
- End with: {NOT_ADVICE}"""

TOOLS = [
    {"type": "function", "name": "check_token",
     "description": "Live rug check of a pump.fun token from on-chain data: its trades, the wallets that bought and hold it, "
                    "who funded them, the team, snipers and bots, every signal, and the rug chance with its verdict.",
     "parameters": {"type": "object", "properties": {"mint": {"type": "string", "description": "the token's mint address"}},
                    "required": ["mint"], "additionalProperties": False}},
    {"type": "function", "name": "token_security",
     "description": "Mint, freeze and other authority fields for a token, from GoPlus. A cross-check: on pump.fun they're usually revoked.",
     "parameters": {"type": "object", "properties": {"mint": {"type": "string"}}, "required": ["mint"], "additionalProperties": False}},
    {"type": "function", "name": "find_token",
     "description": "Find pump.fun tokens by ticker or name, the most active first, with their age, market cap and holders.",
     "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "a ticker or name"}},
                    "required": ["query"], "additionalProperties": False}},
    {"type": "function", "name": "read_address",
     "description": "Read the token mint address, ticker and any claims (such as 'dev doxxed' or a market cap) from the screenshot "
                    "or clip the user sent. For a clip, each claim comes with when it was shown or said.",
     "parameters": {"type": "object", "properties": {}, "additionalProperties": False}},
]

ADDRESS_SCHEMA = {
    "type": "object",
    "properties": {
        "mint": {"type": ["string", "null"], "description": "the Solana mint address exactly as shown, or null"},
        "ticker": {"type": ["string", "null"]},
        "claims": {"type": "array", "description": "claims made about the token, quoted",
                   "items": {"type": "object", "properties": {
                       "quote": {"type": "string"},
                       "at_s": {"type": ["number", "null"], "description": "seconds into the clip; null for a screenshot"}},
                       "required": ["quote", "at_s"], "additionalProperties": False}},
    },
    "required": ["mint", "ticker", "claims"], "additionalProperties": False,
}


def valid_mint(mint: str) -> bool:
    try:
        return len(base58.b58decode(mint)) == 32
    except ValueError:
        return False


class Run:
    def __init__(self, client: meta.Meta | None = None, emit=print, image: bytes | None = None, image_type: str = "image/png",
                 as_of: int | None = None, video: bytes | None = None):
        self.meta = client or meta.Meta()
        self.as_of = as_of  # check tokens as they stood at this time (the demo's past tokens); default now
        self.emit = emit
        self.image = image
        self.image_type = image_type
        self.video = video  # an mp4 clip
        self.outputs: list = []  # every tool output, for the numbers audit
        self.check: dict | None = None
        self.id = uuid.uuid4().hex[:12]

    # Tools

    def check_token(self, mint: str) -> dict:
        if not valid_mint(mint):
            return {"error": f"{mint} isn't a valid Solana address"}
        c = live.Check(mint, as_of=self.as_of, progress=lambda **kv: self.emit({"type": "progress", "tool": "check_token", **kv}))
        try:
            result = c.run()
        except live.NotPumpFun:
            return {"error": "No pump.fun launch was found for this mint. The rug check covers pump.fun tokens only."}
        self.check = result
        out = {k: result[k] for k in ("mint", "name", "symbol", "status", "age_s") if k in result}
        out["age"] = prompt._secs(result["age_s"])
        if result["status"] == "rugged":
            out["rugged_after"] = prompt._secs(result["rug_age_s"])
        if result["status"] == "scored":
            out["verdict"] = result["verdict"]
            out["rug_chance"] = f"{round(100 * result['trees_rug_chance'])}%"
            out["model"] = "gradient-boosted trees on the token's signals, calibrated on held-out launches"
            if result.get("glimmer"):
                out["second_opinion"] = {"model": result["glimmer"]["model"],
                                         "rug_chance": f"{round(100 * result['glimmer']['rug_chance'])}%",
                                         "its_reasons": result["glimmer"]["reasons"]}
        if getattr(c, "token_view", None):
            sig = dict(c.token_view[1])
            for k in NOT_CHECKED_LIVE:
                sig[k] = math.nan
            out["signals"] = prompt.signal_lines(sig)
            out["not_checked_live"] = "Past rugs by these wallets and the creator's group aren't checked in a live check yet (shown as n/a)."
        if result.get("similar"):
            out["similar_past_tokens"] = [
                f"{x['ended']}" + (f" {prompt._secs(x['rugged_after_s'])} after launch" if x["rugged_after_s"] else "")
                + f"; market cap {prompt._sol(x['mcap_sol'])}; {x['holders']} holders" for x in result["similar"]]
        if result.get("copycats", {}).get("total"):
            cc = result["copycats"]
            out["copycats"] = (f"{cc['total']} other tokens used this ticker or name in the week before. The most active: "
                               + "; ".join(f"{x['symbol']} ({x['mint']}): {prompt._secs(x['age_s'])} old, "
                                           + (f"market cap {prompt._sol(x['mcap_sol'])}, {x['holders']} holders" if x["mcap_sol"] is not None else "little activity")
                                           for x in cc["tokens"]))
        if result["gaps"]:
            out["partial"] = "Some busy wallets' history was read only in part."
        return out

    def find_token(self, query: str) -> dict:
        when = self.as_of or int(time.time())
        if not copycats.covered(when):
            return {"error": "Name search covers launches through mid-September 2026 for now. Ask the user for the token's mint address."}
        found = copycats.search(query, when)
        if not found["total"]:
            return {"error": f"No pump.fun token named {query} launched in the week before. Ask for the mint address."}
        return {"found": found["total"], "most_active": [
            f"{x['name']} ({x['symbol']}), mint {x['mint']}: {prompt._secs(x['age_s'])} old, "
            + (f"market cap {prompt._sol(x['mcap_sol'])}, {x['holders']} holders" if x["mcap_sol"] is not None else "little activity")
            for x in found["tokens"]]}

    def token_security(self, mint: str) -> dict:
        if not valid_mint(mint):
            return {"error": f"{mint} isn't a valid Solana address"}
        result = GoPlus().token_security(mint) or {}
        if not result:
            return {"error": "GoPlus has no security data for this token yet."}

        def can(field: str) -> str:
            status = (result.get(field) or {}).get("status")
            return {"0": "no", "1": "yes"}.get(status, "unknown")

        return {
            "source": GOPLUS_CREDIT,
            "new tokens can be minted": can("mintable"),
            "holders' accounts can be frozen": can("freezable"),
            "the token can be closed": can("closable"),
            "name and image can be changed": can("metadata_mutable"),
            "has a transfer fee": "yes" if result.get("transfer_fee") else "no",
            "has a transfer hook": "yes" if result.get("transfer_hook") else "no",
        }

    def read_address(self) -> dict:
        if self.video is not None:
            UPLOADS.mkdir(parents=True, exist_ok=True)
            path = UPLOADS / f"{hashlib.sha256(self.video).hexdigest()[:16]}.mp4"
            path.write_bytes(self.video)
            media = {"type": "input_file", "file_id": self.meta.upload(path)}
            ask = ("Watch this clip, frames and audio. Read the Solana token mint address shown on screen or said aloud "
                   "(base58, 32–44 characters), the ticker, and every claim made about the token, with the second it's shown "
                   "or said. Copy them exactly; use null if not shown.")
        elif self.image is not None:
            media = {"type": "input_image", "image_url": f"data:{self.image_type};base64,{base64.b64encode(self.image).decode()}",
                     "detail": "high"}
            ask = ("Read the Solana token mint address shown (base58, 32–44 characters), the ticker, and any claims made "
                   "about the token. Copy them exactly; use null if not shown.")
        else:
            return {"error": "The user didn't send a screenshot or clip."}
        # Reading is transcription: at "low" effort Muse Spark spent its whole output cap reasoning (Nov 2).
        response = self.meta.respond({
            "model": MODEL, "max_output_tokens": 2000, "store": False, "reasoning": {"effort": "minimal"},
            "text": {"format": {"type": "json_schema", "name": "token_address", "schema": ADDRESS_SCHEMA, "strict": True}},
            "input": [{"role": "user", "content": [{"type": "input_text", "text": ask}, media]}],
        }, purpose="read address")
        if response.get("status") != "completed":
            return {"error": "Couldn't finish reading the address; ask the user to paste the mint."}
        found = json.loads(meta.text_of(response) or "{}")
        if found.get("mint") and not valid_mint(found["mint"]):
            found["mint_note"] = "The address read isn't a valid Solana address; ask the user to paste it."
        return found

    def call(self, name: str, args: dict) -> dict:
        started = time.time()
        self.emit({"type": "step", "tool": name, "status": "running", "args": args})
        try:
            result = getattr(self, name)(**args)
            status = "error" if "error" in result else "done"
        except Exception as e:  # a tool failure is reported to the model, which can explain it
            result, status = {"error": f"{type(e).__name__}: {e}"[:300]}, "error"
        self.outputs.append(result)
        self.emit({"type": "step", "tool": name, "status": status, "summary": summary(name, result),
                   "ms": int(1000 * (time.time() - started))})
        return result

    # The loop

    def respond(self, items: list, purpose: str) -> dict:
        return self.meta.respond({"model": MODEL, "instructions": SYSTEM, "input": items, "tools": TOOLS,
                                  "max_output_tokens": MAX_OUTPUT, "store": False, "reasoning": {"effort": "low"},
                                  "parallel_tool_calls": True}, purpose=purpose)

    def run(self, message: str) -> dict:
        content = [{"type": "input_text", "text": message or "Check this token."}]
        if self.image is not None or self.video is not None:
            kind = "clip" if self.video is not None else "screenshot"
            content.append({"type": "input_text", "text": f"(The user attached a {kind}; call read_address to read it.)"})
        items: list = [{"role": "user", "content": content}]
        text = ""
        for _ in range(MAX_ROUNDS):
            response = self.respond(items, "rug check")
            # Reasoning items aren't replayed: with store off they'd need encrypted content.
            out = [i for i in response.get("output") or [] if i.get("type") in ("function_call", "message")]
            items += out
            calls = [i for i in out if i["type"] == "function_call"]
            if not calls:
                text = meta.text_of(response)
                break
            for c in calls:
                result = self.call(c["name"], json.loads(c.get("arguments") or "{}"))
                items.append({"type": "function_call_output", "call_id": c["call_id"], "output": json.dumps(result)})
        else:
            text = "The check took too many steps to finish. Try again with the token's mint address."
        return self.answer(items, text, message)

    def answer(self, items: list, text: str, message: str) -> dict:
        allowed = CONSTANTS + tuple(audit.values(message or ""))
        first = audit.audit(text, self.outputs, allowed)
        final = first
        if not first.passed:
            retry = self.meta.respond({"model": MODEL, "instructions": SYSTEM, "store": False, "reasoning": {"effort": "low"},
                                       "max_output_tokens": MAX_OUTPUT,
                                       "input": items + [{"role": "user", "content": first.feedback() + " Rewrite your answer."}]},
                                      purpose="rug check rewrite")
            rewrite = meta.text_of(retry)
            second = audit.audit(rewrite, self.outputs, allowed)
            if second.passed or len(second.unverified) < len(first.unverified):
                text, final = rewrite, second
        audit.log(self.id, "rug check", first, final)
        if NOT_ADVICE not in text:
            text = f"{text.rstrip()}\n\n{NOT_ADVICE}"
        event = {"type": "answer", "text": audit.mark(text, final) if not final.passed else text,
                 "audit": {"numbers": len(final.numbers), "passed": final.passed, "first_try_passed": first.passed,
                           "unverified": [n.text for n in final.unverified]},
                 "check": self.check}
        self.emit(event)
        return event


def summary(name: str, result: dict) -> str:
    """One short line for the thread."""
    if "error" in result:
        return result["error"]
    if name == "check_token":
        if result["status"] == "scored":
            return f"{result.get('symbol') or result['mint'][:6]}: {result['verdict']} · {result['rug_chance']} rug chance"
        return {"rugged": "Already rugged", "below_floor": "Too little activity to score",
                "too_old": "Older than a day: signals only"}.get(result["status"], result["status"])
    if name == "read_address":
        return f"Read {result.get('mint') or 'no address'}" + (f" ({result['ticker']})" if result.get("ticker") else "")
    if name == "find_token":
        return f"Found {result['found']} tokens"
    if name == "token_security":
        return "Authorities checked (Powered by GoPlus)"
    return "done"


def run(message: str, image: bytes | None = None, image_type: str = "image/png", emit=print, client: meta.Meta | None = None,
        as_of: int | None = None, video: bytes | None = None) -> dict:
    return Run(client=client, emit=emit, image=image, image_type=image_type, as_of=as_of, video=video).run(message)

"""The backend's HTTP API (SPEC.md 10), streamed as server-sent events (SPEC.md 8.3).

    POST /api/check   {"mint": ..., "as_of": null}            a live rug check, no Meta API
    POST /api/copytrade {"wallet", "buy_after_s", "sell_after_s", "size_sol", "positions"}  copying a wallet late, backtested
    POST /api/agent   {"message", "history", "image", "video"}  the agent: tools plus an audited explanation
    GET  /api/demo    the saved demo runs; GET /api/demo/<id> replays one
    GET  /api/meta    Meta API spend against the guard's limit
    GET  /api/health

Run from backend/:  uv run uvicorn receipts.server:app --port 8000
"""

import base64
import collections
import json
import os
import queue
import threading
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from receipts.agent import demo, loop, meta
from receipts.crypto import copytrade, live

app = FastAPI(title="Trade Receipts")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

MAX_IMAGE_BYTES = 8 * 2**20
# A live check reads a few thousand Helius credits (900,000 a month) and, with the Meta API on, a cent
# or less of Meta credits. Per visitor and in all, the public site stops well short of either.
CHECKS_PER_HOUR = int(os.environ.get("CHECKS_PER_HOUR", 6))
CHECKS_PER_DAY = int(os.environ.get("CHECKS_PER_DAY", 60))
_checks: dict[str, collections.deque] = collections.defaultdict(collections.deque)
_all_checks: collections.deque = collections.deque()
_checks_lock = threading.Lock()


FOLLOW_UPS_PER_HOUR = int(os.environ.get("FOLLOW_UPS_PER_HOUR", 30))


def allow_check(request: Request, follow_up: bool = False) -> None:
    """Refuse a live check past the visitor's hourly limit or the site's daily one. Follow-up questions
    about a result (answered from data already pulled) have their own, looser hourly limit."""
    who = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    with _checks_lock:
        if follow_up:
            mine = _checks[f"{who} follow-ups"]
            while mine and mine[0] < now - 3600:
                mine.popleft()
            if len(mine) >= FOLLOW_UPS_PER_HOUR:
                raise HTTPException(429, f"That's {FOLLOW_UPS_PER_HOUR} questions this hour. Try again later.")
            mine.append(now)
            return
        mine = _checks[who]
        while mine and mine[0] < now - 3600:
            mine.popleft()
        while _all_checks and _all_checks[0] < now - 86400:
            _all_checks.popleft()
        if len(mine) >= CHECKS_PER_HOUR:
            raise HTTPException(429, f"That's {CHECKS_PER_HOUR} live checks and backtests this hour. Saved ones still replay; try again later.")
        if len(_all_checks) >= CHECKS_PER_DAY:
            raise HTTPException(429, "The site's live checks for today are used up. Saved checks still replay.")
        mine.append(now)
        _all_checks.append(now)
MAX_VIDEO_BYTES = 25 * 2**20


class CheckRequest(BaseModel):
    mint: str
    as_of: int | None = None


class CopyTradeRequest(BaseModel):
    wallet: str  # an address or a pump.fun profile link
    buy_after_s: int = 300
    sell_after_s: int = 600
    size_sol: float = 1.0
    positions: int = 50  # the wallet's latest closed positions to copy, up to 100


class Turn(BaseModel):
    role: str
    text: str


class AgentRequest(BaseModel):
    message: str = ""
    history: list[Turn] = []  # the conversation so far, for follow-ups
    context_id: str | None = None  # the thread's latest answer's run_id (or "demo:<id>"): its results are reused
    image: str | None = None  # a data URL
    video: str | None = None  # an mp4 data URL
    as_of: int | None = None  # check tokens as they stood then (the demo's past tokens)


def stream(work) -> StreamingResponse:
    """Run `work(emit)` in a thread and stream every event it emits."""
    events: queue.Queue = queue.Queue()
    done = object()

    def target():
        try:
            work(events.put)
        except meta.MetaDisabled as e:
            events.put({"type": "error", "message": str(e)})
        except meta.BudgetExceeded as e:
            events.put({"type": "error", "message": str(e)})
        except Exception as e:  # reported to the thread rather than dropped
            events.put({"type": "error", "message": f"{type(e).__name__}: {e}"[:300]})
        finally:
            events.put(done)

    threading.Thread(target=target, daemon=True).start()

    def body():
        while (event := events.get()) is not done:
            yield f"data: {json.dumps(event, default=str)}\n\n"

    return StreamingResponse(body(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/demo")
def demo_runs() -> list[dict]:
    """The saved demo runs, replayed without the Meta API or Helius."""
    return demo.runs()


@app.get("/api/demo/{run_id}")
def demo_run(run_id: str) -> dict:
    found = demo.run(run_id)
    if found is None:
        raise HTTPException(404, "No saved run with that id")
    return found


@app.get("/api/meta")
def meta_report() -> dict:
    return meta.Meta().report()


@app.post("/api/check")
def check(req: CheckRequest, request: Request) -> StreamingResponse:
    if not loop.valid_mint(req.mint):
        raise HTTPException(400, "Not a valid Solana address")
    allow_check(request)

    def work(emit):
        try:
            result = live.check(req.mint, as_of=req.as_of, progress=lambda **kv: emit({"type": "progress", **kv}))
        except live.NotPumpFun:
            emit({"type": "error", "message": "No pump.fun launch was found for this mint."})
            return
        emit({"type": "result", "check": result})

    return stream(work)


@app.post("/api/copytrade")
def copy_trade(req: CopyTradeRequest, request: Request) -> StreamingResponse:
    wallet = copytrade.wallet_from(req.wallet)
    if not wallet or not loop.valid_mint(wallet):
        raise HTTPException(400, "Not a wallet address or pump.fun profile link")
    if not (0 <= req.buy_after_s <= 86400 and 0 <= req.sell_after_s <= 86400 and 0 < req.size_sol <= 1000
            and 1 <= req.positions <= copytrade.MAX_POSITIONS):
        raise HTTPException(400, f"Delays must be 0 to 86,400 seconds, the size 0 to 1,000 SOL, and positions 1 to {copytrade.MAX_POSITIONS}")
    allow_check(request)

    def work(emit):
        result = copytrade.copy_trade(wallet, req.buy_after_s, req.sell_after_s, req.size_sol,
                                      progress=lambda **kv: emit({"type": "progress", **kv}), positions=req.positions)
        run_id = loop.save_copy_run(wallet, req.buy_after_s, req.sell_after_s, req.positions, result) if result["positions"] else None
        emit({"type": "result", "copy_trade": result, "run_id": run_id})

    return stream(work)


@app.post("/api/agent")
def agent(req: AgentRequest, request: Request) -> StreamingResponse:
    image, image_type = None, "image/png"
    if req.image:
        header, _, data = req.image.partition(",")
        if not header.startswith("data:image/") or ";base64" not in header:
            raise HTTPException(400, "image must be a base64 data URL")
        image, image_type = base64.b64decode(data), header[5:].split(";")[0]
        if len(image) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "image is over 8 MB")

    video = None
    if req.video:
        header, _, data = req.video.partition(",")
        if header != "data:video/mp4;base64":
            raise HTTPException(400, "video must be an mp4 data URL")
        video = base64.b64decode(data)
        if len(video) > MAX_VIDEO_BYTES:
            raise HTTPException(413, "clip is over 25 MB")

    allow_check(request, follow_up=bool(req.context_id))
    history = [t.model_dump() for t in req.history]
    return stream(lambda emit: loop.run(req.message, image=image, image_type=image_type, emit=emit, as_of=req.as_of,
                                        video=video, history=history, context_id=req.context_id))

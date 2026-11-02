"""The backend's HTTP API (SPEC.md 10), streamed as server-sent events (SPEC.md 8.3).

    POST /api/check   {"mint": ..., "as_of": null}            a live rug check, no Meta API
    POST /api/agent   {"message": ..., "image": "data:..."}   the agent: tools plus an audited explanation
    GET  /api/meta    Meta API spend against the guard's limit
    GET  /api/health

Run from backend/:  uv run uvicorn receipts.server:app --port 8000
"""

import base64
import json
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from receipts.agent import loop, meta
from receipts.crypto import live

app = FastAPI(title="Trade Receipts")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

MAX_IMAGE_BYTES = 8 * 2**20


class CheckRequest(BaseModel):
    mint: str
    as_of: int | None = None


class AgentRequest(BaseModel):
    message: str = ""
    image: str | None = None  # a data URL


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


@app.get("/api/meta")
def meta_report() -> dict:
    return meta.Meta().report()


@app.post("/api/check")
def check(req: CheckRequest) -> StreamingResponse:
    if not loop.valid_mint(req.mint):
        raise HTTPException(400, "Not a valid Solana address")

    def work(emit):
        try:
            result = live.check(req.mint, as_of=req.as_of, progress=lambda **kv: emit({"type": "progress", **kv}))
        except live.NotPumpFun:
            emit({"type": "error", "message": "No pump.fun launch was found for this mint."})
            return
        emit({"type": "result", "check": result})

    return stream(work)


@app.post("/api/agent")
def agent(req: AgentRequest) -> StreamingResponse:
    image, image_type = None, "image/png"
    if req.image:
        header, _, data = req.image.partition(",")
        if not header.startswith("data:image/") or ";base64" not in header:
            raise HTTPException(400, "image must be a base64 data URL")
        image, image_type = base64.b64decode(data), header[5:].split(";")[0]
        if len(image) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "image is over 8 MB")

    return stream(lambda emit: loop.run(req.message, image=image, image_type=image_type, emit=emit))

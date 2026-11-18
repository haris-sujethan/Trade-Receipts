"""Who's asking: the signed-in Supabase user behind a request.

The frontend signs visitors in with Supabase Auth and sends the session's access token as
`Authorization: Bearer <token>`. The token is checked with Supabase itself (`/auth/v1/user`), which
works with any of its signing keys, and the answer is kept for a few minutes so a thread's requests
don't each pay for the check. With SUPABASE_URL unset (local development) nobody needs to sign in.
"""

import os
import threading
import time

import httpx
from fastapi import HTTPException, Request

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or ""
CACHE_S = 300
_cache: dict[str, tuple[float, str]] = {}
_lock = threading.Lock()


def required() -> bool:
    return bool(SUPABASE_URL)


def user_id(request: Request) -> str:
    """The signed-in user's id, or a 401. Locally, without Supabase, the caller's address stands in."""
    if not required():
        return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "local")).split(",")[0].strip()
    header = request.headers.get("authorization") or ""
    token = header[7:] if header.lower().startswith("bearer ") else ""
    if not token:
        raise HTTPException(401, "Sign in to run live checks and backtests.")
    now = time.time()
    with _lock:
        hit = _cache.get(token)
        if hit and hit[0] > now:
            return hit[1]
    try:
        reply = httpx.get(f"{SUPABASE_URL}/auth/v1/user", timeout=10,
                          headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"})
    except httpx.HTTPError:
        raise HTTPException(503, "Couldn't check your sign-in. Try again.") from None
    if reply.status_code != 200 or not reply.json().get("id"):
        raise HTTPException(401, "Your sign-in has expired. Sign in again.")
    uid = reply.json()["id"]
    with _lock:
        if len(_cache) > 10_000:
            _cache.clear()
        _cache[token] = (now + CACHE_S, uid)
    return uid

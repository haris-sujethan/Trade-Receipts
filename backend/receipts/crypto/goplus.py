"""GoPlus Solana token security, a free cross-check for live scoring (no key, about 30 calls a minute).

Anything shown from it must carry "Powered by GoPlus". On pump.fun tokens the mint, freeze and
close authorities come back revoked (checked Oct 31, 2026), so these fields rarely flag anything.
"""

import json
import sqlite3
import time

import httpx

from receipts.config import Settings, settings as default_settings

URL = "https://api.gopluslabs.io/api/v1/solana/token_security"
MIN_INTERVAL = 2.0
CREDIT = "Powered by GoPlus"


class GoPlus:
    def __init__(self, settings: Settings = default_settings, http: httpx.Client | None = None):
        self.http = http or httpx.Client(timeout=30)
        path = settings.data_dir / "cache" / "goplus.sqlite"
        path.parent.mkdir(parents=True, exist_ok=True)
        self.cache = sqlite3.connect(path)
        self.cache.execute("CREATE TABLE IF NOT EXISTS tokens (mint TEXT PRIMARY KEY, fetched REAL, result TEXT)")
        self._last_call = 0.0

    def token_security(self, mint: str, *, max_age: float = 3600) -> dict | None:
        row = self.cache.execute("SELECT fetched, result FROM tokens WHERE mint = ?", (mint,)).fetchone()
        if row and time.time() - row[0] < max_age:
            return json.loads(row[1])
        wait = self._last_call + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()
        reply = self.http.get(URL, params={"contract_addresses": mint})
        reply.raise_for_status()
        body = reply.json()
        if body.get("code") != 1:
            raise RuntimeError(f"GoPlus: {body.get('message')}")
        result = (body.get("result") or {}).get(mint)
        self.cache.execute("INSERT OR REPLACE INTO tokens VALUES (?, ?, ?)", (mint, time.time(), json.dumps(result)))
        self.cache.commit()
        return result

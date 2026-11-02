"""The one way the app calls Helius (free plan: 1M credits a month).

Every call is priced from Helius's credit table before it's sent, refused once this month's
ledger would pass HELIUS_MONTHLY_BUDGET_CREDITS, logged to `data/ledger/helius.jsonl`, and
cached by method and parameters. Transactions and old signature pages don't change, so the
cache never expires; the newest signature page is skipped when `fresh=True`.
"""

import datetime as dt
import hashlib
import json
import sqlite3
import time

import httpx

from receipts.config import Settings, settings as default_settings

RPC_URL = "https://mainnet.helius-rpc.com/?api-key={key}"

# helius.dev/docs/billing/credits (Oct 31, 2026). Unlisted RPC methods cost 1.
CREDITS = {
    "getProgramAccounts": 10,
    "getAsset": 10,
    "getTokenAccounts": 10,
    "getAssetsByOwner": 10,
    # 10 per 100 full transactions (a page here), or 10 flat for up to 1,000 signatures
    "getTransactionsForAddress": 10,
}
PAGE = 100  # full transactions per getTransactionsForAddress page
MIN_INTERVAL = 0.1  # stay near 10 requests a second


class BudgetExceeded(RuntimeError):
    pass


class HeliusError(RuntimeError):
    pass


class Helius:
    def __init__(self, settings: Settings = default_settings, http: httpx.Client | None = None):
        self.settings = settings
        self.key = settings.require("helius_api_key")
        self.http = http or httpx.Client(timeout=30)
        self.ledger_path = settings.data_dir / "ledger" / "helius.jsonl"
        cache_path = settings.data_dir / "cache" / "helius.sqlite"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache = sqlite3.connect(cache_path)
        self.cache.execute("CREATE TABLE IF NOT EXISTS calls (key TEXT PRIMARY KEY, result TEXT)")
        self._last_call = 0.0

    def spent_this_month(self) -> int:
        if not self.ledger_path.exists():
            return 0
        month = dt.datetime.now(dt.UTC).strftime("%Y-%m")
        return sum(
            entry["credits"]
            for entry in map(json.loads, self.ledger_path.read_text().splitlines())
            if entry["at"].startswith(month)
        )

    def rpc(self, method: str, params: list, *, fresh: bool = False):
        key = hashlib.sha256(json.dumps([method, params], sort_keys=True).encode()).hexdigest()
        if not fresh:
            row = self.cache.execute("SELECT result FROM calls WHERE key = ?", (key,)).fetchone()
            if row:
                return json.loads(row[0])

        credits = CREDITS.get(method, 1)
        budget = self.settings.helius_monthly_budget_credits
        if self.spent_this_month() + credits > budget:
            raise BudgetExceeded(f"Helius: {method} would pass this month's {budget:,} credit budget")

        wait = self._last_call + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        body = None
        for attempt in range(5):
            self._last_call = time.monotonic()
            reply = self.http.post(
                RPC_URL.format(key=self.key),
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            )
            if reply.status_code == 429:
                time.sleep(2**attempt)
                continue
            reply.raise_for_status()
            body = reply.json()
            break
        if body is None:
            raise HeliusError(f"{method}: still rate limited after retries")
        self._log(method, credits)
        if "error" in body:
            raise HeliusError(f"{method}: {body['error']}")
        result = body["result"]
        if result is not None:
            self.cache.execute("INSERT OR REPLACE INTO calls VALUES (?, ?)", (key, json.dumps(result)))
            self.cache.commit()
        return result

    def _log(self, method: str, credits: int) -> None:
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        entry = {"at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "method": method, "credits": credits}
        with self.ledger_path.open("a") as f:
            f.write(json.dumps(entry) + "\n")

    # The calls the pipeline uses

    def transaction(self, signature: str) -> dict | None:
        return self.rpc("getTransaction", [signature, {"encoding": "json", "maxSupportedTransactionVersion": 1}])

    def signatures(self, address: str, *, before: str | None = None, limit: int = 1000) -> list[dict]:
        """One page of an address's signatures, newest first. The newest page is always refetched."""
        options = {"limit": limit} | ({"before": before} if before else {})
        return self.rpc("getSignaturesForAddress", [address, options], fresh=before is None)

    def history(self, address: str, *, gte: int, lte: int, order: str = "asc", max_pages: int = 10):
        """An address's successful transactions in [gte, lte] (unix seconds), oldest or newest first.

        Yields (transactions, complete) per page of up to PAGE; `complete` turns true on the last
        page. Stops after `max_pages`, so the caller learns the history was cut short. Pages that
        end before now never change, so they're cached for good.
        """
        token = None
        for page in range(max_pages):
            options = {"transactionDetails": "full", "sortOrder": order, "limit": PAGE,
                       "filters": {"blockTime": {"gte": int(gte), "lte": int(lte)}, "status": "succeeded"},
                       "encoding": "json", "maxSupportedTransactionVersion": 0}
            if token:
                options["paginationToken"] = token
            result = self.rpc("getTransactionsForAddress", [address, options], fresh=lte >= time.time() - 60)
            token = result.get("paginationToken")
            yield result["data"], token is None
            if token is None:
                return

    def count_since(self, address: str, *, gte: int, lte: int) -> int:
        """How many successful transactions an address had in [gte, lte], up to 1,000 (10 credits)."""
        options = {"transactionDetails": "signatures", "limit": 1000,
                   "filters": {"blockTime": {"gte": int(gte), "lte": int(lte)}, "status": "succeeded"}}
        result = self.rpc("getTransactionsForAddress", [address, options], fresh=lte >= time.time() - 60)
        return len(result["data"])

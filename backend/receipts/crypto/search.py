"""Live token search by name or ticker (SPEC.md 7.1), for tokens newer than the launch history
(copycats.py covers launches through mid-September 2026).

DEX Screener's public search: free, no key or card. Its API terms allow commercial use; they bar
building a product that competes directly with DEX Screener and making its API available to others.
Only Solana pump.fun tokens are kept (a pump.fun mint ends in "pump", or the pair is on pump.fun or
PumpSwap), grouped by token and ranked by liquidity. Results are cached for SEARCH_CACHE seconds.
"""

import time

import httpx

from receipts.crypto import copycats

URL = "https://api.dexscreener.com/latest/dex/search"
SOURCE = "DEX Screener"
SHOWN = 5
SEARCH_CACHE = 600
PUMP_DEXES = {"pumpfun", "pumpswap"}

_cache: dict[str, tuple[float, dict]] = {}


def search(query: str, http: httpx.Client | None = None) -> dict:
    """pump.fun tokens whose ticker or name is `query` (case and a leading $ ignored), most liquid first."""
    q = query.strip().lstrip("$").lower()
    hit = _cache.get(q)
    if hit and time.time() - hit[0] < SEARCH_CACHE:
        return hit[1]
    reply = (http or httpx.Client(timeout=20)).get(URL, params={"q": q})
    reply.raise_for_status()
    tokens: dict[str, dict] = {}
    for p in reply.json().get("pairs") or []:
        base = p.get("baseToken") or {}
        mint = base.get("address") or ""
        if p.get("chainId") != "solana" or not (mint.endswith("pump") or p.get("dexId") in PUMP_DEXES):
            continue
        if q not in ((base.get("symbol") or "").lower(), (base.get("name") or "").lower()):
            continue
        t = tokens.setdefault(mint, {"mint": mint, "name": copycats.clean_name(base.get("name")),
                                     "symbol": copycats.clean_name(base.get("symbol")), "created_ts": None,
                                     "mcap_usd": None, "liquidity_usd": 0.0, "volume_24h_usd": 0.0, "pairs": 0})
        t["pairs"] += 1
        liquidity = float((p.get("liquidity") or {}).get("usd") or 0)
        t["liquidity_usd"] += liquidity
        t["volume_24h_usd"] += float((p.get("volume") or {}).get("h24") or 0)
        # the market cap of its most liquid pair: thin pairs can report stale prices
        if p.get("marketCap") and liquidity >= t.get("_best", -1.0):
            t["mcap_usd"], t["_best"] = float(p["marketCap"]), liquidity
        created = p.get("pairCreatedAt")
        if created and (t["created_ts"] is None or created / 1000 < t["created_ts"]):
            t["created_ts"] = int(created / 1000)
    for t in tokens.values():
        t.pop("_best", None)
    ranked = sorted(tokens.values(), key=lambda t: -t["liquidity_usd"])
    out = {"total": len(ranked), "tokens": ranked[:SHOWN], "source": SOURCE}
    _cache[q] = (time.time(), out)
    return out

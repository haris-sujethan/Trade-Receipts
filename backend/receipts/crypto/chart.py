"""The real chart and the bubble map as data for the report (SPEC.md 7.4, 7.5).

Both come from the same snapshot view as the signals (signals.snapshot with context), so every
wallet is in the same group the rug check put it in.

- The real chart: market cap candles in SOL, each candle's buy and sell volume split by who
  traded, every team sell marked, and two plain numbers: how much of the buying came from
  independent buyers, and what the team's tokens are worth at the current price.
- The bubble map: the 50 biggest holders and the first 50 buyers, sized by share of supply,
  with their group, cluster and the funding links between them.
"""

import math

import numpy as np

from receipts.crypto import programs, prompt

# The chart's groups, merged from the rug check's finer ones (prompt.group_of).
CHART_GROUP = {"team": "team", "likely team": "likely team", "snipers": "snipers", "sniper bots": "snipers",
               "wash traders": "bots and wash trades", "agent": "bots and wash trades", "fresh wallets": "fresh wallets",
               "independent": "independent", "other": "other"}
CHART_GROUPS = ("team", "likely team", "snipers", "bots and wash trades", "fresh wallets", "independent", "other")


def candle_seconds(age: int) -> int:
    for limit, size in ((300, 5), (900, 15), (1800, 30), (3600, 60), (6 * 3600, 300)):
        if age <= limit:
            return size
    return 900


def real_chart(tok, sig: dict, ctx: dict) -> dict:
    n = ctx["n"]
    age = int(sig["age_s"])
    groups = prompt.group_of(ctx)
    t = tok.t[:n] - tok.launch_ts
    g = np.array([CHART_GROUP[x] for x in groups[tok.code[:n]]], dtype=object)
    is_buy, sol, mcap = tok.is_buy[:n], tok.sol[:n], np.asarray(ctx["mcap"][:n], float)
    size = candle_seconds(age)
    candles = []
    close = float(tok.start_mcap)
    for start in range(0, age + 1, size):
        m = (t >= start) & (t < start + size)
        prices = mcap[m][~np.isnan(mcap[m])]
        open_ = close
        if len(prices):
            close = float(prices[-1])
        volume = {}
        for name in CHART_GROUPS:
            gm = m & (g == name)
            if gm.any():
                volume[name] = {"buy_sol": round(float(sol[gm & is_buy].sum()), 4), "sell_sol": round(float(sol[gm & ~is_buy].sum()), 4)}
        if not volume and not candles:
            continue
        candles.append({"t": start, "open": round(open_, 3), "close": round(close, 3),
                        "high": round(max([open_, close, *prices.tolist()]), 3),
                        "low": round(min([open_, close, *prices.tolist()]), 3), "volume": volume})
    team_sells = [{"t": int(t[i]), "sol": round(float(sol[i]), 4), "mcap_sol": None if math.isnan(mcap[i]) else round(float(mcap[i]), 3),
                   "wallet": str(tok.names[tok.code[i]])}
                  for i in np.flatnonzero((g == "team") & ~is_buy)]
    share, cap = sig.get("team_share"), sig.get("mcap_sol")
    return {
        "candle_s": size, "candles": candles, "team_sells": team_sells,
        "independent_buy_share": sig.get("independent_buy_share"),
        "team_value_sol": None if share is None or cap is None or math.isnan(share) or math.isnan(cap) else round(share * cap, 3),
        "mcap_sol": cap,
    }


def bubble_map(tok, ctx: dict) -> dict:
    """Links are the funding links between shown wallets, plus a `launch_bundle` link from the
    creator to each wallet that bought in its launch block: how most teams join (roles.py)."""
    groups = prompt.group_of(ctx)
    held, first_buy = ctx["held"], ctx["first_buy"]
    creator = ctx["roles"].creator
    holders = [i for i in np.argsort(-held, kind="stable") if held[i] > 0][:prompt.MAP_HOLDERS]
    buyers = [i for i in np.argsort(first_buy, kind="stable") if math.isfinite(first_buy[i])][:prompt.MAP_BUYERS]
    shown = [i for i in dict.fromkeys(holders + buyers + ([tok.index[creator]] if creator in tok.index else []))
             if groups[i] != "agent"]
    names = {tok.names[i] for i in shown}
    nodes = [{"wallet": str(tok.names[i]), "share": round(float(held[i] / programs.TOTAL_SUPPLY), 6), "group": groups[i],
              "cluster": str(ctx["cluster_of"][i]), "sold_out": bool(held[i] <= 0), "creator": tok.names[i] == creator,
              "first_buy_s": None if not math.isfinite(first_buy[i]) else int(first_buy[i] - tok.launch_ts)}
             for i in shown]
    links = [{"source": w1, "target": w2, "kind": kind} for w1, w2, _, kind in ctx["edges"] if w1 in names and w2 in names]
    links += [{"source": creator, "target": w, "kind": "launch_bundle"} for w in sorted(ctx["roles"].bundle)
              if creator in names and w in names]
    return {"nodes": nodes, "links": links}


def same_size_buys(tok, ctx: dict, top: int = 8) -> list[dict]:
    """The most repeated exact buy sizes, as signals.snapshot counts them: what the buyer sent
    (fees included), to 0.001 SOL, Mayhem agent excluded, kept when 3 or more buys share a size."""
    n = ctx["n"]
    buys = tok.is_buy[:n] & ~ctx["agent"][tok.code[:n]]
    gross = np.round(tok.gross_sol[:n][buys], 3)
    wallets = tok.code[:n][buys]
    if not len(gross):
        return []
    sizes, counts = np.unique(gross, return_counts=True)
    order = [i for i in np.argsort(-counts, kind="stable") if counts[i] >= 3][:top]
    return [{"sol": float(sizes[i]), "count": int(counts[i]), "wallets": int(len(np.unique(wallets[gross == sizes[i]])))}
            for i in order]

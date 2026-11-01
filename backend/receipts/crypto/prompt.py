"""Glimmer's input for one snapshot: the token as text, plus the bubble map as an image (SPEC.md 7.8).

Built from the same view of the token as its signals (signals.snapshot with context), so it reads
nothing after the snapshot either. The text has five parts:
- the signals, grouped by family;
- the 10 biggest holders: share, who they are, when they bought, how they were funded;
- the price line: market cap from launch to the snapshot;
- the trades, bucketed by time, as SOL bought and sold by each group;
- the instruction to answer with short reasoning and a rug chance.

The bubble map shows the 50 biggest holders and the first 50 buyers, sized by share of supply,
colored by group, with lines for funding links (dashed for likely team).

Every number the model might cite is written here, so the numbers audit can check its reasoning
against this text.
"""

import math

import numpy as np
from PIL import Image, ImageDraw

from receipts.crypto import programs, signals

IMAGE_SIZE = 448
HOLDERS = 10
MAP_HOLDERS = 50
MAP_BUYERS = 50
PRICE_POINTS = 16
BUCKETS = (0, 2, 5, 10, 20, 40, 60, 120, 300, 900, 1800, 3600, 7200, 21600)
GROUPS = ("team", "likely team", "snipers", "sniper bots", "wash traders", "fresh wallets", "independent", "other")
COLORS = {
    "team": (214, 39, 40), "likely team": (255, 127, 14), "snipers": (227, 190, 30), "sniper bots": (140, 110, 0),
    "wash traders": (140, 86, 75), "fresh wallets": (148, 103, 189), "independent": (150, 150, 150),
    "other": (200, 200, 200), "cluster": (31, 119, 180),
}
ANSWER = "Rug chance:"
INSTRUCTION = (
    "Will this token's team rug within 24 hours of launch? Rugged means the team (the creator, its launch "
    "bundle and wallets linked to them by funding) sells at least half its peak holdings while the price gives "
    f"back at least 90% of its rise. Answer with \"{ANSWER} N%\" on the first line (N from 1 to 99), then "
    "1 or 2 sentences on the signals that raise and lower it, citing numbers from above."
)
# Glimmer's chat format: our system message (low reasoning strength), then the answer channel is
# opened directly, so Glimmer answers without a separate thinking step.
SYSTEM = "You check new pump.fun tokens for the chance that their team rugs. Reasoning strength: low"


def _pct(x) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    return f"{100 * x:.1f}%"


def _sol(x) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    return f"{x:,.1f} SOL" if abs(x) >= 10 else f"{x:.2f} SOL"


def _num(x) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    if float(x).is_integer():
        return f"{int(x):,}"
    return f"{x:,.1f}" if abs(x) >= 100 else f"{x:.2f}"


def _secs(s: float) -> str:
    s = int(s)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m{s % 60:02d}s" if s % 60 else f"{s // 60}m"
    return f"{s // 3600}h{(s % 3600) // 60:02d}m"


def group_of(ctx: dict) -> np.ndarray:
    """Each wallet's group, in priority order."""
    g = np.full(len(ctx["held"]), "other", dtype=object)
    order = [("independent", ctx["independent"]), ("fresh wallets", ctx["fresh"]), ("wash traders", ctx["wash"]),
             ("snipers", ctx["snipers"]), ("sniper bots", ctx["sniper_bots"]),
             ("likely team", ctx["likely"]), ("team", ctx["team"])]
    for name, mask in order:
        g[mask] = name
    g[ctx["agent"]] = "agent"
    return g


def signal_lines(s: dict) -> list[str]:
    state = "graduated to its own pool" if s["graduated"] else f"bonding curve {_pct(s['curve_progress'])} filled"
    mode = "Mayhem mode (pump.fun's agent trades it)" if s["mayhem"] else "standard mode"
    return [
        f"Age {_secs(s['age_s'])} after launch; {state}; {mode}.",
        "Market: " + "; ".join([
            f"market cap {_sol(s['mcap_sol'])}", f"peak {_sol(s['peak_mcap_sol'])}",
            f"{_pct(s['fall_from_peak'])} of the rise given back", f"volume {_sol(s['volume_sol'])}",
            f"{_num(s['trades'])} trades", f"{_num(s['buyers'])} buyers", f"{_num(s['sellers'])} sellers",
            f"buy/sell volume ratio {_num(s['buy_sell_ratio'])}",
        ]),
        "Launch: " + "; ".join([
            f"market cap {_sol(s['mcap_slot0_sol'])} after the launch block, {_sol(s['mcap_1m_sol'])} at 1m, {_sol(s['mcap_5m_sol'])} at 5m",
            f"creator bought {_pct(s['creator_buy_share'])} of supply in the create transaction",
            f"{_pct(s['supply_bought_slot0'])} bought in the launch block, {_pct(s['supply_bought_slots0_2'])} in the first 3 blocks",
            f"{_num(s['bundle_wallets'])} bundle wallets bought {_pct(s['bundle_supply_share'])}",
            f"{_pct(s['same_size_buy_share'])} of buys share an exact size with 2+ others (largest group {_num(s['top_same_size_buys'])})",
            f"{_pct(s['round_size_buy_share'])} of buys are round amounts",
            f"first independent buyer at {_secs(s['first_independent_s']) if not math.isnan(s['first_independent_s']) else 'none yet'}",
        ]),
        "Snipers: " + "; ".join([
            f"{_num(s['snipers'])} snipers ({_num(s['sniper_bots'])} known bots)",
            f"bought {_pct(s['sniper_bought_share'])}, still hold {_pct(s['sniper_held_share'])}",
            f"sold {_pct(s['sniper_sold_share'])} of what they bought",
        ]),
        "Team: " + "; ".join([
            f"{_num(s['team_wallets'])} wallets", f"hold {_pct(s['team_share'])} now, {_pct(s['team_peak_share'])} at peak",
            f"sold {_pct(s['team_sold_share'])} of peak holdings",
            f"{_pct(s['team_sells_into_buys'])} of team sells came within 10s of an outside buy",
            f"team is {_pct(s['team_volume_share'])} of volume and {_pct(s['team_sell_volume_share'])} of sell volume",
            f"{_num(s['team_recycled_wallets'])} team wallets were team in an earlier rug",
            f"likely team: {_num(s['likely_team_wallets'])} wallets holding {_pct(s['likely_team_share'])}",
        ]),
        "Supply: " + "; ".join([
            f"{_num(s['holders'])} holders", f"top holder {_pct(s['top_holder_share'])}", f"top 10 {_pct(s['top10_share'])}",
            f"largest linked cluster {_pct(s['top_cluster_share'])}, top 3 clusters {_pct(s['top3_clusters_share'])}",
            f"{_num(s['wallets_over_4pct'])} wallets and {_num(s['clusters_over_4pct'])} clusters over 4%",
            f"{_num(s['linked_clusters'])} linked clusters", f"{_pct(s['hidden_supply_share'])} sold beyond what was bought (transferred in)",
            f"balance inequality (Gini) {_num(s['holder_gini'])}", f"{_num(s['same_balance_holders'])} holders at near-identical balances",
        ]),
        "Wallets: " + "; ".join([
            f"{_pct(s['fresh_buyer_share'])} of traced buyers are fresh", f"{_pct(s['funded_last_hour_share'])} were funded within an hour of buying",
            f"{_num(s['independent_buyers'])} independent buyers ({_num(s['independent_per_100_sol'])} per 100 SOL of market cap)",
            f"{_pct(s['experienced_holder_share'])} of holders traded 3+ tokens in the past day, {_pct(s['profitable_holder_share'])} made a profit",
            f"{_num(s['recycled_wallets'])} buyers were team in an earlier rug, buying {_pct(s['recycled_supply_share'])}",
        ]),
        "Trading: " + "; ".join([
            f"{_num(s['trades_per_trader'])} trades per trader", f"{_num(s['wash_wallets'])} wash-trading wallets, {_pct(s['wash_volume_share'])} of volume",
            f"timing irregularity {_num(s['timing_cv'])}", f"{_num(s['linked_round_trips'])} buys right after a linked wallet sold",
            f"Mayhem agent {_pct(s['agent_volume_share'])} of volume",
        ]),
        "Chart: " + "; ".join([
            f"{_num(s['candles'])} one-minute candles, {_pct(s['green_candle_share'])} green", f"deepest dip {_pct(s['max_dip'])}",
            f"climb steadiness {_num(s['climb_r2'])}", f"independent buyers made {_pct(s['independent_buy_share'])} of buying",
        ]),
        "Creator: " + "; ".join([
            f"{_num(s['creator_launches_24h'])} launches and {_num(s['creator_rugs_24h'])} rugs in the past day",
            f"wallets sharing its funder: {_num(s['group_launches_24h'])} launches, {_num(s['group_rugs_24h'])} rugs",
            (f"funded {_num(s['creator_funded_minutes_before'])} minutes before launch" + (" from an exchange" if s["creator_funded_by_hub"] else "")
             if not math.isnan(s["creator_funded_minutes_before"]) else "no funding seen in the 2 days before launch"),
            f"{_pct(s['team_funded_by_exchange_share'])} of traced team wallets funded from an exchange",
        ]),
    ]


def holder_lines(tok: "signals.Token", ctx: dict, groups: np.ndarray) -> list[str]:
    held = ctx["held"]
    idx = [i for i in np.argsort(-held, kind="stable") if held[i] > 0 and groups[i] != "agent"][:HOLDERS]
    lines = []
    for rank, i in enumerate(idx, 1):
        role = "creator" if tok.names[i] == tok.creator else groups[i]
        cluster = ctx["cluster_of"][i]
        if cluster != tok.names[i] and cluster != "team":
            role += ", linked"
        parts = [f"{rank}. {_pct(held[i] / programs.TOTAL_SUPPLY)} {role}"]
        if math.isfinite(ctx["first_buy"][i]):
            parts.append(f"bought {_secs(ctx['first_buy'][i] - tok.launch_ts)}")
        bought = ctx["bought"][i]
        if bought > 0 and ctx["sold"][i] > 0:
            parts.append(f"sold {_pct(min(1.0, ctx['sold'][i] / bought))}")
        if ctx["is_traced"][i] and not math.isnan(ctx["funded_ts"][i]):
            source = "exchange" if ctx["funded_by_hub"][i] else "wallet"
            parts.append(f"{source}-funded {_secs(max(0, tok.first_seen[i] - ctx['funded_ts'][i]))} before")
        lines.append(", ".join(parts))
    return lines


def price_line(tok: "signals.Token", ctx: dict, age: int) -> str:
    t, mcap = tok.t[: ctx["n"]], ctx["mcap"]
    if not len(t):
        return "no trades"
    times = np.unique(np.geomspace(1, age, PRICE_POINTS).astype(int))
    values = []
    for s in times:
        k = int(np.searchsorted(t, tok.launch_ts + s, side="right"))
        values.append(_num(round(float(mcap[k - 1]), 1)) if k else _num(round(tok.start_mcap, 1)))
    return ", ".join(f"{_secs(s)} {v}" for s, v in zip(times, values))


def trade_lines(tok: "signals.Token", ctx: dict, groups: np.ndarray, age: int) -> list[str]:
    """Per time bucket: each group's SOL bought (+) and sold (−), and its trade count."""
    n = ctx["n"]
    t = tok.t[:n] - tok.launch_ts
    g = groups[tok.code[:n]]
    is_buy, sol = tok.is_buy[:n], tok.sol[:n]
    edges = [b for b in BUCKETS if b < age] + [age]
    lines = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (t >= lo) & (t < hi) if hi < age else (t >= lo) & (t <= hi)
        if not m.any():
            continue
        parts = []
        for name in GROUPS + ("agent",):
            gm = m & (g == name)
            if not gm.any():
                continue
            b, s_ = sol[gm & is_buy].sum(), sol[gm & ~is_buy].sum()
            parts.append(f"{name} +{_num(round(float(b), 2))}/−{_num(round(float(s_), 2))} ({int(gm.sum())})")
        lines.append(f"{_secs(lo)}–{_secs(hi)}: " + "; ".join(parts))
    return lines


def text(tok: "signals.Token", sig: dict, ctx: dict) -> str:
    groups = group_of(ctx)
    age = int(sig["age_s"])
    parts = ["A pump.fun token, as it stood at this moment. The image is its bubble map: circles are wallets sized by "
             "share of supply (red team, orange likely team, yellow snipers, dark yellow sniper bots, purple fresh "
             "wallets, brown wash traders, blue linked clusters, grey independent buyers); lines are funding links.",
             "", "Signals"] + signal_lines(sig)
    parts += ["", "Biggest holders (share of supply, when first bought, share of buys sold, funding)"]
    parts += holder_lines(tok, ctx, groups) or ["none"]
    parts += ["", "Market cap in SOL since launch", price_line(tok, ctx, age)]
    parts += ["", "Trades over time: SOL bought (+) and sold (−) by each group (trades)"]
    parts += trade_lines(tok, ctx, groups, age) or ["none"]
    parts += ["", INSTRUCTION]
    return "\n".join(parts)


def bubble_map(tok: "signals.Token", ctx: dict) -> Image.Image:
    """The 50 biggest holders and the first 50 buyers, grouped by cluster and colored by group."""
    groups = group_of(ctx)
    held, first_buy = ctx["held"], ctx["first_buy"]
    holders = [i for i in np.argsort(-held, kind="stable") if held[i] > 0][:MAP_HOLDERS]
    buyers = [i for i in np.argsort(first_buy, kind="stable") if math.isfinite(first_buy[i])][:MAP_BUYERS]
    shown = [i for i in dict.fromkeys(holders + buyers) if groups[i] != "agent"]
    img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), "white")
    if not shown:
        return img
    d = ImageDraw.Draw(img)
    # Group wallets: the team, each linked cluster or likely-team group, then everyone else alone.
    clusters: dict[str, list[int]] = {}
    for i in shown:
        clusters.setdefault(ctx["cluster_of"][i], []).append(i)
    order = sorted(clusters.items(), key=lambda kv: (kv[0] != "team", -sum(held[i] for i in kv[1])))
    radius = {i: 3 + 60 * math.sqrt(held[i] / programs.TOTAL_SUPPLY) for i in shown}
    pos: dict[int, tuple[float, float]] = {}
    center = IMAGE_SIZE / 2
    golden = math.pi * (3 - math.sqrt(5))
    for k, (_, members) in enumerate(order):
        # group centers on a spiral out from the middle (the team first)
        gr = 0 if k == 0 else 34 * math.sqrt(k)
        gx, gy = center + gr * math.cos(k * golden), center + gr * math.sin(k * golden)
        members.sort(key=lambda i: -held[i])
        for j, i in enumerate(members):
            rr = 0 if j == 0 else 9 * math.sqrt(j)
            pos[i] = (gx + rr * math.cos(j * golden), gy + rr * math.sin(j * golden))
    xs = np.array([p[0] for p in pos.values()])
    ys = np.array([p[1] for p in pos.values()])
    scale = min(1.0, (IMAGE_SIZE / 2 - 40) / max(1e-9, np.abs(xs - center).max(), np.abs(ys - center).max()))
    pos = {i: (center + (x - center) * scale, center + (y - center) * scale) for i, (x, y) in pos.items()}
    index = {tok.names[i]: i for i in shown}
    for w1, w2, _, kind in ctx["edges"]:
        if w1 in index and w2 in index:
            a, b = pos[index[w1]], pos[index[w2]]
            if kind == "same_exchange":
                steps = 12
                for s in range(0, steps, 2):
                    p0 = (a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps)
                    p1 = (a[0] + (b[0] - a[0]) * (s + 1) / steps, a[1] + (b[1] - a[1]) * (s + 1) / steps)
                    d.line([p0, p1], fill=COLORS["likely team"], width=1)
            else:
                d.line([a, b], fill=(120, 120, 120), width=1)
    for i in sorted(shown, key=lambda i: -radius[i]):
        x, y = pos[i]
        r = radius[i]
        g = groups[i]
        color = COLORS["cluster"] if g in ("independent", "other") and ctx["cluster_of"][i] != tok.names[i] else COLORS[g]
        if held[i] > 0:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=(60, 60, 60))
        else:
            d.ellipse([x - r, y - r, x + r, y + r], outline=color, width=2)  # sold out: hollow
    return img

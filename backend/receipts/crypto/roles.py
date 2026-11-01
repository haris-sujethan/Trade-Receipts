"""Who's who in a token: the team, likely team, snipers, and clusters of linked wallets (SPEC.md 7.4).

Built from a token's links (dataset.edges) and its early wallets (dataset.wallets):
- the team is the creator, its launch bundle, and the wallets directly linked to them by funding;
- the launch bundle is the wallets that bought in the creation slot, minus sniper bots (wallets
  that buy that early into many tokens);
- likely team is wallets funded from the same exchange with the same amount within minutes of
  each other or of a team wallet, with no funding link;
- snipers are the other wallets that bought in the first seconds;
- clusters are groups of wallets linked by funding (the team is one of them).

`assign` takes a cutoff time: links that only became visible after it are ignored, so a
snapshot's roles use only what was on chain by then. Labels use no cutoff.
"""

from dataclasses import dataclass, field

from receipts.crypto import programs

SNIPE_SECONDS = 10
# A wallet that bought this early into this many tokens (or creators) is a sniper bot.
SNIPER_HABIT = 10
LINKS = ("funded", "shared_funder")
LIKELY = "same_exchange"


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        parent = self.parent
        root = x
        while parent.get(root, root) != root:
            root = parent[root]
        while parent.get(x, x) != root:
            parent[x], x = root, parent[x]
        return root

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


@dataclass
class Wallet:
    wallet: str
    first_buy_slot: int | None  # slots after the creation slot
    first_buy_ts: int | None
    habit: int  # early buys into other tokens (or other creators' tokens, for labels)


@dataclass
class Roles:
    creator: str
    team: set[str] = field(default_factory=set)
    bundle: set[str] = field(default_factory=set)
    likely_team: set[str] = field(default_factory=set)
    likely_group: dict[str, str] = field(default_factory=dict)
    snipers: set[str] = field(default_factory=set)
    sniper_bots: set[str] = field(default_factory=set)
    cluster: dict[str, str] = field(default_factory=dict)  # wallet -> cluster id, linked wallets only
    since: dict[str, int] = field(default_factory=dict)  # team wallet -> when it became visible as team

    def role(self, wallet: str) -> str:
        if wallet == programs.MAYHEM_AGENT:
            return "agent"
        if wallet in self.team:
            return "team"
        if wallet in self.likely_team:
            return "likely_team"
        if wallet in self.snipers:
            return "sniper"
        return "other"


def assign(
    creator: str,
    launch_ts: int,
    wallets: list[Wallet],
    edges: list[tuple[str, str, int, str]],
    cutoff: int | None = None,
) -> Roles:
    """Roles for one token. `edges` are (w1, w2, ts, kind); only those with ts <= cutoff count."""
    visible = [e for e in edges if cutoff is None or e[2] <= cutoff]
    roles = Roles(creator=creator)
    links = UnionFind()
    for w1, w2, _, kind in visible:
        if kind in LINKS:
            links.union(w1, w2)
    for w in wallets:
        if w.wallet in (creator, programs.MAYHEM_AGENT) or w.first_buy_ts is None:
            continue
        if cutoff is not None and w.first_buy_ts > cutoff:
            continue
        if w.habit >= SNIPER_HABIT:
            if w.first_buy_ts <= launch_ts + SNIPE_SECONDS:
                roles.sniper_bots.add(w.wallet)
            continue
        if w.first_buy_slot == 0:
            roles.bundle.add(w.wallet)
    # The team is the creator, its bundle, and wallets one link away from them. Following links
    # further chains in unrelated wallets.
    first_buy = {w.wallet: w.first_buy_ts for w in wallets}
    roles.since = {creator: launch_ts} | {w: first_buy[w] for w in roles.bundle}
    for w1, w2, ts, kind in visible:
        if kind in LINKS:
            for seed, other in ((w1, w2), (w2, w1)):
                if seed in roles.bundle or seed == creator:
                    since = max(int(ts), roles.since[seed])
                    if other not in roles.since or since < roles.since[other]:
                        roles.since[other] = since
    roles.since.pop(programs.MAYHEM_AGENT, None)
    roles.team = set(roles.since)
    for w in roles.team:
        links.union(creator, w)
    members: dict[str, list[str]] = {}
    for w in {x for e in visible if e[3] in LINKS for x in e[:2]} | roles.team:
        members.setdefault(links.find(w), []).append(w)
    for root, group in members.items():
        if len(group) > 1:
            for w in group:
                roles.cluster[w] = root

    likely = UnionFind()
    for w1, w2, _, kind in visible:
        if kind == LIKELY and not (w1 in roles.team and w2 in roles.team):
            likely.union(w1, w2)
    for w1, w2, _, kind in visible:
        if kind == LIKELY:
            for w in (w1, w2):
                if w not in roles.team and w != programs.MAYHEM_AGENT:
                    roles.likely_team.add(w)
                    roles.likely_group[w] = likely.find(w)

    for w in wallets:
        if w.first_buy_ts is None or w.first_buy_ts > launch_ts + SNIPE_SECONDS:
            continue
        if cutoff is not None and w.first_buy_ts > cutoff:
            continue
        if w.wallet not in roles.team and w.wallet not in roles.likely_team and w.wallet != programs.MAYHEM_AGENT:
            roles.snipers.add(w.wallet)
    return roles

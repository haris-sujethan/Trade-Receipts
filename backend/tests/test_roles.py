"""Who's team: the creator, its launch bundle, and wallets one funding link away."""

from receipts.crypto import programs, roles

LAUNCH = 1_000


def _w(name, slot, ts, habit=0):
    return roles.Wallet(name, slot, ts, habit)


def test_team_is_creator_bundle_and_direct_links():
    wallets = [
        _w("bundle", 0, LAUNCH, habit=1),
        _w("bot", 0, LAUNCH, habit=50),       # buys this early into many tokens: a sniper bot
        _w("early", 3, LAUNCH + 2),
        _w("late", 400, LAUNCH + 300),
    ]
    edges = [
        ("funded_by_creator", "creator", LAUNCH - 60, "funded"),
        ("sibling", "bundle", LAUNCH - 30, "shared_funder"),
        ("cousin", "sibling", LAUNCH - 10, "shared_funder"),  # two links from the team: not team
    ]
    r = roles.assign("creator", LAUNCH, wallets, edges)
    assert r.team == {"creator", "bundle", "funded_by_creator", "sibling"}
    assert "bot" in r.sniper_bots and "bot" in r.snipers
    assert "early" in r.snipers
    assert r.role("late") == "other"
    assert r.role(programs.MAYHEM_AGENT) == "agent"


def test_cutoff_hides_links_not_yet_on_chain():
    edges = [("w", "creator", LAUNCH + 600, "funded")]
    assert "w" not in roles.assign("creator", LAUNCH, [], edges, cutoff=LAUNCH + 60).team
    assert "w" in roles.assign("creator", LAUNCH, [], edges, cutoff=LAUNCH + 3600).team


def test_same_exchange_funding_is_likely_team_not_team():
    edges = [("a", "b", LAUNCH - 100, "same_exchange")]
    r = roles.assign("creator", LAUNCH, [_w("a", 50, LAUNCH + 20), _w("b", 60, LAUNCH + 25)], edges)
    assert r.likely_team == {"a", "b"}
    assert r.likely_group["a"] == r.likely_group["b"]
    assert not r.team & {"a", "b"}


def test_team_since_is_when_the_link_appeared():
    edges = [("w", "creator", LAUNCH + 120, "funded")]
    r = roles.assign("creator", LAUNCH, [], edges)
    assert r.since["creator"] == LAUNCH
    assert r.since["w"] == LAUNCH + 120

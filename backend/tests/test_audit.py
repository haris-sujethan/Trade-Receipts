"""The numbers audit: numbers in model-written text must come from the run's tool outputs."""

from receipts.agent import audit

TOOLS = [{"rug_chance": 0.8712, "team_share": 0.2345, "mcap_sol": 3_215_000.0, "independent_buyers": 14,
          "age_s": 900, "holders": 1234, "volume_sol": 52.37},
         {"note": "Top holder owns 6.2% of supply"}]


def check(text, allowed=()):
    return audit.audit(text, TOOLS, allowed)


def test_numbers_from_the_tools_pass_at_the_texts_rounding():
    r = check("Likely rug · 87% rug chance. The team holds 23.5% and 1,234 wallets hold it; "
              "a 3.2M SOL market cap from 14 independent buyers, 15 minutes after launch, with 52.4 SOL of volume. "
              "The top holder owns 6.2%.")
    assert r.passed, [n.text for n in r.unverified]
    assert len(r.numbers) == 8


def test_invented_numbers_fail_and_are_marked():
    text = "The team holds 40% of supply and 3 wallets sold."
    r = check(text)
    assert [n.text for n in r.unverified] == ["40%", "3"]
    assert audit.mark(text, r) == "The team holds [[unverified:40%]] of supply and [[unverified:3]] wallets sold."
    assert "40%" in r.feedback()


def test_rounding_is_held_to_the_precision_shown():
    assert not check("The team holds 23.3%.").passed  # 23.45 rounds to 23.4 or 23.5 at one decimal
    assert check("The team holds 23%.").passed


def test_addresses_tickers_and_allowed_constants():
    r = check("Mint 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU (BABY2) in its first 24 hours.", allowed=(24,))
    assert r.passed and len(r.numbers) == 1


def test_durations_in_seconds():
    assert check("Checked 15m after launch.").passed
    assert check("Checked 900s after launch.").passed
    assert not check("Checked 20 minutes after launch.").passed

"""Glimmer's fine-tuning answers pass the numbers audit: every number they cite is in their prompt.

Reads the built records (data/glimmer/records.jsonl); skipped when they aren't built.
"""

import json
import re

import pytest

from receipts.crypto import glimmer_data, prompt

NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


@pytest.mark.skipif(not glimmer_data.RECORDS.exists(), reason="Glimmer records not built")
def test_answers_cite_only_numbers_from_their_prompt():
    checked = 0
    with glimmer_data.RECORDS.open() as f:
        for line in f:
            r = json.loads(line)
            if not r["answer"]:
                continue
            first, _, reasons = r["answer"].partition("\n")
            assert re.fullmatch(rf"{prompt.ANSWER} (\d+)%", first) and 1 <= int(first.split()[-1][:-1]) <= 99
            for n in NUMBER.findall(reasons):
                assert n in r["prompt"], f"{r['id']}: {n} isn't in the prompt"
            checked += 1
            if checked == 3000:
                break
    assert checked > 100

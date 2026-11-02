"""The numbers audit (SPEC.md 8.4): every number in model-written text must come from this run's
tool outputs, so the explanation can't invent a figure.

A number in the text passes when some value in the tool outputs rounds to it at the precision
the text uses, after its unit:
- "87%" or "87.1%": a share (0.871) or a value already in percent;
- "$3.2M", "1.5K SOL", "2B": the value scaled;
- "10x": a multiple;
- "90s", "5 minutes", "6h": a duration, against values in seconds (or in that unit);
- "1,234" or "0.25": the value itself.
Digits inside addresses, tickers and other words aren't numbers. Constants the product states
(the 24-hour window, the top 10 holders) and numbers in the user's own message are passed in
as `allowed`.

On a failure the agent regenerates once with the unverified numbers pointed out; if that fails
too the text is shown with them marked (`mark`). Every audit is logged for the eval's pass rate.
"""

import datetime as dt
import json
import math
import re
from dataclasses import dataclass, field

from receipts.config import settings

LOG = settings.data_dir / "ledger" / "audit.jsonl"

SCALE = {"k": 1e3, "K": 1e3, "M": 1e6, "m": 1e6, "B": 1e9, "b": 1e9, "thousand": 1e3, "million": 1e6, "billion": 1e9}
SECONDS = {"s": 1, "sec": 1, "secs": 1, "second": 1, "seconds": 1, "m": 60, "min": 60, "mins": 60, "minute": 60,
           "minutes": 60, "h": 3600, "hr": 3600, "hrs": 3600, "hour": 3600, "hours": 3600, "d": 86400, "day": 86400, "days": 86400}
NUMBER = re.compile(
    r"(?<![\w$])(?<!\d\.)(?P<dollar>\$)?(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
    r"(?:\s?(?P<unit>%|x\b|×|(?:thousand|million|billion)\b|[KMBkb]\b"
    r"|(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\b|[smhd]\b))?(?!\w)(?!\.\d)"
)
# A duration letter right after a number is ambiguous with a scale ("5m"): read it as minutes only
# when no value matches it as millions.


@dataclass
class Number:
    text: str
    start: int
    end: int
    value: float
    decimals: int
    unit: str | None
    ok: bool = False
    matched: float | None = None


@dataclass
class Audit:
    numbers: list[Number] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(n.ok for n in self.numbers)

    @property
    def unverified(self) -> list[Number]:
        return [n for n in self.numbers if not n.ok]

    def feedback(self) -> str:
        """What to tell the model when it regenerates."""
        cited = ", ".join(f'"{n.text}"' for n in self.unverified)
        return (f"These numbers aren't in the tool results: {cited}. Use only numbers that appear in the tool "
                "results, rounded as shown there, or leave the number out.")


def values(obj, out: list[float] | None = None) -> list[float]:
    """Every number anywhere in a tool output: fields, list items, and numbers inside strings."""
    out = [] if out is None else out
    if isinstance(obj, bool) or obj is None:
        return out
    if isinstance(obj, (int, float)):
        if not (isinstance(obj, float) and math.isnan(obj)):
            out.append(float(obj))
    elif isinstance(obj, str):
        for m in NUMBER.finditer(obj):
            v = float(m["num"].replace(",", ""))
            out.append(v)
            if m["unit"] == "%":
                out.append(v / 100)
            elif m["unit"] in SCALE:
                out.append(v * SCALE[m["unit"]])
    elif isinstance(obj, dict):
        for v in obj.values():
            values(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            values(v, out)
    return out


def _close(candidate: float, target: float, decimals: int, scale: float = 1.0) -> bool:
    """Does `candidate` round to `target` at the text's precision (in units of `scale`)?"""
    return abs(candidate / scale - target) <= 0.5 * 10 ** -decimals + 1e-9


def _match(n: Number, pool: list[float]) -> float | None:
    v, d, unit = n.value, n.decimals, n.unit
    for c in pool:
        if unit == "%":
            if _close(c * 100, v, d) or _close(c, v, d):
                return c
        elif unit in SCALE:
            if _close(c, v, d, SCALE[unit]) or (unit in SECONDS and _close(c, v, d, SECONDS[unit])) or _close(c, v, d):
                return c
        elif unit in SECONDS:
            if _close(c, v, d, SECONDS[unit]) or _close(c, v, d):
                return c
        elif _close(c, v, d):
            return c
    return None


def audit(text: str, tool_outputs: list, allowed: tuple = ()) -> Audit:
    pool = values(list(tool_outputs)) + [float(a) for a in allowed]
    result = Audit()
    for m in NUMBER.finditer(text):
        raw = m["num"].replace(",", "")
        unit = m["unit"]
        if unit in ("×",):
            unit = "x"
        n = Number(text=m.group(0).strip(), start=m.start(), end=m.end(), value=float(raw),
                   decimals=len(raw.split(".")[1]) if "." in raw else 0, unit=unit)
        n.matched = _match(n, pool)
        n.ok = n.matched is not None
        result.numbers.append(n)
    return result


def mark(text: str, result: Audit) -> str:
    """The text with each unverified number marked, for the UI to style."""
    out, last = [], 0
    for n in result.numbers:
        if not n.ok:
            out += [text[last:n.start], f"[[unverified:{text[n.start:n.end]}]]"]
            last = n.end
    return "".join(out) + text[last:]


def log(run: str, purpose: str, first: Audit, final: Audit) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {"at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "run": run, "purpose": purpose,
             "numbers": len(final.numbers), "first_try_passed": first.passed, "passed": final.passed,
             "unverified": [n.text for n in final.unverified]}
    with LOG.open("a") as f:
        f.write(json.dumps(entry) + "\n")

// Example content for the UI before the backend exists.
// Every number here is an illustrative example value, not a real backtest.

import { drawdown, walk, type Point } from "./series";
import { tokenChecks, tokenMarkdown } from "./tokens";

/* ---------- Strategy Facts labels ---------- */

export type FactsRow = {
  label: string;
  value: string;
  /** "bad" sets the value in red; "strong" sets the whole row in bold. */
  tone?: "bad" | "strong";
  /** Rule drawn under this row. Defaults to a hairline. */
  rule?: "hair" | "bar" | "mid";
};

export type Facts = {
  subject: string;
  serving: string;
  /** The number someone claimed, struck through when the tested one lands. */
  claimed?: { label: string; value: string };
  tested: { label: string; value: string; tone?: "bad" };
  rows: FactsRow[];
  footnote: string;
};

export const rsiFacts: Facts = {
  subject: "RSI dip · BTC-USD · 4-hour",
  serving: "Tested Jan 2021 – Oct 2026 · example values",
  claimed: { label: "Claimed, best 12 months", value: "+300%" },
  tested: { label: "Tested, best 12 months", value: "+38%" },
  rows: [
    { label: "Total return", value: "+41%", tone: "strong" },
    { label: "vs. holding BTC", value: "−221 pts", tone: "bad", rule: "mid" },
    { label: "Max drawdown", value: "−38%" },
    { label: "Trades", value: "148" },
    { label: "Costs included", value: "0.1% + slippage" },
    { label: "Repaints", value: "No" },
    { label: "Look-ahead", value: "No", rule: "mid" },
  ],
  footnote: "Example values. Past results don't predict future returns. Not financial advice.",
};

export const qqqFacts: Facts = {
  subject: "Dip buy · QQQ · daily",
  serving: "Tested Jan 2011 – Oct 2026 · example values",
  tested: { label: "Total return", value: "+164%" },
  rows: [
    { label: "Annual return", value: "6.4%", tone: "strong" },
    { label: "vs. holding QQQ", value: "−812 pts", tone: "bad" },
    { label: "vs. S&P 500", value: "−319 pts", tone: "bad", rule: "mid" },
    { label: "Max drawdown", value: "−29%" },
    { label: "Trades", value: "14" },
    { label: "Time in market", value: "38%" },
    { label: "Costs included", value: "Yes" },
    { label: "Look-ahead", value: "No", rule: "mid" },
  ],
  footnote: "Example values. Past results don't predict future returns. Not financial advice.",
};

export const cashflowFacts: Facts = {
  subject: "Cash-flow top 20 · S&P 500 · monthly",
  serving: "Tested Jan 2010 – Oct 2026 · example values",
  claimed: { label: "Naive backtest, per year", value: "17.9%" },
  tested: { label: "Honest backtest, per year", value: "12.6%" },
  rows: [
    { label: "vs. S&P 500, per year", value: "+1.6 pts", tone: "strong", rule: "mid" },
    { label: "Max drawdown", value: "−25%" },
    { label: "Rebalances", value: "202" },
    { label: "Index members as of each date", value: "Yes" },
    { label: "Cash flow known from filing date", value: "Yes" },
    { label: "Unemployment, first release", value: "Yes" },
    { label: "Look-ahead", value: "No", rule: "mid" },
  ],
  footnote: "Example values. Past results don't predict future returns. Not financial advice.",
};

export const acmeFacts: Facts = {
  subject: "ACME Robotics · ACME · made-up example",
  serving: "Latest quarterly report · example values",
  claimed: { label: "Revenue, as pitched", value: "“Exploding”" },
  tested: { label: "Revenue, reported", value: "+6% YoY" },
  rows: [
    { label: "Free cash flow (TTM)", value: "−$42M", tone: "bad" },
    { label: "FCF margin", value: "−4%", tone: "bad" },
    { label: "Diluted shares, YoY", value: "+9%", tone: "bad", rule: "mid" },
    { label: "Revenue growth, 3y per year", value: "11%" },
    { label: "Stock-based pay / revenue", value: "14%" },
    { label: "Cash minus debt", value: "$118M", rule: "mid" },
  ],
  footnote: "Example values for a made-up company. Not financial advice.",
};

export const moonFacts: Facts = {
  subject: "MOON · Solana · made-up example",
  serving: "Checked 9 days after launch · example values",
  claimed: { label: "Liquidity, as pitched", value: "“Locked”" },
  tested: { label: "Liquidity, on-chain", value: "Unlocked", tone: "bad" },
  rows: [
    { label: "Top 10 holders", value: "61%", tone: "bad" },
    { label: "Held by wallets with one funder", value: "23%", tone: "bad" },
    { label: "Creator can mint more", value: "Yes", tone: "bad" },
    { label: "Creator can freeze wallets", value: "No", rule: "mid" },
    { label: "Similar past launches rugged", value: "84%", tone: "bad" },
    { label: "Fee revenue", value: "None" },
    { label: "Age", value: "9 days", rule: "mid" },
  ],
  footnote: "Example values for a made-up token. Not financial advice.",
};

export const moonResearch = `# MOON (Solana)

Example research file. MOON is a made-up token used to show the layout.

## Answer

The clip says liquidity is locked. On-chain, it isn't: the creator can
still withdraw the pool. Fourteen wallets funded by one address hold 23%
of the supply.

## Claims vs. chain

| Claim | Said at | On-chain | Verdict |
|---|---|---|---|
| "Liquidity is locked" | 0:18 | Pool can be withdrawn | Contradicted |
| "Fair launch, no team tokens" | 0:27 | 23% in linked wallets | Contradicted |
| "This can't rug" | 0:40 | 84% of similar launches did | Contradicted |
`;

/* ---------- Project files ---------- */

export type FileKind = "pine" | "python" | "markdown" | "token" | "clip";

export type ProjectFile = {
  id: string;
  name: string;
  folder: "tokens" | "strategies" | "research" | "clips";
  kind: FileKind;
  content: string;
};

export const rsiPine = `//@version=6
// RSI dip · BTC-USD · 4-hour
//
// Rules, from clips/guru_clip.mp4:
//   Entry: RSI(14) closes below 30          (said at 0:12)
//   Exit:  RSI(14) closes back above 70     (said at 0:19)
//
// Tested in our engine, Jan 2021 – Oct 2026 (example values):
//   Total return +41% · holding BTC +262% · max drawdown -38% · 148 trades
// Verify in TradingView. Not financial advice.

strategy("RSI dip · BTC", overlay = false,
     initial_capital = 10000,
     commission_type = strategy.commission.percent,
     commission_value = 0.1,
     slippage = 5,
     margin_long = 100, margin_short = 100)

rsiLength = input.int(14, "RSI length")
buyBelow  = input.int(30, "Buy below")
sellAbove = input.int(70, "Sell above")

r = ta.rsi(close, rsiLength)

if ta.crossunder(r, buyBelow)
    strategy.entry("Long", strategy.long)

if ta.crossover(r, sellAbove)
    strategy.close("Long")

plot(r, "RSI", color = color.new(color.gray, 0))
hline(buyBelow, "Buy below")
hline(sellAbove, "Sell above")
`;

export const goldenCrossPine = `//@version=6
// Golden cross · ETH-USD · daily
//
// Rules, from your description:
//   Entry: 50-day average crosses above the 200-day average
//   Exit:  50-day average crosses back below the 200-day average
//
// Not run in this preview: running new code comes with the backend.

strategy("Golden cross · ETH", overlay = true,
     initial_capital = 10000,
     commission_type = strategy.commission.percent,
     commission_value = 0.1,
     slippage = 5,
     margin_long = 100, margin_short = 100)

fast = ta.sma(close, 50)
slow = ta.sma(close, 200)

if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)

if ta.crossunder(fast, slow)
    strategy.close("Long")

plot(fast, "50-day", color = color.new(color.white, 0))
plot(slow, "200-day", color = color.new(color.gray, 0))
`;

export const cashflowPython = `"""Cash-flow top 20 · S&P 500 · monthly

From the S&P 500 (members as of each date), equal-weight the 20 stocks with
positive free cash flow that trade above their 200-day average and have the
best 6-month return. Rebalance monthly. Hold short-term Treasuries when
unemployment is above its 12-month average.

Tested in our engine, Jan 2010 - Oct 2026 (example values):
  12.6% a year, S&P 500 11.0% a year, max drawdown -25%
Not financial advice.
"""

from engine import Strategy, universe, fundamentals, macro
from engine import indicators as ta


class CashFlowTop20(Strategy):
    rebalance = "monthly"
    costs = {"commission": 0.0, "slippage_bps": 5}

    def on_rebalance(self, ctx):
        # Unemployment as first released, never the revised number.
        unrate = macro.series("UNRATE", vintage="first_release", asof=ctx.date)
        if unrate.last() > unrate.rolling_mean(months=12).last():
            return ctx.target({"SHY": 1.0})

        # Only companies that were in the index on this date.
        members = universe.sp500(asof=ctx.date)

        # Cash flow is usable only after its 10-K or 10-Q was filed.
        fcf = fundamentals.get("free_cash_flow_ttm", members, known_by=ctx.date)

        picks = [
            s for s in members
            if fcf[s] > 0 and ctx.close(s) > ta.sma(ctx.history(s), 200)
        ]
        ranked = sorted(
            picks,
            key=lambda s: ta.total_return(ctx.history(s), days=126),
            reverse=True,
        )
        top = ranked[:20]
        return ctx.target({s: 1 / len(top) for s in top})
`;

export const acmeResearch = `# ACME Robotics (ACME)

Example research file. ACME is a made-up company used to show the layout.

## Answer

The clip says revenue is "exploding." The filings say revenue grew 6% in the
last year, free cash flow was negative, and the share count rose 9%.

## Claims vs. filings

| Claim | Said at | Filings say | Verdict |
|---|---|---|---|
| "Revenue is exploding" | 0:14 | +6% year over year | Contradicted |
| "They print cash" | 0:22 | Free cash flow -$42M (TTM) | Contradicted |
| "No dilution" | 0:31 | Diluted shares +9% year over year | Contradicted |
`;

// The demo project is crypto only for now; the stock examples below stay in the code for later.
export const projectFiles: ProjectFile[] = [
  { id: "moon", name: "MOON-7xKX.md", folder: "tokens", kind: "token", content: tokenMarkdown(tokenChecks.moon) },
  { id: "kite", name: "KITE-4nPq.md", folder: "tokens", kind: "token", content: tokenMarkdown(tokenChecks.kite) },
  { id: "rsi", name: "rsi_dip.pine", folder: "strategies", kind: "pine", content: rsiPine },
  { id: "golden", name: "golden_cross.pine", folder: "strategies", kind: "pine", content: goldenCrossPine },
  { id: "moonclip", name: "moon_shill.mp4", folder: "clips", kind: "clip", content: "" },
  { id: "clip", name: "guru_clip.mp4", folder: "clips", kind: "clip", content: "" },
];

/* ---------- Runs (results of running a file) ---------- */

export type CheckStatus = "pass" | "caution" | "fail";

export type Run = {
  fileId: string;
  facts: Facts;
  verdict: string;
  claim?: string;
  settings: { symbol: string; timeframe: string; from: string; to: string; capital: string };
  series: { name: string; data: Point[]; focus?: boolean }[];
  drawdown: Point[];
  checks: { name: string; status: CheckStatus; note: string }[];
  readings?: { rule: string; options: { reading: string; result: string; chosen?: boolean }[] };
};

const rsiEquity = walk(7, "2021-01-04", 304, 0.41, 0.06);
const btcHold = walk(19, "2021-01-04", 304, 2.62, 0.09);

const cfEquity = walk(11, "2010-01-04", 878, 6.31, 0.03);
const cfNaive = walk(12, "2010-01-04", 878, 14.2, 0.032);
const spx2010 = walk(5, "2010-01-04", 878, 4.88, 0.028);

function maxDrawdown(dd: Point[]) {
  return `−${Math.abs(Math.min(...dd.map((p) => p.value))).toFixed(0)}%`;
}

function setRow(facts: Facts, label: string, value: string) {
  const row = facts.rows.find((r) => r.label === label);
  if (row) row.value = value;
}

setRow(rsiFacts, "Max drawdown", maxDrawdown(drawdown(rsiEquity)));
setRow(cashflowFacts, "Max drawdown", maxDrawdown(drawdown(cfEquity)));

export const runs: Record<string, Run> = {
  rsi: {
    fileId: "rsi",
    facts: rsiFacts,
    verdict:
      "As stated, this strategy made +41% over almost six years. Simply holding Bitcoin made +262% over the same period.",
    claim: "The clip claimed +300% in a year. The best 12 months in this test were +38%.",
    settings: { symbol: "BTC-USD", timeframe: "4H", from: "2021-01-01", to: "2026-10-29", capital: "$10,000" },
    series: [
      { name: "This strategy", data: rsiEquity, focus: true },
      { name: "Holding BTC", data: btcHold },
    ],
    drawdown: drawdown(rsiEquity),
    checks: [
      { name: "Benchmark", status: "fail", note: "Trails holding BTC after costs." },
      { name: "Costs", status: "pass", note: "Edge holds at 0.1% and at 0.3% per trade." },
      { name: "Out-of-sample", status: "caution", note: "Last 30% of the period: +4% vs. +29% before it." },
      { name: "Parameter wiggle", status: "pass", note: "RSI 25/30/35 and 65/70/75 give similar results." },
      { name: "Random baseline", status: "caution", note: "62nd percentile of 1,000 random strategies." },
      { name: "Regimes", status: "caution", note: "Most gains came from 2023." },
      { name: "Sample size", status: "pass", note: "148 trades over almost six years." },
      { name: "Data audit", status: "pass", note: "4-hour candles, no gaps, no look-ahead." },
    ],
    readings: {
      rule: "“RSI under 30”",
      options: [
        { reading: "Closes below 30", result: "+41%", chosen: true },
        { reading: "Touches 30 during the day", result: "+33%" },
      ],
    },
  },
  cashflow: {
    fileId: "cashflow",
    facts: cashflowFacts,
    verdict:
      "Tested honestly, this strategy made 12.6% a year from 2010, beating the S&P 500's 11.0%. The naive version of the same backtest shows 17.9%, because it uses today's index list and cash flow numbers before they were public.",
    settings: { symbol: "S&P 500 members", timeframe: "1M", from: "2010-01-01", to: "2026-10-29", capital: "$100,000" },
    series: [
      { name: "Honest backtest", data: cfEquity, focus: true },
      { name: "Naive backtest", data: cfNaive },
      { name: "S&P 500", data: spx2010 },
    ],
    drawdown: drawdown(cfEquity),
    checks: [
      { name: "Benchmark", status: "pass", note: "Beats the S&P 500 by 1.6 points a year after costs." },
      { name: "Costs", status: "pass", note: "Holds at 5 and 15 bps slippage." },
      { name: "Out-of-sample", status: "caution", note: "Since 2021 the edge shrinks to 0.4 points a year." },
      { name: "Parameter wiggle", status: "pass", note: "Top 15, 20 and 25 all beat the index." },
      { name: "Random baseline", status: "pass", note: "91st percentile of 1,000 random portfolios." },
      { name: "Regimes", status: "pass", note: "Ahead in 11 of 17 years." },
      { name: "Sample size", status: "pass", note: "202 monthly rebalances." },
      { name: "Data audit", status: "caution", note: "Prices for 31 delisted companies were missing and are flagged." },
    ],
    readings: {
      rule: "“Six-month return”",
      options: [
        { reading: "126 trading days", result: "12.6%/yr", chosen: true },
        { reading: "126 days, skipping the latest month", result: "13.1%/yr" },
      ],
    },
  },
};

/* ---------- Thread replay ---------- */

export type ThreadStep = {
  id: string;
  text: string;
  detail?: string;
  meta?: string;
  rules?: { text: string; at: string }[];
  diff?: { minus: string[]; plus: string[] };
};

export type ThreadMessage =
  | { kind: "user"; text: string; clip?: { name: string; length: string } }
  | { kind: "steps"; steps: ThreadStep[] }
  | { kind: "agent"; text: string; audited?: boolean };

export const rsiThread: ThreadMessage[] = [
  {
    kind: "user",
    text: "Code the strategy in this clip and test it.",
    clip: { name: "guru_clip.mp4", length: "0:48" },
  },
  {
    kind: "steps",
    steps: [
      { id: "s1", text: "Transcribed the audio", meta: "Muse Voice Transcribe · 3.1s" },
      { id: "s2", text: "Watched the clip", detail: "RSI(14) panel on a BTC 4-hour chart", meta: "Muse Spark 1.3 · 6.4s" },
      {
        id: "s3",
        text: "Found 2 rules and 1 claim",
        rules: [
          { text: "Entry: RSI(14) closes below 30", at: "0:12" },
          { text: "Exit: RSI(14) closes back above 70", at: "0:19" },
          { text: "Claim: “made 300% this year”", at: "0:03" },
        ],
      },
      { id: "s4", text: "Chose Pine Script", detail: "One symbol on one chart, so it runs in TradingView" },
      { id: "s5", text: "Wrote strategies/rsi_dip.pine" },
      {
        id: "s6",
        text: "Round 1: fixed 2 compile errors",
        detail: "Pine v6 dropped the when= argument and transp",
        diff: {
          minus: ['strategy.entry("Long", strategy.long, when = r < 30)', 'plot(r, "RSI", color.gray, transp = 0)'],
          plus: [
            "if ta.crossunder(r, buyBelow)",
            '    strategy.entry("Long", strategy.long)',
            'plot(r, "RSI", color = color.new(color.gray, 0))',
          ],
        },
      },
      {
        id: "s7",
        text: "Round 2: fixed 1 honesty problem",
        detail: "strategy() had no commission or slippage, which flatters results",
        diff: {
          minus: ['strategy("RSI dip · BTC", overlay = false)'],
          plus: ['strategy("RSI dip · BTC", overlay = false,', "     commission_value = 0.1, slippage = 5, …)"],
        },
      },
      { id: "s8", text: "Round 3: clean", detail: "0 errors, 0 warnings" },
      { id: "s9", text: "Ran BTC-USD 4-hour, Jan 2021 – Oct 2026", meta: "1.2s" },
      { id: "s10", text: "Red team: 8 checks", detail: "1 fail, 3 cautions" },
    ],
  },
  {
    kind: "agent",
    text:
      "As stated, this strategy made +41% over almost six years. Holding Bitcoin made +262% over the same period. Its best 12 months were +38%, not +300%. The full label is in Results.",
    audited: true,
  },
];

/* ---------- Problems and output ---------- */

export type Problem = {
  severity: "error" | "warning" | "info";
  file: string;
  line?: number;
  message: string;
};

export const rsiProblems: Problem[] = [
  { severity: "warning", file: "Results", message: "Trails holding BTC by 221 points after costs." },
  {
    severity: "warning",
    file: "rsi_dip.pine",
    line: 26,
    message: "“RSI under 30” could mean a close below 30 or a touch during the day. Both were tested; see Results.",
  },
  { severity: "info", file: "rsi_dip.pine", line: 16, message: "Commission assumed at 0.1% per trade. Change it to match your broker." },
  { severity: "info", file: "Results", message: "Most of the profit came from calm uptrends. See P&L by market regime in Results." },
];

export const rsiOutput = [
  "09:41:02  pine-lint   rsi_dip.pine  0 errors, 0 warnings",
  "09:41:02  honesty     commission 0.1%, slippage 5 ticks, no repainting, no look-ahead",
  "09:41:03  engine      BTC-USD 4H  2021-01-01 → 2026-10-29  12,768 bars",
  "09:41:04  engine      148 trades  total +41.2%  max drawdown -38.4%",
  "09:41:05  red team    8 checks  1 fail  3 cautions",
  "09:41:05  audit       12 numbers in the answer, 12 match the run",
];

/* ---------- Stock research ---------- */

export const acme = {
  name: "ACME Robotics",
  ticker: "ACME",
  filing: "10-Q for the quarter ended Sep 30, 2026 (example)",
  answer:
    "The clip says revenue is “exploding.” The filings say revenue grew 6% in the last year, free cash flow was negative, and the share count rose 9%.",
  claims: [
    { claim: "“Revenue is exploding”", at: "0:14", facts: "+6% year over year", verdict: "Contradicted" },
    { claim: "“They print cash”", at: "0:22", facts: "Free cash flow −$42M (TTM)", verdict: "Contradicted" },
    { claim: "“No dilution”", at: "0:31", facts: "Diluted shares +9% year over year", verdict: "Contradicted" },
  ],
  metrics: [
    { label: "Revenue growth, 3y per year", value: "11%", source: "10-K 2025" },
    { label: "Revenue growth, year over year", value: "+6%", source: "10-Q Q3 2026" },
    { label: "Free cash flow (TTM)", value: "−$42M", source: "10-Q Q3 2026", bad: true },
    { label: "FCF margin", value: "−4%", source: "10-Q Q3 2026", bad: true },
    { label: "Diluted shares, year over year", value: "+9%", source: "10-Q Q3 2026", bad: true },
    { label: "Stock-based pay / revenue", value: "14%", source: "10-Q Q3 2026" },
    { label: "Cash minus debt", value: "$118M", source: "10-Q Q3 2026" },
  ],
  revenue: [212, 219, 224, 231, 228, 236, 240, 245],
  shares: [88, 89, 91, 92, 94, 95, 97, 99],
};

/* ---------- Rug check replay: MOON, from a shill clip ---------- */

export const rugThread: ThreadMessage[] = [
  {
    kind: "user",
    text: "Is this token legit? Someone's shilling it everywhere.",
    clip: { name: "moon_shill.mp4", length: "0:52" },
  },
  {
    kind: "steps",
    steps: [
      { id: "m1", text: "Transcribed the clip", meta: "Muse Voice Transcribe · 2.8s" },
      { id: "m2", text: "Read the token off the screen", detail: "Mint shown at 0:21: 7xKX…gAsU", meta: "Muse Spark 1.3 · 5.1s" },
      { id: "m3", text: "Found 3 tokens named MOON", detail: "The clip shows the mint, so it's this one. The other two are copycats" },
      {
        id: "m4",
        text: "Found 3 claims",
        rules: [
          { text: "“Community token, no team”", at: "0:12" },
          { text: "“Dev is doxxed”", at: "0:27" },
          { text: "“This can't rug”", at: "0:40" },
        ],
      },
      { id: "m5", text: "Pulled MOON's first 15 minutes", detail: "412 trades, 212 holders, 96 funding transfers", meta: "1.9s" },
      { id: "m6", text: "Traced who funded every wallet", detail: "2 team clusters: 19 wallets hold 23%. 6 more look like team" },
      { id: "m7", text: "Split the buying by who bought", detail: "Independent buyers: 11% of buy volume" },
      { id: "m8", text: "Wrote tokens/MOON-7xKX.md" },
      { id: "m9", text: "Scored the rug chance", detail: "Likely rug · 87%", meta: "Muse Glimmer" },
    ],
  },
  {
    kind: "agent",
    text:
      "Likely rug, with an 87% rug chance. Two groups of wallets tied to the creator hold 23% of MOON, most early buys were the same 0.5 SOL, and the team has sold into new buyers seven times. The full report is open.",
    audited: true,
  },
];

/* ---------- Rug check replay: KITE, from a pasted mint (home page only) ---------- */

export const kiteSteps: ThreadStep[] = [
  { id: "k1", text: "Found the token from its mint", detail: "KITE · 4nPq…kT2e · graduated 22 minutes after launch" },
  { id: "k2", text: "Pulled KITE's first hour", detail: "1,906 trades, 166 holders, 74 funding transfers", meta: "2.4s" },
  { id: "k3", text: "Traced who funded every wallet", detail: "No linked group holds more than 2%" },
  { id: "k4", text: "Split the buying by who bought", detail: "Independent buyers: 71% of buy volume" },
  { id: "k5", text: "Wrote tokens/KITE-4nPq.md" },
  { id: "k6", text: "Scored the rug chance", detail: "Unlikely rug · 14%", meta: "Muse Glimmer" },
];

export const moonProblems: Problem[] = [
  { severity: "error", file: "MOON-7xKX.md", message: "The team holds 23% of supply across 19 linked wallets." },
  { severity: "error", file: "MOON-7xKX.md", message: "31% of supply was bought in the instant the token launched." },
  { severity: "warning", file: "MOON-7xKX.md", message: "38 of the first 52 buys were exactly 0.5 SOL." },
  { severity: "warning", file: "MOON-7xKX.md", message: "The team sold 7 times, each within seconds of a new buy." },
  { severity: "info", file: "MOON-7xKX.md", message: "Independent buyers made only 11% of the buying." },
];

export const moonOutput = [
  "10:14:02  clip        moon_shill.mp4  transcribed 0:52, mint read at 0:21",
  "10:14:04  chain       MOON 7xKX…gAsU  first 15 min: 412 trades, 212 holders",
  "10:14:07  wallets     96 funding transfers traced  2 team clusters, 1 likely-team group",
  "10:14:08  model       Muse Glimmer  rug chance 0.87 (example value)",
  "10:14:08  audit       9 numbers in the answer, 9 match the check",
];

/* ---------- Clip transcripts ---------- */

export type ClipTurn = { at: string; text: string; tag?: string };

export const clipTranscripts: Record<string, { name: string; length: number; turns: ClipTurn[] }> = {
  clip: {
    name: "guru_clip.mp4",
    length: 48,
    turns: [
      { at: "0:00", text: "Okay, listen up. This one changed everything for me." },
      { at: "0:03", text: "I made 300% this year with it. Three hundred percent.", tag: "Claim" },
      { at: "0:08", text: "Pull up Bitcoin on the 4-hour chart and add the RSI, length 14." },
      { at: "0:12", text: "When RSI closes below 30, you buy. That's the dip.", tag: "Entry rule" },
      { at: "0:19", text: "When it closes back above 70, you sell. Simple.", tag: "Exit rule" },
      { at: "0:26", text: "Don't overthink it. The chart tells you everything." },
      { at: "0:41", text: "Follow for more." },
    ],
  },
  moonclip: {
    name: "moon_shill.mp4",
    length: 52,
    turns: [
      { at: "0:00", text: "Guys, I've never seen a launch like this. MOON is different." },
      { at: "0:12", text: "It's a community token. No team, no insiders, nobody dumping on you.", tag: "Claim" },
      { at: "0:21", text: "Here's the address, get in before it's too late.", tag: "Mint shown" },
      { at: "0:27", text: "The dev is doxxed, I've talked to him myself.", tag: "Claim" },
      { at: "0:40", text: "Look at that chart. This can't rug.", tag: "Claim" },
      { at: "0:48", text: "Not financial advice. But you know." },
    ],
  },
};

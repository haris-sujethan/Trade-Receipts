# Trade Receipts — product spec

> An IDE for trading. Describe a strategy and the agent writes the code, fixes its own errors, and tests it honestly. No coding required. Research the stocks behind it in the same workspace.

- **Builder:** Haris Sujethan (solo)
- **Event:** Meta Global AI Developer Hackathon, Indie Developer track
- **Theme:** Build for Your World
- **Submission deadline:** Wed Nov 4, 2026, 9:00 PM ET ([submit](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit))
- **Status (Oct 30, 2026):** spec settled for the IDE and equities. Crypto is designed but its details are parked until equities works. Nothing is built yet.
- **Name:** Trade Receipts.

The research behind the data and tooling choices is in [notes/data-sources.md](notes/data-sources.md). Items marked **(verify)** couldn't be confirmed and must be checked before they're relied on; they're collected in [Open questions](#14-open-questions).

---

## 1. Problem

Everyday traders and investors make decisions from ideas they can't easily test: their own, a friend's, something they read or watched.

- **Turning an idea into code** means learning Pine Script or Python. Trading code copied from AI chatbots often doesn't compile, and fixing it means knowing the language.
- **Testing it** usually means trusting a backtest that quietly cheats: signals that repaint, data that wasn't public yet, no trading costs, today's winners picked in hindsight.
- **Comparing it** with something simpler, like holding the S&P 500 for 10 years, rarely happens, and that's usually the comparison that matters.
- **Researching a stock** means piecing together filings and finance sites by hand.
- **Researching a coin** is harder still: the data that matters is on-chain and hard to read.

The product is for coding and testing any idea, wherever it came from.

## 2. Product

### In one paragraph

A Cursor-style IDE for trading research with two tabs. **Backtest**: describe a strategy in plain English, or drop in a clip or screenshot. The agent pulls out the exact rules (with timestamps for where each came from), writes the strategy as Pine Script v6 or Python, compiles and lints it, fixes its own errors in a loop you can watch, and runs it on real historical data. Results come with honesty checks and a comparison with the S&P 500, and the code is yours to copy into TradingView or keep. **Analyze**: give it a ticker, or a clip pitching one, and it builds a research file from SEC filings: growth, cash flow, dilution, debt, the pitch's claims checked against the facts, and what happened to similar companies in the past. It never says buy or sell.

### Main feature

**Build and test trading strategies without writing code.** Describe the idea in plain English, or show it a clip or screenshot. The agent writes the code, fixes its own errors, and tests it honestly, and you keep the code. Clean compiles are expected, not the selling point. A clip of a trading guru is the demo's hook, not the product's positioning.

### Use cases

1. **Code my own idea:** "Buy QQQ when it's 10% off its high, sell after a 20% gain."
2. **Code a strategy from a clip or screenshot:** the demo's hook.
3. **Compare strategies:** this strategy vs. the S&P 500 vs. my other strategy, same period, same costs.
4. **Research a stock:** filings-based facts, claims checked, similar companies' outcomes.
5. **Check a coin** (parked until equities works): risk signals and how similar past tokens turned out.

### How this scores

Stage 1 is pass/fail on theme fit and real use of Meta's models. Stage 2 scores 0–10 on four criteria. The top 5 per track are ranked by judges watching the demos live on Nov 9.

| Criterion | Weight | What earns it here |
|---|---|---|
| Impact | 30% | Anyone can turn a trading idea into working, honestly tested code without knowing how to code, and research the companies behind it with real data |
| Use of Meta AI tooling | 25% | Video and image understanding turns clips into code. Voice Transcribe gives timestamped receipts. Structured output drives extraction. Muse Spark writes and fixes code, with Muse Wonder for hard cases. Evals show what each part adds |
| Technical depth | 20% | Compile-lint-run fix loop with measured results, honesty lints from TradingView's own docs, Pine engine accuracy measured against TradingView, a point-in-time Python engine with a future-leak test, numbers audit |
| Demo | 25% | An idea becomes clean, tested code live; a repainting script gets caught; a strategy vs. the S&P over 10 years; a stock's claims checked against its filings |

It stays clear of the hackathon's anti-project list (the kickoff slides add "Streamlit apps" and "Dashboards as the main feature" to the written guide). It's not a basic RAG app, a simple image analyzer, or a Streamlit app; it's an IDE where results are the output of code the agent writes and runs; and it gives no advice.

---

## 3. Principles

1. **Receipts for everything.** Every rule links to the moment in the clip it came from. Every number links to the filing or data behind it.
2. **Numbers come from tools, never from the model.** The model reads, extracts, writes code, and explains. Deterministic code fetches data and computes every figure. A numbers audit (8.4) enforces this.
3. **Honest by default.** Costs always included, benchmark always shown, look-ahead and repainting flagged. If the data can't support an honest answer, say so.
4. **Facts and flags, not advice.** No buy/sell ratings, no price targets. Risk estimates describe what happened to similar past cases and are shown with the model's measured accuracy.
5. **Show the work.** The thread streams each step as it happens, including every fix round.
6. **Learn from history.** Models learn from past outcomes (past companies now; past tokens when crypto is built). Tracking new predictions forward is a future feature.
7. **It's an IDE.** Strategies are files. Running them produces results. Errors and honesty issues are problems in the code. The agent does the work; follow-up questions lead to new code and new runs.

---

## 4. Experience

### 4.1 First visit

**Home page → sign-up screen → guided tour → your own IDE.**

**Home page**

- Headline: "Build and test trading strategies without writing code." (draft wording)
- A short looping demo of an idea turning into working, tested code.
- 3–4 feature blocks: honesty checks, comparison with the S&P, stock research, crypto (coming soon).
- A Launch button.
- Footer: data credits ("Data from Tiingo," "Crypto data: Binance Vision") and "Not financial advice."

**Sign-up screen**

- "Continue with Google," "Continue with GitHub," and "Continue with email" are shown but greyed out, with a small note: "Sign-up opens after the hackathon."
- One highlighted button: **"Meta Hackathon: skip sign-up."** The event name is text only, no Meta logo.
- There are no real accounts behind this screen.

**Guided tour**

- Runs on top of a demo project. Every step points at a feature and has **Next** and **Skip**.
- The demo is a **scripted replay of a cached run**: no live API calls, instant, free, and it can't fail in front of a judge. Its strategy runs on BTC daily prices from Binance's public archive, which can be shown publicly with credit (cached stock results would need Tiingo's permission).
- Steps:
  1. **Explorer:** "Your strategies, research, and clips live here."
  2. **Thread:** "Type an idea or drop a clip."
  3. **An idea becoming code:** agent steps stream in the thread and the Pine file appears.
  4. **Problems panel:** "The agent caught and fixed these errors and honesty issues."
  5. **Results:** verdict, equity curve vs. the S&P, stats.
  6. **Settings bar:** symbol, timeframe, dates.
  7. **Copy / Download .pine:** "Take it to TradingView."
  8. **Analyze tab:** a research file for one stock.
  9. **Get started.**
- Shows **once per browser** (stored in the browser, since there are no accounts). A "Replay tour" option lives in the help menu.

**Your own IDE**

- Opens with empty `strategies/`, `research/`, and `clips/` folders.
- Three suggested prompts in the thread: "Code the strategy in this clip," "Compare QQQ with the S&P over 10 years," "Research AAPL."
- The tour's demo project stays available as a read-only **Examples** folder.

### 4.2 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Logo                Backtest   Analyze               [icons]     │
├───────────┬─────────────────────────────────┬────────────────────┤
│ Explorer  │ Main area                       │ Thread             │
│           │ tabs: [Results] [rsi_dip.pine]  │                    │
│ strategies│ settings: symbol · tf · dates   │ you: text or clip  │
│  rsi.pine │                                 │ agent: live steps  │
│ research  │ Results: verdict and explanation│                    │
│  AAPL.md  │ text, equity curve vs. S&P,     │                    │
│ clips     │ stats, honesty checks           │ [type or drop a    │
│ Examples  │ code files open here as tabs    │  clip here]        │
├───────────┴─────────────────────────────────┴────────────────────┤
│ Problems | Output                                                │
└──────────────────────────────────────────────────────────────────┘
```

- **Top bar:** logo on the left; centered text tabs **Backtest** and **Analyze** (selected one white, the other grey, no pill or background); icons on the right (help with "Replay tour," theme, and so on).
- **Explorer (far left, like VS Code):** project files, with new-file, refresh, and share buttons.
- **Main area:** Results (verdict and explanation text, graphs, stats, checks) and code files as tabs. A **Split** button shows results and code side by side. A **settings bar** above Results sets symbol, timeframe, date range, and starting capital; defaults come from the file or the clip, and each Pine file remembers its last settings. Empty state: "Open a file or ask the agent to create one."
- **Thread (right):** where you type or drop a clip or screenshot; agent steps stream live. New-thread and history buttons.
- **Bottom panel:** **Problems** (compile errors, honesty lints, ambiguous rules, data gaps) and **Output** (run logs).

### 4.3 Working in the IDE

- **For anyone:** answers match the depth of the question, and the agent simplifies on request ("explain that like I'm new to this").
- **Tabs:** Backtest and Analyze share one workspace and thread. The tab sets what the agent does with your next input and what "New file" creates; any file opens in either tab.
- **Agent edits:** shown as red/green diffs with **Accept** and **Reject**, plus an auto-accept toggle.
- **Problems in the code:** compile errors, honesty lints, ambiguous rules from a clip ("'six months' was ambiguous, so both readings were tested"), and data gaps show as squiggly underlines and as entries in the Problems panel.
- **Storage:** projects live in the browser (IndexedDB), with **Download project (.zip)** and **Open project** for backup and moving between browsers.
- **Getting code out:** each file has **Copy** and **Download** (.pine or .py). Pine files start with a header comment (5.4).
- **Tiingo key:** asked for the first time someone runs something that needs stock data, with a one-minute signup explanation. Cached examples and runs on major coins (BTC, ETH, and others from Binance's archive) never need a key, so judges can try strategies right away; stock runs need their own free key. The key is stored in the browser and sent to the backend only with the requests that need it; it's never logged.
- **Tiingo quota:** before a run, show how many symbols it needs against the key's remaining monthly quota (500 symbols/month, 50 requests/hour on the free tier); offer a shorter period when it doesn't fit. Each symbol is downloaded once and cached in the user's browser.
- **Usage limits:** each visitor gets a few clip uploads per day, with clips up to 90 seconds. Demo content is cached.

### 4.4 Visual style

- Black theme, thin borders, monospace for code and numbers, sans-serif for everything else.
- Status colors: red = error or red flag, amber = warning or caution, green = pass, grey = can't check.
- Editor: Monaco (the editor inside VS Code). Charts: TradingView's open-source `lightweight-charts` (follow its attribution requirement **(verify)**).
- Our own name, logo, and styling. The three-pane layout is a standard IDE pattern; we don't copy any product's branding.

---

## 5. Backtest: code any strategy

### 5.1 Inputs

| Input | How it's read |
|---|---|
| Video clip (mp4, up to 90 s) | Audio → Muse Voice Transcribe (timestamped turns, keyword biasing). Frames → Muse Spark 1.3 (on-screen text, indicators and their settings, chart, timeframe, ticker). |
| Screenshot | Muse Spark 1.3 reads the chart: indicators and settings, timeframe, ticker, annotations. |
| Plain English | Muse Spark 1.3 parses it directly. |
| Existing code (pasted Pine) | Linted and run as is; honesty problems flagged; the agent offers fixes. |

Users upload clips themselves. The app never downloads from social platforms.

### 5.2 Pipeline

1. **Ingest.** Split the clip into an audio track (mono 16-bit PCM, 16 or 24 kHz) and the video file.
2. **Transcribe.** `POST https://api.meta.ai/v1/asr/transcribe` with `keywords` set to tickers, indicator names, and trading terms (RSI, MACD, EMA, VWAP, stop loss, take profit, and so on). Output: transcript plus `turns` with start times.
3. **Watch.** Upload the video through the Files API (`purpose: "user_data"`) and send it to Muse Spark 1.3 in a Responses request (`input_file`). Ask for everything on screen that defines rules, with approximate timestamps.
4. **Extract rules.** Muse Spark 1.3 with structured output turns the transcript and on-screen notes into rules (5.3). Each rule carries its source; vague phrases are listed as ambiguities with candidate readings; performance claims are captured.
5. **Choose the language.** Pine or Python, by what the rules need (5.4). The agent says why.
6. **Write and fix.** The fix loop (5.5) until the code is clean and runs.
7. **Run.** On the Pine engine (5.6) or the Python engine (5.7), with the settings bar's symbol, timeframe, and dates. Every reasonable reading of an ambiguous rule is run.
8. **Red team.** Automated checks try to break the result (5.8).
9. **Verdict.** Claim vs. reality and an explanation, after the numbers audit (8.4).

### 5.3 Extracted rules

The structured output Muse Spark fills in step 4. It becomes the plain-English summary shown above the code and the source of ambiguity warnings.

**Single-symbol strategy from a clip**

```json
{
  "name": "RSI dip on BTC",
  "symbol": "BTC-USD",
  "timeframe": "1D",
  "entry": [
    { "rule": "RSI(14) closes below 30", "source": { "kind": "transcript", "t": 12.4 } }
  ],
  "exit": [
    { "rule": "RSI(14) closes above 70", "source": { "kind": "transcript", "t": 19.1 } }
  ],
  "risk": { "stop_loss": null, "take_profit": null },
  "claims": [ { "text": "made 300% this year", "t": 3.0, "metric": "total_return", "value": 3.0, "window": "1y" } ],
  "ambiguities": []
}
```

**Multi-stock strategy with a macro filter (the showcase)**

> From the S&P 500, equal-weight the 20 positive-cash-flow stocks above their 200-day average with the best six-month return. Rebalance monthly; move to Treasuries when unemployment is above its one-year average.

```json
{
  "name": "Cash-generating uptrend with unemployment guard",
  "universe": { "index": "SP500", "point_in_time": true },
  "filters": ["free cash flow (TTM) > 0, known from filing date", "close > SMA(200)"],
  "rank": { "by": "6-month total return", "order": "desc", "top_n": 20 },
  "weighting": "equal",
  "rebalance": "monthly, first trading day",
  "regime": { "when": "unemployment > its 12-month average (first-release values)", "then": "hold short-term Treasuries" },
  "ambiguities": [
    { "about": "positive-cash-flow", "readings": ["free cash flow > 0", "operating cash flow > 0"] },
    { "about": "six-month return", "readings": ["126 trading days", "126 days skipping the latest 21"] },
    { "about": "Treasuries", "readings": ["T-bills (0–3 month)", "short-term (1–3 year)", "10-year"] }
  ]
}
```

### 5.4 Pine or Python

The agent picks automatically and explains why.

| The strategy needs | Language | Why |
|---|---|---|
| One symbol on one chart: indicators, entries, exits, stops | **Pine Script v6** | Runs in TradingView; the most common case |
| Several stocks at once (ranking, rotation, S&P universe) | **Python** | Pine works on one chart symbol |
| SEC fundamentals (FCF, dilution) | **Python** | Pine's financial data only exists inside TradingView |
| Macro data (unemployment, rates) | **Python** | Not available to Pine outside TradingView |
| The user asks for Pine, but it needs any of the above | **Python** | The agent explains what TradingView can't express |

**Stock universes (first version):** a single ticker (Pine or Python), a custom list, and the S&P 500 using its members as of each date (both Python). Other indexes come later, once historical membership data is found.

**Pine file conventions**

- `//@version=6`.
- `strategy()` always sets commission, slippage, initial capital, and margin explicitly (defaults: $0 commission, 5 bps slippage). TradingView defaults these to zero, which flatters results.
- A header comment: plain-English rule summary; source (clip name and timestamps, if any); backtest results (symbol, timeframe, period, return vs. buy-and-hold, max drawdown, trades); the date; and "Tested in our engine. Verify in TradingView."

**Python file conventions**

- A strategy class against our engine's API. Its hooks only receive data up to the current bar, and its universe, fundamentals, and macro accessors enforce point-in-time data.
- Runs in a sandbox (8.2).
- The downloaded file runs with our open-source engine package and the user's own Tiingo key.

### 5.5 The fix loop

Every piece of code goes through this before it's marked done, and each round shows in the thread ("Round 2: fixed 3 errors: removed `when=`, …").

1. **Write** (Muse Spark 1.3).
2. **Lint.**
   - Pine: `pine-lint` (MIT, offline) plus our honesty rules (below). Never its `--tv` mode, which calls an undocumented TradingView endpoint.
   - Python: standard linting plus checks against our engine's API.
3. **Run** a quick backtest on cached data; capture runtime errors.
4. **Fix** using the diagnostics, then repeat.
5. **Escalate** to Muse Wonder after 3 failed fix rounds. Stop after a fixed cap (around 8 rounds) and show any remaining problems honestly.
6. **Done** = no errors, and every honesty lint is either fixed or explicitly accepted by the user (it then stays as a warning).

**Honesty lints for Pine** (from TradingView's own docs)

| Rule | Why |
|---|---|
| `request.security` with `lookahead_on` and no `[1]` offset | Future leak; TradingView doesn't allow such publications |
| Higher-timeframe `request.security` without offset or `barstate.isconfirmed` | Repaints |
| `calc_on_every_tick = true` | Repaints |
| `calc_on_order_fills = true` | Look-ahead on historical bars |
| `process_orders_on_close = true` | Same-bar fills are typically unrealistic |
| Missing commission, zero slippage, zero margin in `strategy()` | Flatters results |
| Strategy on Heikin Ashi or other non-standard charts | Unrealistic fills; use `fill_orders_on_standard_ohlc` |
| `varip`, `timenow`, most `barstate.*`, plotting into the past | Repaint |
| Fewer than 100 trades | Too few to mean anything |

Pine v6 traps models commonly make (removed `when=` and `transp`, `bool` can't be `na`) are caught by the linter and fixed in the loop.

### 5.6 Running Pine

- **Engine:** an open-source Pine runtime that executes the strategy on our own price data, run as a separate Node process.
- **Choice made in phase 1** between:
  - **Resin** (Apache-2.0, TypeScript, v5/v6; claims a close match to TradingView; very new).
  - **PineTS** (AGPL-3.0, TypeScript; v6 experimental; its own docs show 12 of 31 TradingView strategy scripts matching exactly).
- **Parity test:** about 10 Pine strategies; the builder records TradingView Strategy Tester results by hand (net profit, number of trades, max drawdown) and we compare. The better engine wins, and the match rate is published.
- **License:** if PineTS wins, the project is licensed AGPL-3.0 (the repo is public anyway).
- **Labeling:** results say "Tested in our engine." TradingView's compiler is the final check, by pasting the code there.
- **Never** feed TradingView data into our engine (TradingView's terms forbid it).
- **Honesty for Pine:** the engine follows TradingView's semantics, so honesty comes from the lints, forced costs in `strategy()`, the red team, and the benchmark comparison.

### 5.7 Python engine

Deterministic Python. It steps through history one bar at a time (event-driven), which handles stops, sizing, and rebalancing correctly. Indicators are precomputed with vectorized code, using only data up to each bar.

**Bars**

- **Stocks: daily OHLCV only** (open, high, low, close, volume). There's no free, licensed source of intraday stock history. When a strategy targets an intraday stock chart, the agent says it can't test that honestly and offers to adapt it to daily bars, with the user's OK.
- **Stocks:** prices adjusted for splits; dividends credited on the ex-dividend date, so results are total return.
- **Crypto:** daily bars in UTC; intraday when crypto is built (section 7).

**How orders fill**

| Order | Rule |
|---|---|
| Market (default) | Signal on day *t*'s close; fill at day *t+1*'s open, plus slippage |
| Stop loss | Triggers when the day's low reaches the stop. If the day opens below the stop, fill at the open (real gap risk) |
| Take profit | Triggers when the day's high reaches the target |
| Stop and target both inside one day's range | Daily bars can't show which came first, so assume the stop hit first (the conservative choice) |
| Limit | Fills only if the price trades through the limit, not just touches it |
| Delisting | Position closes at the last traded price, or at zero for a bankruptcy |

**No look-ahead**

- Signals use only bars up to and including *t*; fills happen at *t+1* or later.
- Fundamentals are only usable after their **SEC filing date**, not the period-end date.
- Macro data uses the **first-release** value, from its release date.
- Index membership is **point-in-time**: a stock is only eligible while it was actually in the S&P 500.

**Costs:** $0 commission and 5 bps slippage by default, editable per strategy.

**Output stats:** total return, CAGR, max drawdown, volatility, Sharpe, Sortino, win rate, profit factor, average trade, number of trades, time in market, turnover.

**Tests (required)**

- **Future-leak test:** for random dates *t*, change all prices after *t* and assert every signal and fill on or before *t* is unchanged.
- **Known-answer tests:** buy-and-hold equals the asset's total return; a hand-computed SMA crossover matches exactly; a stop loss hit by a gap fills at the open.

### 5.8 Red team

Runs on every backtest, for both engines (Pine strategies are re-run with changed inputs, periods, and costs). Each check is pass, caution, or fail with a one-line explanation.

| Check | What it does | Fails when |
|---|---|---|
| Benchmark | Compare with buy-and-hold of the same asset, and the S&P 500 for stocks | Strategy trails the benchmark after costs |
| Costs | Re-run with realistic and pessimistic costs | The edge disappears under realistic costs |
| Out-of-sample | Report the last ~30% of the period separately | Results collapse on unseen data |
| Parameter wiggle | Re-run neighbors (RSI 25/30/35; SMA 150/200/250) | The result depends on one exact value |
| Random baseline | 1,000 runs with random entries at the same trade count and time in market | Not clearly better than random |
| Regimes | Break results out by bull, bear, and sideways years | All gains come from one regime |
| Sample size | Count trades; bootstrap a confidence interval | Too few trades to mean anything |
| Data audit | Survivorship, look-ahead, delisted-stock coverage | Data can't support an honest answer (shown, not hidden) |

**Naive vs. honest.** For the showcase strategy, run it the way most backtests do it (today's S&P 500 list, period-end fundamentals, revised unemployment data) and the honest way, and plot both. The gap is the story.

### 5.9 Compare

- **Benchmarks:** S&P 500 (total return, dividends reinvested), Nasdaq-100, buy-and-hold of the same asset, 60/40 stocks and bonds, T-bills (cash).
- **Other strategies:** anything in the project, or a new one typed into the thread.
- **Fair by construction:** same period, starting capital, and costs. Presets: 1, 3, 5, 10 years, and max. Limited to the shortest history among the items, and the app says so.
- **Plain language:** "how does this compare with the S&P over the past 10 years?" picks the benchmark and period.
- **Output:** overlaid equity curves (log scale option), drawdown chart, comparison table (total return, CAGR, max drawdown, Sharpe, worst year, longest time to recover), year-by-year returns, rolling windows ("beat the S&P in 38% of rolling 3-year windows," illustrative).

### 5.10 Results and export

Results are the output of a run, in the main area.

- Verdict and explanation, after the numbers audit
- Claim vs. reality, for example "Claimed +300% in a year. As stated: +41% over its best 12 months, and it trails buy-and-hold after costs" (illustrative)
- Clip player with rule markers on its timeline, when the strategy came from a clip
- Equity curve vs. benchmark (naive vs. honest where it applies), with one click to add comparisons (5.9)
- Stats, red-team checks
- Every reading of an ambiguous rule, side by side
- **Export:** Copy, Download (.pine or .py), Download project (.zip)

---

## 6. Analyze: stocks

### 6.1 Inputs

- A ticker, a screenshot, or a clip pitching a stock.
- From a clip, Muse Spark extracts the ticker and each **claim** (text, timestamp, metric, direction or number). Example: "revenue is exploding" → metric `revenue_growth_yoy`, direction `strongly_up`, t = 0:14.

### 6.2 Data

- **SEC EDGAR XBRL API** (free, official):
  - `https://www.sec.gov/files/company_tickers.json` maps tickers to CIK numbers.
  - `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` returns all reported facts with period, form type, and **filing date**.
  - Fair-access rules: a `User-Agent` header with name and email; under 10 requests per second.
- **Prices:** Tiingo with the user's own key (section 9), for valuation metrics and outcomes.
- **Scope:** US SEC filers (10-K and 10-Q). Foreign filers (20-F/IFRS) are out of scope at first, and the app says so.

### 6.3 Metrics

| Metric | Computation | Main XBRL tags (fall back in order) |
|---|---|---|
| Revenue growth, 3y and 5y CAGR | From annual revenue | `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`, `RevenueFromContractWithCustomerIncludingAssessedTax`, `SalesRevenueNet` |
| Revenue growth, year over year | Latest quarter vs. same quarter last year; TTM vs. prior TTM | as above |
| Gross and operating margin trend | ÷ revenue, 8 quarters | `GrossProfit`, `OperatingIncomeLoss` |
| Free cash flow (TTM) | Operating cash flow − capital spending | `NetCashProvidedByUsedInOperatingActivities`, `PaymentsToAcquirePropertyPlantAndEquipment` |
| FCF margin | FCF ÷ revenue | — |
| Dilution | Change in diluted share count, YoY and 3y | `WeightedAverageNumberOfDilutedSharesOutstanding`, `dei:EntityCommonStockSharesOutstanding` |
| Stock-based pay | ÷ revenue | `ShareBasedCompensation` |
| Cash vs. debt | Cash minus total debt | `CashAndCashEquivalentsAtCarryingValue`, `LongTermDebt`, `LongTermDebtCurrent`, `DebtCurrent` |
| Profitability | Net income, TTM | `NetIncomeLoss` |
| Valuation | Price ÷ sales, price ÷ FCF, P/E | needs price and shares |

**Traps the code must handle**

- **Year-to-date values:** 10-Q cash flows are year-to-date. Q2 = 6-month YTD − Q1; Q4 = annual − 9-month YTD.
- **Tag changes:** companies switch revenue tags over time (for example, after the 2018 revenue standard). Pick per period, not per company.
- **Restatements:** use the latest value for current views and the value as first filed for backtests.
- **Missing data:** show "can't check" with the reason, never a guess.

### 6.4 Claim check

Each claim maps to a metric and gets **supported**, **contradicted**, or **can't check**. Claims filings can't answer ("best management in the industry") are marked can't check, not judged.

### 6.5 Research files

- Analyzing a ticker creates `research/AAPL.md`.
- Contents, answer first: the agent's answer in plain language (to the user's question, or "what stands out"), claims vs. facts (each claim linked to its moment in the clip), metric cards linked to their filings, 8-quarter trends, and similar companies (6.6).
- **Refresh** re-runs it after new filings, with a diff of what changed ("FCF margin 12% → 9% after the Q3 10-Q").
- **Backtest companies like this** writes a Python strategy that screens for the same profile (for example, negative FCF and 10%+ yearly dilution) and runs it.

### 6.6 Similar companies

"What usually happened to companies that looked like this?"

- **Universe:** past S&P 500 members (about 850 companies), the same price download as the S&P showcase. A wider universe would take months on a free Tiingo key.
- **Profiles:** for every past 10-K and 10-Q, the company's profile as of the filing date: growth, margins, FCF margin, dilution, stock-based pay, debt, valuation.
- **Outcomes:** the next 1 and 3 years: return vs. the S&P 500, further dilution, reverse splits, delisting or bankruptcy.
- **Similar companies:** the closest past profiles and how their outcomes were spread ("of 214 past companies with negative FCF and 10%+ yearly dilution, 61% trailed the S&P over the next 3 years," illustrative).
- **Risk model:** estimates the chance of specific bad outcomes (such as a 50% drawdown, or 10%+ more dilution, within 12 months), always shown with its measured accuracy.
- **Honesty:** profiles use only what was filed at the time; outcomes include delisted and bankrupt companies (Tiingo covers them).
- **Dependency:** serving these stats to every visitor from one shared dataset needs Tiingo's permission (section 14). Without it, this feature works in the demo and for users who download the data with their own key.
- Presented as history, not a prediction or a recommendation.

---

## 7. Analyze: crypto (parked)

**Status:** designed, but its details (data stack, chain order, launchpads, model specifics) will be settled after equities works. The research is in [notes/data-sources.md](notes/data-sources.md). Decisions still open are listed in 7.9.

**Key research finding:** on the major launchpads (pump.fun, Raydium LaunchLab, Clanker, Zora, likely four.meme), the creator usually can't pull liquidity; LP is burned or locked. The real rug is the creator, insiders, or bundled wallets selling into buyers. The checklist should weight holder and linked-wallet signals above "is liquidity locked." Pulled liquidity matters mainly for plain Uniswap-style pairs, mostly on Ethereum.

### 7.1 Inputs and token resolution

- A name, ticker, or contract address; a screenshot; or a clip shilling a token.
- **Address from the clip:** Muse Spark reads it from the frames. Candidate: SAM 3.1 locates the text overlay so it can be cropped and read at full resolution (kept only if the eval shows it helps).
- **Address validation:** Solana: valid base58, 32 bytes, an existing token mint. EVM: valid hex, EIP-55 checksum where mixed-case, has contract code.
- **Copycats:** search pairs by name; when several tokens share a name, list candidates ranked by age and liquidity and ask the user to pick. Never choose silently.
- **Chains (proposed order):** Solana, Base, BNB Chain, Ethereum.

### 7.2 Three kinds of coins

| Kind | How it's detected | Checks |
|---|---|---|
| Major coin | Large market cap and long history | Age, liquidity, supply schedule, network fees |
| Protocol token | Maps to a DefiLlama protocol | Fees, revenue, holder payouts, TVL trend, dilution, holder mix |
| New token | Everything else | Scam-risk checklist (7.3) |

### 7.3 Scam-risk checklist (new tokens)

Each check answers: *can someone take the money and run?* Pass, caution, red flag, or can't check, with explorer links as evidence. The same signals are the features the risk model learns from (7.7).

| Check | What it looks at | Red flag example |
|---|---|---|
| Age | Contract and first pool creation | Created days ago |
| Mint permission | Solana `mintAuthority`; EVM mint functions | Supply can be inflated |
| Freeze / blacklist | Solana `freezeAuthority`; EVM blacklist and pause | Team can freeze your tokens |
| Token-2022 extensions (Solana) | Transfer fee, permanent delegate, transfer hook | Permanent delegate can move anyone's tokens |
| Sellability (EVM) | Simulate a buy then a sell on a local fork (`anvil --fork-url`); cross-check GoPlus | Sell fails or is heavily taxed |
| Tax control | Can the owner change taxes later? | Tax is modifiable |
| Ownership | Renounced? Upgradeable proxy? Hidden owner? Verified source? | Upgradeable with an active owner |
| Holder concentration | Top 10 share, excluding pool, burn, locked, and vesting addresses | Top 10 hold over half |
| Linked wallets | Group top holders by first funding source; flag same-block launch buyers | 14 wallets funded by one address hold 23% |
| Creator history | Other tokens the creator (or its funder) deployed, and how they ended | 23 launched before; 21 rugged |
| Liquidity | Pool size, liquidity vs. market cap, LP burned/locked/held by creator | Creator can withdraw the pool |
| Volume quality | Share of volume from a few wallets | A handful of wallets trading back and forth |
| Finances | Any fee revenue or real use | None: price depends on new buyers |
| Timing vs. clip | Price and wallet activity around the clip's post date | Pumped before the clip; big wallets sold right after |
| Claims vs. chain | "Liquidity locked," "dev doxxed," "audited" checked against chain data or search | Clip says locked; chain says not |

**Linked-wallet tracing:** each top holder's earliest incoming funding transfer; group by funder up to 2 hops; don't link through exchange hot wallets (very high outgoing counts or a known list); show a funder → wallets → % of supply graph.

### 7.4 Protocol tokens

Fees, revenue, and holder revenue (30-day and annualized) from DefiLlama; TVL trend; FDV ÷ annualized fees; dilution via circulating ÷ max supply and FDV ÷ market cap (unlock schedules are paid-only); labeled top holders.

### 7.5 Major coins

Age, market cap, liquidity, supply schedule, network fee revenue. Scam checks are skipped, and the app says why.

### 7.6 Own on-chain indexer

- **EVM:** token `Transfer` logs and pool `Swap` events through a free RPC (Ankr's 3,000-block log range is the best free option); replayed into balances and candles. Etherscan isn't used in the public app (its terms treat any app offered to others as commercial).
- **Solana:** `getTokenLargestAccounts`, `getAccountInfo`, and full history through Helius's free tier.
- **Point-in-time snapshots** ("who held what on day 3") produce the model's training data.
- **Training data in bulk:** Google BigQuery public datasets for Solana, Ethereum, and Base; Coinbase's CDP SQL API for Base. No free bulk source for BNB Chain.

### 7.7 Learning from past tokens

- **Dataset:** past launches per chain (several thousand), rebuilt as snapshots at 1 hour, 1, 3, 7, 14, and 30 days after launch, each using only what was knowable then.
- **Labels:** hard rug (liquidity pulled), soft rug (insiders sold, price fell 90%+ from peak), faded (activity died), survived (90+ days of trading, no 90% collapse). Thresholds informed by the MELT and SolRPDS datasets, tuned, then frozen before the final eval.
- **Features:** every checklist signal as a number, plus creator history.
- **Models:** gradient-boosted trees with calibrated probabilities; logistic regression and the checklist score as baselines.
- **Explanations:** top feature contributions as "top reasons," and similar past tokens with explorer links.
- **No cheating:** split by launch date (train on older, test on newer); features only from snapshot data; creator history only counts outcomes known at the snapshot time.
- **Token strategy backtests:** strategies across past launches ("buy every new token rated under 20% risk at day 3, sell after 14 days") use walk-forward model scores.
- **Future feature:** tracking new tokens forward, labeling their outcomes after 30 and 90 days, retraining, and publishing a track record.

### 7.8 Result view

A research file per token (for example, `research/MOON-solana.md`) with refresh and a diff of changes: header (token, chain, address, kind, red-flag count), how it was resolved, the agent's answer, risk score with accuracy and similar past tokens, claims vs. chain, then evidence (checklist, holder breakdown, linked-wallet graph, price chart with the clip's date).

### 7.9 Crypto decisions still open

Data stack details; whether Binance's archive (non-commercial license) is used for research only; chain order; token research files with refresh and diff; the three kinds of coins; the model's headline number (chance of a rug within 30 days); scoring only tokens up to 30 days old; launchpad bonding-curve tokens (starting with pump.fun); copycat handling; token strategy backtests; explanation format.

---

## 8. Agent design

### 8.1 Orchestrator

Muse Spark 1.3 with tool calling. It plans, calls tools, reads results, asks the user when needed, writes code, and explains. It never computes numbers itself.

### 8.2 Tools

| Tool | Does | Backed by |
|---|---|---|
| `transcribe(audio, keywords)` | Timestamped transcript | Muse Voice Transcribe |
| `watch(video_file_id, question)` | On-screen rules, indicators, timestamps | Muse Spark 1.3 |
| `read_image(image, question)` | Chart and screenshot reading | Muse Spark 1.3 |
| `extract_rules(transcript, notes)` | Rules, ambiguities, claims | Muse Spark 1.3 structured output |
| `write_code(rules, language, diagnostics)` | Pine or Python code, as a diff | Muse Spark 1.3; Muse Wonder on escalation |
| `lint_pine(code)` | Diagnostics | `pine-lint` + honesty rules |
| `lint_python(code)` | Diagnostics | Linter + engine API checks |
| `run_pine(code, settings)` | Trades, equity, runtime errors | Pine engine (5.6) |
| `run_python(code, settings)` | Results, runtime errors | Python engine in a sandbox (Modal Sandboxes **(verify)**) |
| `red_team(file, settings)` | Honesty checks | Both engines |
| `compare(items, period)` | Side-by-side results | Both engines |
| `prices(symbol, start, end)` | Daily OHLCV | Tiingo, user's key |
| `company_facts(ticker)` | Filing data | SEC EDGAR |
| `stock_metrics(ticker)` | Section 6.3 metrics | Python |
| `similar_companies(ticker)` | Past profiles and outcomes | Stock model (6.6) |
| `macro_series(id, vintage)` | FRED/ALFRED series | FRED API |
| `web_check(claim)` | Off-chain claims | Muse Spark search grounding |
| `audit_numbers(text, run_id)` | Numbers audit | Python |

Crypto tools (token resolution, security checks, holders, funding traces, liquidity, protocol financials, token risk) come with section 7.

### 8.3 Streaming

Every tool call is an event streamed to the thread (server-sent events): step name, status, a short result line, timing. Fix rounds show what was fixed. Long jobs report progress.

### 8.4 Numbers audit

Before any explanation is shown, every number in the model's text is checked against this run's tool outputs (with rounding tolerance and units: %, $, M/B, x). On a mismatch, regenerate with the mismatch pointed out; if it still fails, show the number marked unverified. Pass rates are logged for the eval.

### 8.5 Model routing

| Model | Use |
|---|---|
| `muse-spark-1.3` | Orchestration, watching clips, reading images, rule extraction, writing and fixing code, explanations |
| `muse-wonder-1.0` | Takes over the fix loop after 3 failed rounds; always writes Python portfolio strategies ($4 / $20 per million input/output tokens) |
| `muse-spark-1.3-contributor` | Development and evals (much cheaper; Meta may train on this data; 150 requests/min) |
| `muse-voice-transcribe-1.0` | All speech (Muse Spark 1.3's audio understanding is "not fully supported" per Meta's docs, and receipts need timestamps) |
| `sam-3.1` | Candidate for crypto address reading (7.1) |

---

## 9. Data and tooling sources

| Need | Source | Terms and notes |
|---|---|---|
| Stock daily prices (incl. delisted) | **Tiingo**, each user's own free key | Allowed by Tiingo's developer program: register the app, credit "Data from Tiingo," never handle users' Tiingo passwords. Free tier: 50 requests/hour, 1,000/day, 500 unique symbols/month. Cached public stock results and shared datasets would need Tiingo's written permission (not requested for now; draft in `notes/tiingo-email.md`). Delisted history pulls **(verify)** |
| Major-coin prices, no key | Binance public data archive (data.binance.vision) | CC BY-NC-SA 4.0: credit "Crypto data: Binance Vision," non-commercial, charts shared under the same license. Whether a hackathon with prizes counts as "non-monetized" **(verify)**. Used for the tour demo and no-key runs |
| S&P 500 historical members | `github.com/fja05680/sp500` | MIT; 1996 onward; post-2019 changes may be incomplete |
| Company filings | SEC EDGAR XBRL API | Free, official; User-Agent required; 10 requests/s |
| Macro series | FRED API with ALFRED vintages | Free key; first-release values (parameter **(verify)**) |
| Pine linting | `pine-lint` (pine-tools) | MIT, offline; never its `--tv` mode |
| Pine execution | Resin (Apache-2.0) or PineTS (AGPL-3.0) | Chosen by the parity test (5.6) |
| Charts | `lightweight-charts` | Open source; attribution **(verify)** |
| Crypto | See section 7 and the notes | GoPlus requires "Powered by GoPlus"; Binance's archive is non-commercial |

**Not used:** Yahoo/yfinance (terms ban automated collection), Coinbase market data (personal or research use only, no apps for other users, no AI training), Alpaca, Massive/Polygon individual plans, EODHD, FMP, Alpha Vantage, Stooq, WRDS/CRSP (display not allowed for a public app), Etherscan (commercial terms), and any TradingView data.

**Data rights:** the hackathon disqualifies projects using data without rights. Follow each source's terms; never commit third-party data, clips, or scraped content to the public repo.

---

## 10. Architecture

```
frontend (React + Vite + TypeScript)
   Monaco editor · lightweight-charts · IndexedDB storage · onboarding tour
   │  REST + server-sent events
backend on Modal (Python, FastAPI; always on during judging)
   ├─ agent/      orchestrator, tool registry, numbers audit
   ├─ media/      ffmpeg, Files API upload, transcribe, watch
   ├─ codegen/    rule extraction, code writing, fix loop, lint rules
   ├─ pine/       Pine engine runner (Node subprocess), parity tests
   ├─ engine/     Python backtest engine, red team, compare, sandbox runner
   ├─ data/       tiingo, edgar, fred, sp500 membership
   ├─ research/   stock metrics, claims, similar companies
   └─ crypto/     (parked)
```

**Repo layout**

```
backtest-trades/
  SPEC.md
  README.md            (what was built during the hackathon, setup, demo link, eval numbers)
  .env.example         (MODEL_API_KEY, FRED_API_KEY, SEC_USER_AGENT)
  frontend/
  backend/
  examples/            (the tour's demo project and its cached runs)
  evals/
  notes/
  data/                (gitignored: caches, private test clips)
```

- **Hosting:** Modal (the builder's partner credits), kept warm through judging (Nov 4–9). The frontend is a static build.
- **Keys:** server keys live in Modal secrets; users' Tiingo keys stay in their browsers.
- **License:** AGPL-3.0 if PineTS is chosen; otherwise a permissive license.

---

## 11. Evaluation

Real numbers for Technical Depth, the README, and the video.

| Eval | Set | Metric |
|---|---|---|
| Code agent | About 30 strategy descriptions and clips | Clean on the first try; clean after the fix loop; average rounds; honesty problems caught |
| Pine engine parity | About 10 strategies vs. TradingView results recorded by hand | Match rate on trades, net profit, drawdown; decides Resin vs. PineTS |
| Rule extraction | About 20 private clips, rules labeled by hand | Rules exactly right; clips fully right; transcript only vs. transcript + video |
| Python engine | Unit tests | Future-leak test, known-answer tests |
| Stock metrics | 10 companies, hand-checked against their 10-Ks | Exact match rate |
| Comparisons | Benchmarks vs. published index total returns | Match within a small tolerance |
| Similar companies | Later years held out | Calibration of outcome rates |
| Numbers audit | All runs | First-try pass rate |
| Crypto | Parked | Token risk model and address reading, with section 7 |

---

## 12. Guardrails

- Every result: "For research and education. Not financial advice." No buy/sell/hold ratings or price targets.
- Pine results say "Tested in our engine. Verify in TradingView."
- No TradingView data in our engine; no automation of TradingView's site or undocumented endpoints.
- Demo clips are filmed by the builder as a mock guru; no real creators are named or shown.
- Users upload clips; the app doesn't download from social platforms. Uploaded clips stay private.
- Per-visitor limits and 90-second clips protect the $150 of Meta credits; spend limit set on the Billing page; contributor models for development; per-run cost logged.
- Users' Tiingo keys are never logged or stored server-side.
- The Meta Hackathon button uses the event name in text only, no Meta logo.

---

## 13. Demo video (3 minutes)

Judges rank the top 5 by watching demos live, so this is the final exam. Show only what was built during the hackathon.

| Time | Scene |
|---|---|
| 0:00–0:15 | **Hook:** the mock guru clip. "This RSI trick made me 300% this year." Cut to the IDE. |
| 0:15–0:55 | **Clip to code:** drop the clip in the thread. Rules appear with timestamps; the Pine file is written; fix rounds clear the Problems panel. |
| 0:55–1:20 | **Results:** verdict, equity curve vs. the S&P, honesty checks. Copy the code and paste it into TradingView, where it compiles. |
| 1:20–1:45 | **Honesty lint:** paste a typical chatbot-written script that repaints. The agent flags the look-ahead, fixes it, and shows how much the "great" result shrinks. |
| 1:45–2:10 | **Plain English to Python:** the S&P cash-flow strategy, naive vs. honest curves. |
| 2:10–2:35 | **Analyze:** a research file for a pitched stock: claims vs. filings, similar companies, "Backtest companies like this." |
| 2:35–2:52 | **How it works:** Meta models and their jobs; eval numbers (clean after the loop, engine accuracy vs. TradingView). |
| 2:52–3:00 | **Close:** "Code and test any trading idea, honestly. No coding required." |

A crypto scene replaces part of 2:10–2:35 if crypto is built by then.

---

## 14. Open questions

| # | Question | Notes |
|---|---|---|
| 1 | Product name | Decided: Trade Receipts. Tagline still open |
| 2 | Pine engine: Resin or PineTS | Decided by the parity test in phase 1; sets the license |
| 3 | Tiingo permission | Not requested for now (draft ready in `notes/tiingo-email.md`). Without it: no cached stock results shown publicly, similar companies only for users with their own data, and the S&P showcase only in the demo video and for users with their own key |
| 4 | Crypto details | Section 7.9 |
| 5 | Modal setup | Keeping it warm through judging; Sandboxes for running Python strategy code **(verify)** |
| 6 | Tour and home page details | Tour library, copy, demo loop |
| 7 | (verify) items | Tiingo delisted history pulls and browser access; FRED first-release parameter; Meta video size and length limits; `lightweight-charts` attribution; `pine-lint`, Resin, and PineTS v6 coverage; Modal Sandboxes limits |

---

## 15. Build order

Equities first. Each phase ends with something that works on its own. The deadline is fixed: Nov 4, 9 PM ET.

1. **Foundations.** Repo and Modal app; Meta API smoke tests (video in, transcribe, structured output, code writing); Tiingo key and test pulls, including delisted names; start the S&P 500 price download (500 symbols in October, the rest from Nov 1); download BTC and ETH daily candles from Binance's archive for the tour and no-key runs; SEC and FRED adapters; install `pine-lint`, Resin, and PineTS.
2. **IDE shell.** Top bar and tabs, explorer, Monaco tabs, thread, Problems and Output, browser storage, zip import and export.
3. **Code agent and fix loop (Pine).** Plain English first, then screenshots and clips; lints and honesty rules; runs on the Pine engine; diffs with Accept and Reject.
4. **Pine engine parity test.** Pick the engine and the license.
5. **Python engine and Python strategies.** Point-in-time S&P universe, filing-date fundamentals, first-release macro; future-leak and known-answer tests.
6. **Red team, Compare, Results, Export.**
7. **Stock research files and similar companies.**
8. **Onboarding.** Home page, sign-up screen, guided tour over the cached demo, Examples folder, Tiingo key prompt, usage limits.
9. **Evals and numbers audit.** Record numbers for the README and video.
10. **Deploy and cache demo runs** on Modal.
11. **Demo video, README, submission.** The README states that everything was built during the hackathon, lists the Meta models used, and links the video.
12. **Crypto** (after equities works): settle the parked decisions, then build.

---

## 16. Decisions log

- **Oct 28:** Indie track, solo.
- **Oct 28:** Dropped the "agent council" stock-picking idea (close prior art, can't be validated in a week, outputs picks). Replaced by facts from filings and on-chain data.
- **Oct 30:** Positioning: a general trading research platform, an IDE for trading. Guru clips are one use case and the demo's hook.
- **Oct 30:** Main feature: build and test trading strategies without writing code. Guru clips are the demo's hook, not the positioning; no copy-trading framing. Clean compiles are expected, not the selling point. No competitor comparisons in the product or the pitch.
- **Oct 30:** Strategies are Pine v6 when they fit one chart and Python when they need several stocks, fundamentals, or macro data. Users keep the code.
- **Oct 30:** Every piece of code goes through a visible compile-lint-run fix loop with honesty lints from TradingView's docs. Muse Spark writes; Muse Wonder takes over after 3 failed rounds and writes Python portfolio strategies.
- **Oct 30:** Pine runs on Resin or PineTS, chosen by a parity test against TradingView; AGPL is acceptable.
- **Oct 30:** Layout: explorer far left, results and code tabs in the main area with Split and a settings bar, thread on the right, Problems and Output at the bottom, Backtest / Analyze tabs at the top.
- **Oct 30:** First visit: home page, a sign-up screen with greyed-out options and a "Meta Hackathon: skip sign-up" button, a once-per-browser guided tour over a cached demo, then an empty personal IDE with an Examples folder.
- **Oct 30:** No real accounts; projects stored in the browser with zip export and import.
- **Oct 30:** Stock prices from Tiingo with each user's own free key; no paid data. Data layer is pluggable for other providers later. Key prompt appears on first need.
- **Oct 30:** Tiingo confirmed for stock prices: a free key, no permission email for now. Coinbase market data is ruled out by its terms. The tour demo and no-key runs use BTC and ETH from Binance's public archive, credited, non-commercial.
- **Oct 30:** Stocks are daily-only; intraday stock strategies are flagged, not approximated.
- **Oct 30:** Similar-companies model uses past S&P 500 members.
- **Oct 30:** Default costs: $0 commission and 5 bps slippage, always written into Pine's `strategy()`.
- **Oct 30:** Markets: US stocks, ETFs, and crypto. No options, forex, or futures. No live trading for now, but the design shouldn't rule it out.
- **Oct 30:** Hosting on Modal with the builder's partner credits; per-visitor limits, 90-second clips, cached demo runs.
- **Oct 30:** Crypto details are parked until equities works. Learning comes from past tokens; tracking new coins forward is a future feature.
- **Oct 30:** No Streamlit; results are outputs of code the agent writes and runs.
- **Oct 30:** Product name: Trade Receipts.

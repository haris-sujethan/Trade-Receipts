# Trade Receipts — product spec

> **An agent-native IDE for financial research and automated backtesting.** Check any new token for a rug with a model trained on past launches, backtest any strategy, and research any stock, with receipts for every result.

- **Builder:** Haris Sujethan (solo). The hackathon rules, rubric, banned project types and judging are in [notes/hackathon.md](notes/hackathon.md); setup steps before each build step are in [notes/setup.md](notes/setup.md).
- **Event:** Meta Global AI Developer Hackathon, Indie Developer track
- **Theme:** Build for Your World
- **Submission deadline:** Wed Nov 4, 2026, 9:00 PM ET ([submit](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit))
- **Status (Oct 31, 2026):** pivot. The crypto rug check (section 7) is now the main feature: pump.fun first, scored by a model trained on past launches. Backtesting and stock research stay as the second half. The frontend is built as a preview on example data. The backend is started in `backend/`: build steps 1–2 (the pump.fun data pipeline) are done, step 3 (signals, wallet links, labels and snapshots) is built (`uv run python -m receipts build-dataset may aug sep`), and step 4 is nearly done: the baselines are trained, Glimmer is fine-tuned and trained with reinforcement learning on Kaggle, and its scoring is running (Nov 1). Steps 5 and 6 are started (Nov 2): live checks from Helius, the budget-guarded Meta client, the numbers audit, the agent loop and its API (`backend/receipts/server.py`).
- **Name:** Trade Receipts.

The research behind the data and tooling choices is in [notes/data-sources.md](notes/data-sources.md). Items marked **(verify)** couldn't be confirmed and must be checked before they're relied on; they're collected in [Open questions](#14-open-questions).

---

## 1. Problem

Everyday traders and investors make decisions from ideas they can't easily test: their own, a friend's, something they read or watched.

- **Turning an idea into code** means learning Pine Script or Python. Trading code copied from AI chatbots often doesn't compile, and fixing it means knowing the language.
- **Testing it** usually means trusting a backtest that quietly cheats: signals that repaint, data that wasn't public yet, no trading costs, today's winners picked in hindsight.
- **Comparing it** with something simpler, like holding the S&P 500 for 10 years, rarely happens, and that's usually the comparison that matters.
- **Researching a stock** means piecing together filings and finance sites by hand.
- **Researching crypto** is harder still: the data that matters is on-chain and hard to read. New tokens are the worst case:
  - Bundled launches, linked wallets, wash-trading bots and fake holders can make a token look busy and healthy.
  - Its chart can look completely real.
  - New traders are the ones who get rugged, and they can't tell.
  - Today's rug checkers show a few surface stats against fixed limits, and ruggers stay under the limits.

The product is for checking any token and testing any idea, wherever it came from.

## 2. Product

### In one paragraph

A Cursor-style IDE for trading research. **Rug check** (the main feature): give it a new token's name or mint, a screenshot, or a clip shilling it. The agent finds the right token and pulls its on-chain history from launch. It traces who funded whom and shows a bubble map of linked wallets. It separates independent buyers from the team, snipers and bots on the chart, and scores the token's rug chance with Meta's Muse Glimmer, which we train with fine-tuning and then reinforcement learning on thousands of past pump.fun launches that did and didn't rug. The report leads with a verdict such as "Likely rug · 87% rug chance", explained in plain language, with similar past tokens, and every signal links to the chain as evidence. **Backtest**: describe a strategy in plain English, or drop in a clip or screenshot. The agent pulls out the exact rules (with timestamps for where each came from), writes the strategy as Pine Script v6 or Python, compiles and lints it, fixes its own errors in a loop you can watch, and runs it on real historical data. Results come with honesty checks and a comparison with the S&P 500, and the code is yours to copy into TradingView or keep. **Analyze**: give it a ticker, or a clip pitching one, and it builds a research file from SEC filings: growth, cash flow, dilution, debt, the pitch's claims checked against the facts, and what happened to similar companies in the past. It never says buy or sell.

### Main selling points

1. **A rug check that learns.**
   - Every on-chain signal is shown with its evidence.
   - A model trained on what actually happened to past launches scores the token, instead of fixed limits ruggers can dodge.
   - The real chart and the bubble map show new traders what's fake.
2. **Backtesting and research in the same agent-native IDE.** Describe a strategy and the agent writes the code, fixes its own errors, and backtests it honestly; name a stock and it researches it with real data. No coding required, and you keep the code.

Clean compiles are expected, not the selling point. A clip of a shill or a trading guru is the demo's hook, not the product's positioning.

### Use cases

1. **Check a new token before buying:** paste its mint, or drop in the clip shilling it. Get the verdict and rug chance, a plain explanation, the real chart, and the bubble map.
2. **Code my own idea:** "Buy QQQ when it's 10% off its high, sell after a 20% gain."
3. **Code a strategy from a clip or screenshot.**
4. **Compare strategies:** this strategy vs. the S&P 500 vs. my other strategy, same period, same costs.
5. **Research a stock:** filings-based facts, claims checked, similar companies' outcomes.

### How this scores

Stage 1 is pass/fail on theme fit and real use of Meta's models. Stage 2 scores 0–10 on four criteria. The top 5 per track are ranked by judges watching the demos live on Nov 9.

| Criterion | Weight | What earns it here |
|---|---|---|
| Impact | 30% | New traders, the people most often rugged, can see through a manipulated token before buying. Anyone can turn a trading idea into honestly tested code without knowing how to code |
| Use of Meta AI tooling | 25% | The rug model is Muse Glimmer, trained by us with fine-tuning and then reinforcement learning on real rug outcomes. Video understanding reads a token's mint and claims off a shill clip. Voice Transcribe gives timestamped receipts. Muse Spark runs the agent, explains the evidence, and writes and fixes strategy code, with Muse Wonder for hard cases. Evals show what each part adds |
| Technical depth | 20% | Our own pump.fun indexer, wallet-linking graph, and point-in-time snapshots. Muse Glimmer is trained with GRPO against real outcomes, with a calibration reward. A time-split evaluation tests it against gradient-boosted trees and the checklist. Plus the compile-lint-run fix loop, Pine engine accuracy vs. TradingView, and the numbers audit |
| Demo | 25% | A shilled token that looks great is taken apart live: bundled launch, the wallet spider, fake volume removed from the chart, rug chance with reasons; then a clip becomes tested code |

It stays clear of the hackathon's anti-project list (the kickoff slides add "Streamlit apps" and "Dashboards as the main feature" to the written guide). It's not a basic RAG app, a simple image analyzer, or a Streamlit app; it's an IDE where results are the output of code the agent writes and runs; and it gives no advice.

---

## 3. Principles

1. **Receipts for everything.** Every rule links to the moment in the clip it came from. Every number links to the filing or data behind it.
2. **Numbers come from tools, never from the model.** The model reads, extracts, writes code, and explains. Deterministic code fetches data and computes every figure. A numbers audit (8.4) enforces this.
3. **Honest by default.** Costs always included, benchmark always shown, look-ahead and repainting flagged. If the data can't support an honest answer, say so.
4. **Facts and flags, not advice.** No buy/sell ratings, no price targets. Risk estimates describe what happened to similar past cases and are shown with the model's measured accuracy.
5. **Show the work.** The thread streams each step as it happens, including every fix round.
6. **Learn from history.** Models learn from past outcomes: past pump.fun launches for the rug check, past companies for stocks. Tracking new predictions forward is a future feature.
7. **It's an IDE.** Strategies are files. Running them produces results. Errors and honesty issues are problems in the code. The agent does the work; follow-up questions lead to new code and new runs.

---

## 4. Experience

> **Oct 31 (built):** the preview site is now crypto only, with no stock mentions for now; the stock examples stay in the code, unplugged.
> - **Home page:** leads with the rug check. The headline is "Check the token before you buy it.", the subline says the model is trained on thousands of past tokens, and the label tabs are Rug check and Backtest.
> - **Demo replays:** MOON (a likely rug, from a shill clip), KITE (an unlikely rug, from its mint), and the BTC backtest.
> - **IDE modes:** Backtest and Analyze; token checks live in Analyze.
> - **Demo project:** `tokens/`, `strategies/` and `clips/`.
> - **Tour:** five steps through the MOON check, ending on its Token Facts label. The BTC backtest is a finished example thread.
> - **Settings:** the Tiingo key setting is removed.
>
> The descriptions below are from before the pivot.

### 4.1 First visit

**Home page → sign-up screen → guided tour → your own IDE.**

**Home page**

- Headline: "Backtest any strategy. Research any stock or coin."
- Tagline under it: "An agent-native IDE for financial research and automated backtesting." Then one plain line ending in "shows you the receipts."
- Two buttons: Launch IDE and See it work. No strategy input box and no example prompts on the home page.
- Beside the copy: the facts label with three tabs (Backtest, Stock research, Crypto research) that rotate until someone picks one.
- Below: the product window replaying four example sessions (two backtests, one stock, one coin), then How it works (Ask, The agent does the work, You get the receipts).
- Plain language: no SEC or filing jargon on the home page.
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
- Editor: Monaco (the editor inside VS Code). Charts: Plotly (open source), drawn on the white report sheet; loaded only when a report opens.
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

Results are the output of a run: a full backtest report printed on a white sheet on the dark desk, in this order. The Strategy Facts label closes it as the receipt.

1. Title, period, costs, then the verdict and claim vs. reality
2. Stat tiles: total return (with the benchmark), return per year, max drawdown, win rate, trades, average hold
3. Equity against the benchmarks, with drawdown underneath
4. P&L by market regime: cumulative P&L by trade, colored by the regime on each entry day, with totals and a plain-language insight
5. Every trade in 3D: entry signal, time held, and return; winners and losers; drag to turn
6. Monthly returns heatmap and the trade-return histogram, side by side
7. Honesty checks, then any ambiguous rule with every reading's result
8. The receipt: the Strategy Facts label

Earlier draft of the list:

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

## 7. Rug check: crypto (main feature)

**Status (Oct 31):** the main feature. Crypto comes first and stocks and backtesting stay as the second half (decision log, Oct 31). Terms used here are defined in [GLOSSARY.md](GLOSSARY.md). The label definition and the choice of model are recorded in [docs/adr](docs/adr). The research behind it is in [notes/data-sources.md](notes/data-sources.md).

**The gap:** rug checkers today show surface stats against fixed limits, such as the top holders' share or "bundled: yes". None of them learn from what actually happened to past tokens. Ruggers know the limits and stay under them. Trade Receipts shows every raw signal *and* scores the token with a model trained on past launches that did and didn't rug.

**Who it's for:** new traders. They are the ones being rugged, and a manipulated chart looks real to them, so the product explains the chart as well as scoring it.

**Scope of the first model:** pump.fun on Solana only. A token is scored from 1 minute to 24 hours after launch, on the bonding curve or after it graduates. Everything else is listed for later (7.12).

**Key research finding:** on pump.fun, the creator can't pull the main pool. The bonding curve graduates into a canonical pool whose LP is burned (PumpSwap since March 2025, Raydium before that). The rug is the team selling into buyers. So the model weights holder, wallet-link and trading behavior above "is liquidity locked." Mint, freeze and close authorities come back revoked on pump.fun tokens (GoPlus on a live token, Oct 31), so those checks pass and can't be the edge.

### 7.1 Inputs and token resolution

- A name, ticker or mint; a screenshot; or a clip shilling a token.
- **Mint from the clip:** Muse Spark reads it from the frames. Candidate: SAM 3.1 finds the on-screen text so it can be cropped and read at full resolution (kept only if the eval shows it helps).
- **Mint check:** valid base58, 32 bytes, an existing mint created through pump.fun.
- **Copycats:** when several tokens share a name or ticker, the agent lists them by age, market cap and holders and asks which one. It never chooses silently.

### 7.2 What it answers

The report is about the rug. The headline is a **verdict** with the **rug chance**, for example "Likely rug · 87% rug chance." Everything underneath supports it.

- **Verdict bands** (starting values, reset after calibration): Likely rug at 60% and up, Possible rug at 25–60%, Unlikely rug below 25%. The receipt shows how often each verdict actually rugged in testing. No verdict ever says "safe."
- **No faded or survived numbers anywhere.** The explanation says a token is likely to fade only when that matters.
- **Special cases instead of a score:**
  - **Already rugged:** the team has already rugged. The verdict says so, with the team's sells as evidence.
  - **Below the activity floor:** "Too little activity to score," with the signals shown.
  - **Older than 24 hours:** "This model covers a token's first day," with the signals, bubble map and real chart shown.

### 7.3 Signals

Every signal is a number the model learns from and a line the user can read. Each one is computed **as of the snapshot** (7.7), using only what was on-chain by then. Most of these come from the builder's own trading experience.

| Family | Signal | How it's measured |
|---|---|---|
| Launch and bundling | Opens already at a high market cap | Market cap after the first block, first minute and first 5 minutes |
| | Buys sent as one bundle at launch | Share of supply bought in the creation slot and the next few; buys in the same Jito bundle (tip transfers in the same block) **(verify)** |
| | Many small, identical buys across wallets (such as 0.5 SOL each), then independent buyers arrive | Count and share of buys with the same SOL size; round-number sizes; when the first independent buyer arrives |
| | Snipers | Wallets outside the team buying in the first seconds, especially wallets with a sniping history. A warning signal, not a rug (7.6) |
| Supply control | 1–3 people holding a lot through many wallets | Supply held per **cluster of linked wallets** (7.4), not per wallet; the team's share |
| | Any wallet or cluster at 4–5% or more | Number of wallets and clusters above 4% |
| | Total team supply | The team's share, plus supply moved out by plain transfers |
| | Hidden supply | Tokens that reached holders by transfer instead of a buy |
| Balance shape | Many holders at the same share (0.23%, 0.23%, 0.23%) | Holders with near-identical balances; how evenly supply is spread (Gini, entropy) |
| Wallet quality | Fresh wallets | Holder and buyer wallet age; share funded minutes before launch |
| | Fake holders: high market cap, too few real holders | Independent buyers per $1M of market cap |
| | Holders vs. experienced traders | Share of holders with real trading history and past profits on pump.fun |
| | Recycled wallets | Wallets that appeared in earlier launches, especially as team in past rugs |
| Trading behavior | The team selling into every buy | Team sells within seconds of buys, at matching sizes or prices |
| | Wash-trading bots faking volume | Distinct traders vs. trades; the same wallets buying and selling repeatedly; clockwork trade timing; volume from the team |
| | Wallets buying and selling to each other | Round trips between linked wallets |
| Chart shape | All-green or mostly green candles, slow steady accumulation | Share of green candles; how smooth the climb is; how shallow the dips are; price path vs. independent buyer flow |
| Fees | Total fees stay tiny (0.004 SOL where real trading would pay 20–30) | Priority fees and tips traders paid, per dollar of volume and per trader; whether fees grow as market cap grows |
| Creator | Creator history | Tokens this creator, and the wallet that funded it, launched before, and how they ended |
| | Where the money came from | Team funding: fresh wallets, exchanges, known rug funders |
| | Getting ready to exit | Team wallets moving SOL or tokens to exchanges or fresh wallets |
| Speed | How fast it filled the bonding curve and graduated | Minutes from launch to graduation; buyers needed to get there |
| Pitch vs. chain | Price and wallets around the clip's post time | Who bought before the clip; who sold right after |
| | Claims ("dev doxxed", "community token", "no team tokens") | Checked against chain data and web search |

### 7.4 Wallet links, the team, and the bubble map

- For each top holder and early buyer, trace the earliest incoming SOL transfers, up to 2 hops back.
- **The team** is the creator plus every wallet linked to it in any of these ways:
  - funded by the creator, or by the same funder;
  - sent tokens or SOL to or from the creator's wallets;
  - bought in the creator's launch bundle.
- **Likely team:** wallets funded from the same exchange with the same amount (within 1%) inside a 10-minute window, with no on-chain link. They're their own signal. They count as team for the rug label only when they also sell alongside the team.
- **Never link through** exchange hot wallets, pump.fun's program accounts or popular trading-bot accounts. These are identified by very high transfer counts: a wallet that paid 200 or more wallets in the window, or received SOL from 50 or more (trading bots' fee wallets receive from tens of thousands). Transfers under 0.01 SOL are dust and never link.
- **How far links reach (measured Oct 31):** the team is the creator, its bundle, and wallets *one* link away from them. Following links further, or linking wallets that only share a funder two hops back on both sides, chained in unrelated holders: some "teams" held 98% of supply.
- **The launch bundle** is the wallets that bought in the creation slot, minus sniper bots: wallets that bought that early into tokens from 10 or more creators. About three quarters of creation-slot buys come from such bots (May 12: 399 wallets made 74% of them). Jito bundle data isn't in BigQuery, so this replaces the tip check.
- **Clusters** of linked wallets are the units for supply control and trading behavior (7.3).
- **Independent buyers** aren't team, likely team, snipers or wash traders. Their wallet is at least a day old, has traded tokens before, or was funded from outside the team.
- **The bubble map** shows the top 50 holders and the first 50 buyers, sized by share of supply.
  - Each team cluster has its own color.
  - Likely-team links are dotted.
  - Independent buyers are grey.
  - One funder with many spokes is the "spider."

### 7.5 The real chart

The price chart, with the volume split by who traded:
- the team;
- likely team;
- snipers;
- bots and wash trades;
- fresh wallets;
- independent buyers.

Every team sell is marked on the chart. Two plain numbers sit beside it: how much of the buying came from independent buyers, and how much the team could sell into right now. A token that looks like it has a $3M market cap can be shown as a handful of independent buyers. This is the explanation new traders need.

### 7.6 Labels

Labels are computed by us from raw chain data, so the model and its data are ours to use (9). The definition is recorded in [ADR 0001](docs/adr/0001-only-the-team-can-rug.md).

| Label | Meaning |
|---|---|
| Rugged | Within the label window, the team sold at least half of its peak holdings into buyers and the price fell at least 90% from its peak. It can happen at any stage, before or after graduating. Only the team can rug |
| Faded | Trading died out without a rug, including collapses caused by unlinked snipers |
| Survived | Still trading at the end of the label window with no 90% collapse |

- **Label window: 24 hours after launch** (measured Oct 31 on May 11–12 launches, which have 4+ days of data after them). Of all rugs, 67% land within a minute, 86% within 5 minutes, 96% within an hour and 99.2% within a day. Of tokens still standing at 1 hour, 22% rug within 24 hours and 27% ever. Labels are also kept at 1, 6, 12, 48, 96 and 144 hours.
- **The 90% fall is measured above the launch price.** A bonding curve's price can never fall below where it started, so a token that ran from 28 to 100 SOL and back to 30 has fallen 97%. After graduation the launch price is small next to the pool's, so this is close to the plain fall.
- **Base rate:** about 90% of tokens at the starting floor rug within a day, most of them in the first minutes, which matches public reports on pump.fun. The model only sees snapshots taken before a rug, so the rate it learns is the rate among tokens still standing: 73% rug within the day at 1 minute, 52% at 5 minutes, 22% at 1 hour, 9% at 6 hours.
- **Team holdings in rugs are large:** the median rugged team held 35% of supply at its peak, mostly through the creator's own launch buy, so the label is driven by real team selling.
- **Thresholds** (half of peak holdings, a 90% fall) are tuned on a development split, then frozen before the final evaluation.
- **References:** the MELT and SolRPDS datasets inform the definitions. MELT is non-commercial, so its definitions are referenced but its data isn't trained on.
- **Why rugged vs. faded matters:** most pump.fun tokens simply die, and a model that only learns "new tokens go to zero" is useless.

### 7.7 Dataset and snapshots

- **Launches:** pump.fun launches from BigQuery's public Solana dataset, in the stretches where it has pump.fun's events (`notes/data-sources.md`): mainly May 11–17, 2026, six continuous days with about 2,000–4,000 launches a day above the activity floor. Training uses May 11–14, tuning May 15, and the final test May 16. Aug 12 and Sep 15 are a later check that the model still holds up months afterwards. One day costs 5–21 GiB of the free 1 TiB a month.
- **Activity floor:** a token enters the dataset at a snapshot only once it has real activity by then. The starting floor is 20 independent buyers or a 60 SOL market cap (the $10k floor, held in SOL because the pull has no SOL price), tuned from the data. Every snapshot carries whether it passes, so the floor can be tuned without rebuilding. Most launches never reach it; scoring them would make accuracy look high while measuring nothing.
- **Activity pulled:**
  - Every trade of each token on the bonding curve and PumpSwap for the rest of its block (up to 6 days), decoded with the public pump.fun IDL. Raydium isn't needed: graduations go to PumpSwap.
  - SOL funding transfers into each token's creator, first 50 buyers and 50 biggest holders, and into their funders, two hops back.
  - Token transfers between wallets aren't pulled; tokens that reached a wallet without a buy show up as sells larger than its buys (`hidden_supply_share`).
- **Snapshots:** each token is rebuilt at 1, 5, 15 and 30 minutes, then 1 and 6 hours after launch, using only what had happened by then. (A 24-hour snapshot has nothing left to predict inside a 24-hour label window.) A token scored 10 minutes after launch is compared with other tokens at 10 minutes. Snapshots taken after the token rugged are never trained on: they would teach the model to spot rugs after the fact. At each snapshot, funding is read only for the wallets a live check would trace then: the creator, the first 50 buyers and the 50 biggest holders so far. The leakage test (`backend/tests/test_leakage.py`) recomputes snapshots with everything after them deleted and requires identical signals.
- **Follow-up limits:** labels need 24 hours of data after launch. May 16 launches after about 11:00 UTC, and all of Aug 12 and Sep 15, have less; those tokens are kept for snapshots but have no 24-hour label. The later checks use the 6- and 12-hour labels until the missing hours are filled from Helius.
- **Failed transactions:** BigQuery's instructions include failed transactions, and their events look like real trades (checked against Helius). Failed bonding-curve trades are dropped by chaining each trade's reserves to the next (about 1% of curve trades; 49 of 50 dropped trades checked had failed, 50 of 50 kept ones had succeeded). Mayhem mode curves and PumpSwap pools can't be chained yet and are marked unverified.
- **Holdings** come from pump.fun trades: complete on the bonding curve, partial after graduation, when tokens also trade elsewhere.
- **Dataset size (Oct 31), snapshots above the activity floor with a 24-hour label:** 20,848 for training (May 11–14), 5,011 for tuning (May 15) and 2,210 for the test (May 16 launches with a full day after them). The later checks have 6-hour labels: 5,047 snapshots on Aug 12 and 3,361 on Sep 15. Each snapshot has 80 signals; `backend/receipts/crypto/signals.py` lists them by 7.3 family.
- **Wallet history:** a table of every wallet's past launches, trades and outcomes. Wallet reputation ("team in 3 past rugs") counts only rugs that had happened before the token's launch, within the past 24 hours, so the same history can be rebuilt from Helius live.

### 7.8 The models

The main model is **Muse Glimmer**, Meta's open-weight 30B model (Apache 2.0, reads text and images). We train it in two stages: supervised fine-tuning, then reinforcement learning on real outcomes. Simpler models stay as baselines it has to beat.

**What Glimmer reads** for one token at one snapshot (7.7), built in `backend/receipts/crypto/prompt.py` (about 1,700 tokens plus the image):
- **Signals:** the 7.3 signals, written as lines by family.
- **The 20 biggest holders:** share, group (team, sniper, fresh wallet, independent…), when each first bought, how much it sold, and how it was funded.
- **The price line:** market cap from launch to the snapshot.
- **Trades over time:** SOL bought and sold by each group, in time buckets. The order is the giveaway hand-made signals miss: small identical buys, then independent buyers, then the team selling into every buy.
- **Bubble map (7.4):** the one image (448×448): the 50 biggest holders and first 50 buyers, sized by share and colored by group, with funding links.

**How Glimmer answers:** "Rug chance: N%" first, then one or two sentences on the signals that raise and lower it. The system message sets low reasoning strength and the answer channel is opened directly, so there's no separate thinking step. Every N from 1 to 99 is one token, so one forward pass gives Glimmer's whole distribution over N, and the rug chance is its expected value.

**Where it trains (Nov 1):** Kaggle's free GPUs (2× T4, 30 GPU hours a week), because the hackathon's Modal credits weren't claimed. Unsloth's 4-bit Glimmer (20.7 GB) is split across both cards and computes in float16 (T4s have no bfloat16). Measured: 8 seconds to score a snapshot, 23 seconds per training example. LoRA rank 8 on the language model's projections (52M trainable parameters); the image encoder is frozen. Jobs: `backend/kaggle/glimmer_job.py`, pushed with `backend/kaggle/push.py`.

**Stage 1: supervised fine-tuning** (900 examples from May 11–14)
- The answers come from the trees: the rug chance is the trees' calibrated estimate made without seeing that day (out of fold by launch day), and the reasons are the signals that raised and lowered it most (their SHAP contributions). Every number in an answer is copied from its prompt, so answers pass the numbers audit by construction (`backend/tests/test_glimmer_answers.py`).
- It teaches the format and a calibrated starting point instead of 0% and 100%.

**Stage 2: reinforcement learning** (about 900 examples from other May 11–14 tokens)
- GRPO with a one-token action: 8 rug chances are sampled from Glimmer's distribution per snapshot, each rewarded by the Brier score against the real outcome, 1 − (N/100 − y)², and pushed up or down relative to the group's mean. The Brier score rewards being right *and* honestly confident, so always saying "rug" doesn't pay.
- Scope set by the GPU hours: RL trains the number, not the written reasons, which come from stage 1. Sampling written reasoning would cost about 4 times as much per example. The numbers audit still checks every number in what users read (the explanation, 8.4).

**Rug chance:** the expected value of Glimmer's distribution over N, calibrated (isotonic) on May 15, so a rug chance of 80% comes true about 80% of the time.

**Baselines it has to beat** (`backend/receipts/crypto/baselines.py`, measured Nov 1 on May 16):
- The checklist score: 10 red flags of the kind rug checkers show today, thresholds fixed in advance. **Fair AUC 0.44**: worse than a coin flip once age and mode are accounted for.
- Gradient-boosted trees (LightGBM) on the same signals: **fair AUC 0.69** on May 16, 0.74 on Aug 12 and Sep 15 (6-hour labels).
- Glimmer before any training, and after fine-tuning only, to show what each stage adds.
- **Results (Nov 2):** fair AUC, with pooled AUC in brackets.
  - **Same 300 snapshots per set** for every model, so the stages compare directly. The untrained run used 200 per set and older, longer prompts.

    | | May 16 | Aug 12 | Sep 15 |
    |---|---|---|---|
    | Glimmer untrained | 0.62 (0.42) | 0.45 (0.47) | 0.57 (0.51) |
    | Glimmer fine-tuned | 0.74 (0.96) | 0.76 (0.88) | 0.64 (0.92) |
    | Glimmer after RL | 0.55 (0.92) | 0.52 (0.75) | 0.52 (0.88) |
    | Trees | 0.87 (0.98) | 0.72 (0.89) | 0.61 (0.93) |
    | Fine-tuned Glimmer + trees (mean) | 0.84 (0.97) | 0.76 (0.90) | 0.62 (0.93) |

  - **Every snapshot** of May 16 (2,210) and 700 of each later day, for Glimmer after RL and the trees:

    | | May 16 | Aug 12 | Sep 15 |
    |---|---|---|---|
    | Glimmer after RL | 0.52 (0.91) | 0.51 (0.76) | 0.58 (0.88) |
    | Trees | 0.71 (0.96) | 0.72 (0.89) | 0.70 (0.92) |

  - **Fine-tuning works.** It takes Glimmer from a coin flip to the trees' level: behind them on May 16, ahead on Aug 12 and level on Sep 15. That fits answers distilled from the trees.
  - **RL made Glimmer worse.** GRPO pushed nearly every answer to 1% or 99% (median 99%). That loses the ranking within each mode and age, which is what the fair AUC measures. The likely causes:
    - no KL penalty holding it near the fine-tuned model;
    - a learning rate too high for 830 examples;
    - training's rug rate (84%) far above the test days' (53%).
  - **The live score is the trees' for now:** they win on the test split. Fine-tuned Glimmer is the better Glimmer.
  - Reports: `data/reports/glimmer_{untrained,sft,rl}.json`.
- **Why "fair" AUC:** pooled over all snapshots the trees score 0.96, but most of that is knowing the age (rug rates fall from 77% at 1 minute to 13% at 6 hours) and the mode (Mayhem mode tokens rug 8% of the time, standard ones 84%). The fair AUC is measured within each mode at each age and averaged by size, and it's the headline number.

The score users see comes from whichever wins on the test split: Glimmer alone, or Glimmer combined with the trees. The receipt (7.9) shows all of them.

- **The explanation:** Muse Spark writes the plain-language explanation from Glimmer's reasons and the token's signals, and the numbers audit (8.4) checks every number in it. Glimmer's own reasoning sits underneath under "How the model saw it." The tree model's per-signal contributions (SHAP) serve as a cross-check.
- **Similar past tokens:** the 5 nearest in signal space, each with how it ended and an explorer link.
- **No cheating:**
  - Split by launch date: both training stages use May 11–14, tuning uses May 15, and testing uses May 16. Aug 12 and Sep 15 test whether it holds up months later.
  - Inputs come only from snapshot data, and a leakage test makes sure none reads the future.
  - The label window and thresholds are frozen before the final test.
- **Retraining:** rug tactics change, so both stages are rerun on fresh launches. Tracking new tokens forward and publishing a track record is a future feature.

### 7.9 The model's receipt

Shown in the app and the README, and measured on the newest held-out launches. For each model (Glimmer after reinforcement learning, Glimmer after fine-tuning only, Glimmer untrained, the trees, the checklist, and the combination if used):
- how well it ranks rugs above non-rugs within each mode and age (the fair AUC), and pooled;
- how often a high rug chance (80% or more) actually rugged;
- the calibration curve;
- the Brier score.

Also shown: how often each verdict (Likely, Possible, Unlikely rug) actually rugged, which model the live score comes from, and the label window.

No accuracy claim appears anywhere without these numbers behind it.

### 7.10 Live scoring

- **Token data:** Helius (free tier) for the token's transactions, holders and funding traces.
- **Security fields:** GoPlus's Solana token security (free, credited) as a cross-check.
- **Inputs:** the same code as training builds the signals, the timeline and the bubble map, so live scores match the evaluated model.
- **Model:** Glimmer with the trained adapter merged into its weights, served with vLLM 0.28 or later (which supports Glimmer, including images) on Modal.
  - The FP8 version (about 33 GB) fits an L40S ($1.95/hour) or an A100 80 GB.
  - Merging avoids relying on vLLM's LoRA serving, which isn't documented for Glimmer.
  - The trees run alongside it on CPU.
- **Cold starts:** keeping a GPU warm all of Nov 4–9 would cost about $230–300. So the demo's example tokens are scored ahead of time and cached. Live checks stream every signal, the bubble map, and the tree score at once, while Glimmer starts up (minutes from cold; Modal memory snapshots could shorten that **(verify)**).
- **Speed:** the first signals within 10 seconds and the full report within a minute when Glimmer is warm. From cold, the report says the model is starting. Results stream into the thread as each signal finishes, and repeat lookups are cached.

**Built (Nov 2):** `backend/receipts/crypto/live.py`, run with `uv run python -m receipts live-check <mint>`.
- **Same code as training.** A live check fetches the token from Helius and writes the same raw tables the BigQuery pull makes. Then the dataset, label and signal code that built the training snapshots runs on them unchanged.
- **What it fetches:**
  - every transaction that touched the mint, launch to now (`getTransactionsForAddress`, 100 full transactions for 10 credits);
  - for each traced wallet, the transactions in the two days before the launch and those since;
  - its funders' incoming transfers;
  - for wallets that bought in the first 10 seconds, the launches of tokens they bought in the day before, to tell sniper bots from the creator's bundle.
- **Scored by the trees for now.** Glimmer has no free GPU to serve it live (Modal's credits weren't claimed), so its rug chance is precomputed on Kaggle for the demo tokens.
- **Glimmer on the demo tokens** (Nov 2): fine-tuned Glimmer scored the 5 demo tokens at every age on Kaggle, in 20 GPU minutes.
  - At 15 minutes it gives 78–88% to the three that rugged, and 79% and 63% to the two that didn't. The trees give 57–96% to the rugs and 30–33% to the others.
  - The report shows Glimmer's own rug chance (uncalibrated) as a second opinion. Calibration fit on only 300 snapshots puts most values on one step.
  - Its written reasons follow a fixed template learned in fine-tuning, and one phrase can appear on both sides, so the agent doesn't use them.
- **Thinner than training, by design:**
  - busy traders' scans stop after a few pages;
  - funding reaches back two days before the launch;
  - past rugs by the token's wallets need other tokens' outcomes, so they count as none and show as n/a.
  - The parity check (`live-parity`, section 11) measures the effect on May 16 test tokens.
- **Parity (Nov 2, 8 May 16 test tokens at 1 minute to 1 hour):**
  - Same verdict on all 8. The trees' rug chance moved 0.007 on average and 0.05 at most.
  - 38 of 81 signals matched exactly on every token.
  - The rest are mostly wallet history:
    - recycled wallets and past rugs, which a live check can't see;
    - experienced and profitable holders, read from only part of busy traders' day;
    - sniper bots and linked clusters.
  - Three tokens had one more trade in training than live. Each was a failed transaction the reserve chain didn't catch (7.7); live checks drop failed transactions exactly.
  - Report: `data/reports/live_parity.json`.
- **Already rugged** comes from the same label code: the team's sells as of now.
- **Cost (Nov 3, on new tokens):** about 3,000 Helius credits and about a minute.
  - Requests run 8 at a time, spaced to Helius's 10 a second, and slow down whenever Helius refuses one.
  - Only early buyers get 5 pages of history (their sniping habit decides who's team); every other wallet gets 1.
  - Parity on the May token checked before and after this change: the same rug chance (91.4%), and the same signals off.
  - Version-1 transactions (about half of pump.fun's by Nov 2) are read too.
- **Not scored, with the reason shown:**
  - below the activity floor;
  - already rugged;
  - older than a day;
  - priced in another token, not SOL. About 1 in 5 new launches is priced in PUMP, and the model learned from SOL-priced tokens only.
- **Limits on the public site:** 6 live checks per visitor per hour and 60 a day in all (`CHECKS_PER_HOUR`, `CHECKS_PER_DAY`), so the 900,000 monthly credits last.
- **Two fixes found by the parity check:**
  - Events are numbered by position in their parent instruction, as BigQuery numbers them, because training orders a slot's trades by that number.
  - Sniper bots are scanned too: they're on the busy-sender list because they pay many wallets.

### 7.11 Result view

A research file per token (for example, `research/MOON-7xKX.md`) that can be checked again to show what changed since the last check. In order:
1. The verdict and rug chance (7.2), with the token, mint, age and stage (bonding curve or graduated).
2. The plain-language explanation (7.8).
3. The real chart (7.5).
4. The bubble map (7.4).
5. Every signal, each marked pass, caution, red flag or can't check, with explorer links as evidence.
6. Claims vs. the chain, when the token came from a clip.
7. 5 similar past tokens.
8. A link to the model's receipt (7.9).
9. The Token Facts label as the receipt.

### 7.12 Later

- **Other launchpads and chains:**
  - Solana: Raydium LaunchLab and bonk.fun.
  - Base: Clanker and Zora.
  - BNB Chain: four.meme.
  - Ethereum: plain Uniswap pairs, where pulling the pool is possible and the sell simulation on a forked chain matters.
- **Crypto that isn't a new launch:**
  - Major coins: age, size, liquidity, supply schedule, network fees.
  - Protocol tokens: fees, revenue and holder payouts from DefiLlama, deposit (TVL) trend, valuation vs. fees, dilution.
- **Token strategy backtests:** for example, "buy every new token under 20% rug chance at 1 hour, sell after a day." These use rug chance from training that happened before each trade.
- **Tracking new tokens forward,** labeling them as outcomes arrive, and publishing a track record.

### 7.13 Still open

- Label thresholds and the activity floor, tuned on May 15. The window is set: 24 hours (7.6).
- Glimmer's input length for the timeline, and how busy tokens are compressed to fit it.
- Measured training time and cost for both stages (the estimates in 7.8 come from published guides).
- Glimmer's cold start on Modal, and whether memory snapshots cut it.
- Snapshot ages: set to 1, 5, 15 and 30 minutes, 1 and 6 hours (7.7).
- Dataset size against the BigQuery quota.
- The source of the exchange and bot wallet lists: hubs are found by transfer counts (7.4); a named list would let the report say "from Binance".
- How Jito bundles are detected: BigQuery has no bundle data, so the launch bundle is the creation-slot buyers minus sniper bots (7.4).
- Whether GoPlus adds anything beyond our own signals for pump.fun tokens.
- Which BigQuery Solana tables hold decoded instructions and token balances **(verify)**. `Instructions` is clustered by `executing_account`; the rest waits on `bq-check`.
- **Found in live data (Oct 31):**
  - **Mayhem mode** tokens are traded by pump.fun's own agent program, with no fees and with the curve's virtual reserves reset between trades. Its trades need their own wallet group, outside both the team and independent buyers.
  - **Version-1 transactions** now appear on mainnet. `bq-check` looks for days where BigQuery's row counts drop, in case its ingestion skips them.
  - **BigQuery has pump.fun's events only in stretches:** May 11–17 (six continuous days), May 28–29, Aug 12–13 and Sep 15, and nothing in October. The dataset plan in 7.7 is set to match (decisions log, Oct 31); details in `notes/data-sources.md`.
  - **Mayhem mode is a third of launches** (6,392 of 22,079 on Sep 15).
  - **Failed transactions are in BigQuery's instructions.** Their pump.fun events look like real trades; some tokens even show failed creates. Status lives only in the `Transactions` table, which costs about 400 GiB a day to read, so failed curve trades are found from the reserve chain instead (7.7). PumpSwap pools need the pool's quote reserves before each trade to do the same; the decoded trades don't keep them yet.
  - **Priority fees and tips aren't in the pull** (the Fees family in 7.3): they're in the same `Transactions` table. Live scoring can read them from Helius; training would need another source.
  - **Quotes other than SOL:** `create_v2` tokens can trade against USDC or another pump token (up to two levels deep). Trades keep their quote mint; prices for these need converting to SOL.

---

## 8. Agent design

### 8.1 Orchestrator

Muse Spark 1.3 with tool calling. It plans, calls tools, reads results, asks the user when needed, writes code, and explains. It never computes numbers itself.

**Built (Nov 2):** `backend/receipts/agent/loop.py`, streamed by `backend/receipts/server.py` (`POST /api/agent`; `POST /api/check` runs a live check without the Meta API). The rug check's tools so far:
- `check_token`: the live check (7.10). It covers `token_activity`, `trace_funding`, `signals` and `rug_model`, and returns the verdict, the rug chance and the signal lines Glimmer reads.
- `token_security`: GoPlus.
- `read_address`: reads a screenshot with structured output.

- `find_token`: name or ticker search.

Added Nov 2:
- **Clips:** `read_address` reads clips too. The mp4 is uploaded through the Files API and Muse Spark watches the frames and audio. It returns the mint, the ticker, and each claim with the second it appears. Tested on a mock clip: the exact 44-character mint, and every claim with its time.
- **Reasoning effort:** reading runs at minimal effort. At low effort, Muse Spark spent its whole output cap reasoning.
- **What a live check also returns:**
  - the real chart's data and the bubble map's data (`backend/receipts/crypto/chart.py`);
  - 5 similar past tokens (`similar.py`);
  - copycats (`copycats.py`): tokens that used the same ticker or name in the week before, the most active first.
- **Name search and copycats** read the BigQuery launch history, so they cover launches through mid-September 2026 for now.
- **Token names are hidden when they contain slurs.** Names are written by anyone.
- **The demo's runs** are saved once with `save-demo` and replayed by `GET /api/demo/<id>` with no Meta or Helius calls.
  - Saved Nov 2: 6 tokens from the May 16 test day, each as it stood 15 minutes after launch. Each run starts from what a user would type: a pump.fun link or a mint, not a clip.
  - **The hero, BABYBULL:** 26 team wallets tied by funding (one funder paid 24 of the wallets on the map). 68.5% of buys are at repeated exact sizes, and the team sold into outside buys every time. Likely rug at 86%; Glimmer's second opinion is 92%. It rugged 31 minutes after the check.
  - **The other five:** Drake Likely rug at 99% (rugged 7.7 h later), GANG Likely rug at 66% (11.6 h), Napoleon Possible rug at 54% (2.9 h), gnosis Possible rug at 42% (still trading a day later), Jim Possible rug at 28% (faded).
  - **What each run adds:**
    - the bubble map's funder hubs;
    - the top repeated buy sizes;
    - each tool's result;
    - `after`: hindsight kept outside the check, with the market cap to 1 hour and the rug time.
  - All answers passed the numbers audit on the first try.
  - Meta spend for all development so far: $0.011.
- **Measured cost:** a full check, clip included, costs about $0.001 on the contributor model.

Tool outputs carry no timings or credit counts, so a repeated check sends identical requests and is served from the Meta cache.

Added Nov 3:
- **The IDE's chat is connected.** With the backend running, a message about any pump.fun token runs a live check and streams each step into the thread. Muse Spark explains the result, and the report opens on the same views as the demo.
  - The thread so far is sent with each message, so follow-ups work, such as picking one of several tokens with the same name.
  - Screenshots and clips can be attached.
  - Without a backend (the static site), the chat replays the saved checks.
- **With the Meta API off** (switched off, out of budget, or after Nov 4), the check still runs. The thread shows the check's own findings, word for word from the tools, and says the written explanation isn't available.

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

**Rug check tools (section 7):**

| Tool | Does | Backed by |
|---|---|---|
| `read_address(video_file_id or image)` | Mint address and on-screen claims from a clip or screenshot | Muse Spark 1.3 (SAM 3.1 crop as a candidate) |
| `resolve_token(query)` | Name, ticker or mint to one pump.fun token, with copycats listed | Helius, pump.fun data |
| `token_activity(mint, as_of)` | Trades, transfers, holders and fees up to a time | Helius live; our indexer for training |
| `trace_funding(wallets, hops)` | Funding sources and wallet clusters | Helius; exchange and bot wallet lists |
| `token_security(mint)` | Permission and authority fields | GoPlus |
| `signals(mint, as_of)` | Every 7.3 signal, computed the same way as in training | Python |
| `rug_model(mint, as_of)` | Rug chance, top reasons, similar past launches | Muse Glimmer trained by us (7.8), with the tree model alongside |
| `real_chart(mint)` | Candles with volume split by who traded | Python |

### 8.3 Streaming

Every tool call is an event streamed to the thread (server-sent events): step name, status, a short result line, timing. Fix rounds show what was fixed. Long jobs report progress.

### 8.4 Numbers audit

**Built (Nov 2):** `backend/receipts/agent/audit.py`. A number passes when a tool value rounds to it at the precision the text shows, after its unit (%, $, K/M/B, x, durations). Digits inside addresses and tickers are skipped. The product's own constants and numbers from the user's message are allowed. One rewrite with the failing numbers pointed out, then they're marked unverified. Every audit is logged to `data/ledger/audit.jsonl` for the pass rate.

Before any explanation is shown, every number in the model's text is checked against this run's tool outputs (with rounding tolerance and units: %, $, M/B, x). On a mismatch, regenerate with the mismatch pointed out; if it still fails, show the number marked unverified. Pass rates are logged for the eval.

### 8.5 Model routing

| Model | Use |
|---|---|
| `muse-spark-1.3` | Orchestration, watching clips, reading images, rule extraction, writing and fixing code, explanations |
| `muse-wonder-1.0` | Takes over the fix loop after 3 failed rounds; always writes Python portfolio strategies ($4 / $20 per million input/output tokens) |
| `muse-spark-1.3-contributor` | Development and evals (much cheaper; Meta may train on this data; 150 requests/min) |
| `muse-voice-transcribe-1.0` | All speech (Muse Spark 1.3's audio understanding is "not fully supported" per Meta's docs, and receipts need timestamps) |
| `sam-3.1` | Candidate for finding the mint in a clip's frames (7.1) |
| Muse Glimmer (open weights, 30B) | The rug model: fine-tuned and then trained with reinforcement learning by us on past pump.fun launches (7.8); served on Modal |

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
| Charts | Plotly (`plotly.js-dist-min`) | Open source (MIT) |
| pump.fun history for training | Google BigQuery public Solana dataset | Public chain data, queried in the free sandbox (1 TB a month). Google's terms for commercial use of query results **(verify)** |
| Live token data and funding traces | Helius free tier | 1M credits a month; made for building apps |
| Token security fields | GoPlus | Free; requires "Powered by GoPlus" |
| Label definitions | MELT (definitions only, non-commercial) and SolRPDS (CC BY 4.0, credited) | We compute our own labels from raw chain data |

**Not used:** Yahoo/yfinance (terms ban automated collection), Coinbase market data (personal or research use only, no apps for other users, no AI training), Alpaca, Massive/Polygon individual plans, EODHD, FMP, Alpha Vantage, Stooq, WRDS/CRSP (display not allowed for a public app), Etherscan (commercial terms), and any TradingView data.

**Free with no credit card (Oct 31):** every service must have a free tier that needs no card.
- **Data:** the BigQuery sandbox (1 TB of queries and 10 GB of storage a month; tables expire after 60 days, so results are kept locally), Helius's dashboard free plan (1M credits a month), and GoPlus (no key).
- **Models:** a Hugging Face account. The one exception is the Meta Model API: the Participant Guide says its $150 credits need a card on file before any call works. It's checked before build step 6 (`notes/setup.md`).
- **Glimmer:** Modal, on the builder's existing credits, which needed no card. Kaggle's free GPUs (two 16 GB cards, phone verification) are the training fallback.
- **This Mac:** an M5 with 16 GB can't run Glimmer.

**Data rights:** the hackathon disqualifies projects using data without rights. Blockchain data is public and nobody owns transactions; the limits come from the services used to fetch it, listed above. Stock data is more limited: users' own Tiingo keys are allowed, but cached stock results can't be shown publicly without Tiingo's permission. Follow each source's terms; never commit third-party data, clips, or scraped content to the public repo.

---

## 10. Architecture

```
frontend (React + Vite + TypeScript)
   Monaco editor · Plotly charts · IndexedDB storage · onboarding tour
   │  REST + server-sent events
backend on Modal (Python, FastAPI; always on during judging)
   ├─ agent/      orchestrator, tool registry, numbers audit
   ├─ media/      ffmpeg, Files API upload, transcribe, watch
   ├─ codegen/    rule extraction, code writing, fix loop, lint rules
   ├─ pine/       Pine engine runner (Node subprocess), parity tests
   ├─ engine/     Python backtest engine, red team, compare, sandbox runner
   ├─ data/       tiingo, edgar, fred, sp500 membership
   ├─ research/   stock metrics, claims, similar companies
   └─ crypto/     pump.fun indexer, wallet clusters, signals, labels,
                  Glimmer fine-tuning and GRPO on Modal GPUs, baselines,
                  evaluation, live scoring (merged Glimmer on vLLM)
```

**Repo layout**

```
backtest-trades/
  SPEC.md
  README.md            (what was built during the hackathon, setup, demo link, eval numbers)
  .env.example         (MODEL_API_KEY, HELIUS_API_KEY, GOOGLE_CLOUD_PROJECT, FRED_API_KEY, SEC_USER_AGENT)
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
| Rug model | Newest held-out pump.fun launches (time split) | For Glimmer after RL, Glimmer after fine-tuning only, the trees, and the checklist: AUC, how often 80%+ rug chance rugged, calibration, Brier score (7.9) |
| Address reading | About 20 private shill clips and screenshots | Exact mint read; copycats caught |
| Live vs. training signals | 50 tokens scored both ways | Identical signals (no training/serving drift) |

---

## 12. Guardrails

- Every result: "For research and education. Not financial advice." No buy/sell/hold ratings or price targets.
- Rug chance is a risk estimate from past launches, always shown with the model's receipt (7.9). A low rug chance never says "safe."
- The rug check describes wallet behavior, not people. No names or accusations; wallets are shown as addresses with explorer links.
- Pine results say "Tested in our engine. Verify in TradingView."
- No TradingView data in our engine; no automation of TradingView's site or undocumented endpoints.
- Demo clips are filmed by the builder as a mock guru; no real creators are named or shown.
- Users upload clips; the app doesn't download from social platforms. Uploaded clips stay private.
- **Meta Model API spend never goes past the $150 credits.** The builder's card is on file, Meta's "spend limit" only sends an email (no hard cap), and any overage is charged to the card. The credits are "valid for a 10-day development window", so after it ends every call is charged. Guards:
  - **One budget-guarded client** for every Meta API call:
    - it estimates each call's cost before sending it;
    - it refuses the call once the local ledger reaches **$100**, leaving margin for estimation error and billing lag;
    - it records actual usage from each response.
  - **`META_API_ENABLED` defaults to off.** The builder turns it on only while building.
  - **No Meta API calls after the window ends.** The judged deployment (Nov 4–9) runs with the switch off. Its demo results are cached, and live checks use Glimmer on Modal, the trees and Helius, none of which bill the card.
  - **Cheaper models first:** the contributor model for development and evals, and Muse Wonder only when nothing cheaper works.
  - **Every response is cached** by input, so repeat runs cost nothing.
  - **Limits on the public site:** per-visitor limits and 90-second clips.
  - **Email alerts on Meta's Billing page** as a backstop only, at $50 and $100.
- Users' Tiingo keys are never logged or stored server-side.
- The Meta Hackathon button uses the event name in text only, no Meta logo.

---

## 13. Demo video (3 minutes)

Judges rank the top 5 by watching demos live, so this is the final exam. Show only what was built during the hackathon.

| Time | Scene |
|---|---|
| 0:00–0:15 | **Hook:** a mock shill clip, filmed by the builder, for a real past pump.fun token from the test set. "Community token, dev is doxxed, this is going to 10x." The chart looks great. Cut to the IDE. |
| 0:15–0:45 | **Clip to token:** drop the clip in the thread. The agent reads the mint off the screen, flags two copycats, and starts pulling the token's history as it stood 15 minutes after launch. |
| 0:45–1:25 | **Taken apart:** a bundled launch at the open, the wallet spider on the bubble map, identical balances, and the real chart with team and bot volume split out. A $3M token turns out to be a few independent buyers. |
| 1:25–1:50 | **The verdict, then the truth:** "Likely rug" with its rug chance, the plain explanation, and 5 similar past tokens. Then what actually happened: the team's sells hours later. The model's receipt: Muse Glimmer, trained by reinforcement learning on real outcomes, tested on newer tokens it never saw against the trees and a plain checklist. |
| 1:50–2:30 | **Backtest:** a strategy from a clip becomes Pine code through the fix loop, then honest results vs. the S&P. |
| 2:30–2:50 | **How it works:** Meta models and their jobs; eval numbers. |
| 2:50–3:00 | **Close:** "Check the token before you buy it." |

---

## 14. Open questions

| # | Question | Notes |
|---|---|---|
| 1 | Product name | Decided: Trade Receipts. Tagline still open |
| 2 | Pine engine: Resin or PineTS | Decided by the parity test in phase 1; sets the license |
| 3 | Tiingo permission | Not requested for now (draft ready in `notes/tiingo-email.md`). Without it: no cached stock results shown publicly, similar companies only for users with their own data, and the S&P showcase only in the demo video and for users with their own key |
| 4 | Rug check details | Section 7.13 |
| 5 | Modal setup | Keeping it warm through judging; Sandboxes for running Python strategy code **(verify)** |
| 6 | Tour and home page details | Tour library, copy, demo loop |
| 7 | (verify) items | Glimmer's measured training time and cold start on Modal; pump.fun mint and freeze authority revoked; Jito bundle detection; BigQuery Solana tables, query cost, and terms for commercial use; the 30-day label window; Tiingo delisted history pulls and browser access; FRED first-release parameter; Meta video size and length limits; `pine-lint`, Resin, and PineTS v6 coverage; Modal Sandboxes limits |

---

## 15. Build order

Rug check first, then backtesting and stocks. Each phase ends with something that works on its own. The work is sequenced, not cut; the deadline is fixed: Nov 4, 9 PM ET.

1. **Foundations.** Repo and Modal app; Meta API smoke tests (video in, transcribe, structured output, code writing); BigQuery sandbox; Helius key; GoPlus test calls.
2. **pump.fun data pull.** Sampled launches from BigQuery; decode pump.fun, PumpSwap, and Raydium trades and transfers; funding transfers for early buyers and top holders; the wallet history table.
3. **Signals, clusters, and labels.** The 7.3 signals at every snapshot age; wallet clusters (7.4); rugged / faded / survived labels (7.6).
4. **Models and the receipt.** Do these in order (7.8, 7.9):
   1. Baselines: the checklist and the trees.
   2. Glimmer inputs: the signals, the compressed timeline, and the bubble map image.
   3. Glimmer fine-tuning.
   4. GRPO reinforcement learning.
   5. Calibration, the time-split evaluation, and the leakage test.
5. **Live scoring.** Helius and GoPlus for any mint, the same signal code, a check that live and training signals match.
6. **Agent.** Clip or screenshot to address, copycats, streamed evidence, explanation, numbers audit.
7. **Rug check UI.** The research file, the real chart, the bubble map, and the Token Facts label. The home page, tour, and demo project lead with a rug check.
8. **Backtesting.** Code agent and fix loop (Pine), the Pine engine parity test, the Python engine, red team, Compare, Results, Export.
9. **Stock research files and similar companies.**
10. **Evals and numbers audit.** Record numbers for the README and video.
11. **Deploy and cache demo runs** on Modal.
12. **Demo video, README, submission.** The README states that everything was built during the hackathon, lists the Meta models used, and links the video.

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
- **Oct 30:** Product name: Trade Receipts. Tagline: "An agent-native IDE for financial research and automated backtesting." ("multi-agent" dropped because the product isn't built as separate agents).
- **Oct 30:** IDE results become a full backtest report with charts (equity, regimes, 3D trades, monthly returns, histogram); the Strategy Facts label moves to the end as the receipt. Charts use Plotly.
- **Oct 30:** The home page sells backtesting plus stock and crypto research. No strategy input or example prompts in the hero, and no SEC or filing jargon.
- **Oct 31:** Pivot: the crypto rug check is the main feature; backtesting and stocks stay as the second half. Why:
  - Existing rug checkers show surface stats against fixed limits and train no models; ours learns from past launches and shows every signal.
  - New traders, the target, can't read a manipulated chart.
  - Stock data can't be cached and shown publicly without Tiingo's permission, while chain data is public.

  This reverses the Oct 30 decision to park crypto.
- **Oct 31:** The first model covers pump.fun only; other launchpads and chains come later (7.12).
- **Oct 31:** Tokens are scored from launch, on the bonding curve, and rescored after they graduate.
- **Oct 31:** The headline is "Rug chance," with no time limit shown. The labels use the first 30 days, stated in the model's receipt.
- **Oct 31:** The signals in 7.3 come largely from the builder's own trading experience.
- **Oct 31:** Labels are computed from raw chain data. MELT's data isn't trained on, because it's non-commercial.
- **Oct 31:** The main rug model is Meta's Muse Glimmer, trained by us. The hosted Model API models can't be trained, and Muse Spark Open (816B) is too big for the deadline.
  - It's trained mostly on numbers: the signals and the trade timeline as text. The bubble map is the only image.
  - Training is supervised fine-tuning, then reinforcement learning (GRPO). The reward is mainly a Brier-score match with the real outcome, with a penalty for citing numbers not in the input.
  - The checklist, gradient-boosted trees, and fine-tuning-only Glimmer are baselines. Users see the score from whichever wins on the test split.
  - Tagging tokens' names and logos was dropped as a forced use of Meta.
- **Oct 31 (grilling session):** terms are in GLOSSARY.md, and the two hardest-to-reverse choices are in docs/adr.
  - **Wording:** "token", never "coin", for what the rug check scores. The receipt label becomes Token Facts.
  - **Who can rug:** only the team, meaning the creator plus linked wallets, and likely team when it sells alongside. Unlinked sniper collapses are labeled faded (ADR 0001).
  - **What a rug is:** the team sells at least half of its peak holdings and the price falls at least 90%, at any stage of the token, within a 7-day label window. The window is checked against the measured time to rug.
  - **Data pulled:** each token's first 24 hours in full; days 2–7 only the price and the team's sells.
  - **Scoring:** snapshots from 1 minute to 24 hours, and no training on snapshots taken after a rug. Older tokens get evidence without a score; already-rugged tokens get the verdict "Already rugged."
  - **Activity floor:** starting at 20 independent buyers or $10k market cap.
  - **Training data:** launches from May to October 2026, with the newest 4 weeks held back for testing. Superseded the same day; see below.
  - **Headline:** a verdict plus the rug chance. The bands are 60% and 25%, adjusted after calibration and shown with their real rug rates. No faded or survived numbers.
  - **Explanation:** written by Muse Spark from Glimmer's reasons and the signals, with every number audited.
  - **Report:** order as in 7.11. The bubble map shows the top 50 holders and first 50 buyers, and 5 similar past tokens are listed.
  - **Speed:** the first signals within 10 seconds, the full report within a minute when warm.
  - **Demo:** a real past token from the test set, scored at 15 minutes, then its outcome revealed.
- **Oct 31 (data pull):** BigQuery's Solana table has pump.fun's events (inner instructions) only in stretches, mainly May 11–17; October has none. The rug model uses the May week: train on May 11–14, tune on May 15, test on May 16, with Aug 12 and Sep 15 as a later check. Rebuilding October from the `Token Transfers` table was considered and set aside: about 58 GiB of quota a day, a day of extra work, and unverified.
- **Oct 31 (step 3: links, labels, snapshots):** built in `backend/receipts/crypto/` (`dataset.py`, `chain.py`, `roles.py`, `labels.py`, `signals.py`). Decided from the data:
  - The label window is 24 hours, not 7 days: 99.2% of rugs land within a day.
  - The 90% fall is measured above the launch price, since a bonding curve can't fall below it.
  - Snapshots stop at 6 hours.
  - The team is one link from the creator or its bundle; hub wallets (50+ senders) never link.
  - Failed transactions are dropped by chaining reserves (bonding curve; PumpSwap still unverified).
  - Tokens quoted in something other than SOL are left out of snapshots for now (none in May; 1% of Aug 12, 14% of Sep 15).

- **Nov 1 (step 4: models):**
  - Glimmer trains on Kaggle's free GPUs, not Modal: the hackathon's Modal credits weren't claimed (requested Nov 1), and Modal's own free tier gave $1.
  - The receipt's headline is the fair AUC (within mode and age), since pooled AUC mostly measures age and mode.
  - Glimmer answers with the rug chance first, read as the expected value of its distribution over 1–99, and RL trains that number (one-token GRPO). Written reasons come from fine-tuning. Both choices fit the 30 GPU hours.
  - Fine-tuning answers are distilled from the trees (their out-of-fold estimate and SHAP reasons).
  - Training skips examples over 2,100 tokens, which run a T4 out of memory (106 of the 900 in fine-tuning); scoring takes every snapshot.
- **Nov 2 (step 4 results):** GRPO collapsed Glimmer to 1% or 99% answers and lowered its fair AUC on every test set. Fine-tuned Glimmer is the better Glimmer, and the trees win the test split (7.8). Another RL run, with a KL penalty to the fine-tuned model and a lower learning rate, needs about 11 Kaggle GPU hours: about 6 to train and 5 to score. The weekly quota resets Nov 7, after the deadline.
- **Nov 2 (steps 5–6: live checks and the agent):**
  - **One guarded client** (`backend/receipts/agent/meta.py`) makes every Meta call:
    - Repeats come from its cache, even with the API off.
    - It needs `META_API_ENABLED` and refuses after Nov 4, 9 PM ET.
    - It prices each call first: input counted, with images and clips counted by Meta's free token-count endpoint, and output at its cap. It refuses once the ledger plus calls in flight would pass $100, or $10 in one day, so a loop gone wrong can't spend more than a day's cap.
    - Each call's actual usage replaces its worst case.
    - Rejected calls cost nothing. Network and server errors keep the worst case logged.
    - Prices are from dev.meta.ai on Nov 1: Muse Spark 1.3 $1.25 / $4.25 per million tokens, the contributor model $0.10 / $0.20, Muse Wonder $4 / $20.
    - `uv run python -m receipts meta-report` shows spend.
  - **Muse Spark requests go to the contributor model** while `META_CONTRIBUTOR` is on (the default): the same model at a twelfth of the price. It's for public chain data and the builder's own clips, not visitors' uploads.
  - **Server-side history isn't used.** `previous_response_id` can't be priced before sending, so the agent resends its input.
  - **Live checks reuse the training code** on Helius data instead of a separate live implementation, so live and training signals can't drift apart silently.
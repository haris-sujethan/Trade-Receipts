# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript, with Monaco (the VS Code editor) for code files and TradingView's open-source `lightweight-charts` for charts. Backend (later): Python FastAPI on Modal. Confirmed by the user during spec review (SPEC.md, decisions log).

## Users

Anyone who trades or invests, whether or not they can code; most are retail traders. They arrive with an idea (their own, a friend's, something they read or watched) and want to know if it works. Explanations match the depth of the question, and the agent simplifies on request.

Secondary audience during the hackathon: judges, who watch a 3-minute demo video and try the live product without signing up.

## Product Purpose

Build and test trading strategies without writing code. The agent turns plain English, a screenshot, or a video clip into Pine Script v6 (single-chart strategies) or Python (multi-stock, fundamentals, macro), fixes its own compile and lint errors in a visible loop, and backtests honestly against the S&P 500. Users keep the code. A second tab researches stocks from SEC filings.

Success: a user with no coding background goes from an idea to clean, tested code they can paste into TradingView, and understands honestly how it would have performed.

## Positioning

An IDE for trading. Strategies are files; running them produces results; errors and honesty problems (repainting, look-ahead, zero trading costs) show up as problems in the code. Every rule links to where it came from, and every number comes from real data, never from the model.

Clean compiles are expected, not the selling point. Video of trading gurus is only the demo's hook: the product is not framed around gurus or copy-trading, and product copy makes no competitor comparisons.

## Operating Context

- Desktop IDE layout: file explorer, editor and results tabs, agent thread, Problems and Output panels.
- First visit: home page, a sign-up screen whose options are visual only, a "Meta Hackathon: skip sign-up" button, a once-per-browser guided tour over a cached demo, then the user's own IDE.
- Built for the Meta Global AI Developer Hackathon (submission Nov 4, 2026). Uses Meta's models: Muse Spark 1.3, Muse Wonder, Muse Voice Transcribe.
- Users copy Pine code into TradingView, where TradingView's compiler is the final check.

## Capabilities and Constraints

- No buy, sell, or hold advice and no price targets. Every result says "For research and education. Not financial advice."
- No real accounts. Projects are stored in the browser, with zip export and import.
- Stock prices from Tiingo using each user's own free key; daily bars only for stocks. Major-coin prices for the tour and no-key runs from Binance's public archive (credit required, non-commercial). Fundamentals from SEC EDGAR.
- No TradingView data is used, and TradingView's site is never automated.
- Markets: US stocks, ETFs, and crypto. No options, forex, or futures. No live trading for now.
- Crypto analysis is designed but parked until the equities experience works.
- The IDE is desktop-only (phones see a "best on a larger screen" message); the home page works on any screen.
- Full product spec: SPEC.md. Data and tooling research: notes/data-sources.md.

## Brand Commitments

- Name: **Trade Receipts** (chosen Oct 30, 2026). It echoes the first product principle, receipts for everything. Set in one constant (`frontend/src/config.ts`).
- No Meta logo; the event name appears as text only.
- No branding copied from any other product.

## Evidence on Hand

None yet. There are no users, testimonials, metrics, or eval results. Future work must not invent them; example strategies and results in the UI are labeled as examples until real runs replace them.

## Product Principles

1. Receipts for everything: rules link to their source, numbers link to their data.
2. Honest by default: costs included, benchmark always shown, look-ahead and repainting flagged.
3. Show the work: every agent step and fix round is visible.
4. Facts and flags, not advice.
5. It's an IDE: code, runs, and problems, not a page of metrics.

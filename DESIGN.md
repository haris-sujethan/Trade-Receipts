---
name: Trade Receipts
description: Check a pump.fun token before you buy it. An agent-native IDE for crypto rug checks, with copy-trade backtests second.
colors:
  paper: "oklch(99.2% 0 0)"
  paper-2: "oklch(97.2% 0.002 250)"
  paper-3: "oklch(94.6% 0.003 250)"
  ink: "oklch(20% 0.006 250)"
  ink-2: "oklch(42% 0.008 250)"
  muted: "oklch(52% 0.008 250)"
  faint: "oklch(72% 0.006 250)"
  rule: "oklch(91.5% 0.004 250)"
  accent: "#0081fb"
  accent-ink: "#0064e0"
  accent-deep: "#0050b8"
  ok: "oklch(50% 0.12 155)"
  likely-ink: "oklch(48% 0.17 30)"
  likely-bg: "oklch(95.5% 0.03 30)"
  possible-ink: "oklch(48% 0.1 70)"
  possible-bg: "oklch(95.5% 0.045 85)"
  candle-up: "oklch(64% 0.15 152)"
  candle-down: "oklch(57% 0.21 27)"
  group-team: "#0081fb"
  group-likely-team: "#c03fa8"
  group-sniper: "#1baf7a"
  group-bot: "#d9502e"
  group-fresh: "#eda100"
  group-independent: "#a9a9ae"
typography:
  display:
    fontFamily: "Literata Variable, ui-serif, Georgia, serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Literata Variable, ui-serif, Georgia, serif"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1.06
  title:
    fontFamily: "Literata Variable, ui-serif, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.92em"
rounded:
  control: "8px"
  card: "10px"
  window: "12px"
  frame: "18px"
  pill: "999px"
spacing:
  scale: "4px"
  section-gap: "128px"
  container: "1240px"
---

# Design System: Trade Receipts

## Overview

A light, quiet product site and IDE around one idea: show the token as it really is. The look follows the
category standard the user picked (direction 5, "The standard"): a centred serif headline, then the product
itself on a desktop photograph, then rows of cards. Meta blue is the only accent. Real data does the talking;
decoration stays out of the way.

- **Home** (`frontend/src/pages/Home.tsx`, `home.css`): headline, one sentence, two actions; the live demo on a
  Mac-style desktop (wallpaper, token pills, app window, no menu bar); "Everything we check, on every token" as
  12 cards; a closing line; the footer with credits and "Not financial advice".
- **IDE** (`frontend/src/pages/Ide.tsx`, `ide/`): the demo's app window at full size. Files on the left, the
  editor area in the middle, the agent's thread on the right, problems and output below. Two modes: Analyze (rug
  checks) and Copy trade (copy-trade backtests). Strategy backtests are unplugged; their code stays.
- **Sign-up** (`SignUp.tsx`): the home nav and one card.

Tokens live in `frontend/src/styles/tokens.css` (`:root`); `base.css` maps the IDE's older names
(`--desk-*`, `--ink`, `--paper`) onto them, in hex where Plotly reads them.

## Colors

### Primary
- **Meta blue** `#0081fb` for fills, marks and large text; **#0064e0** (5.4:1 on white) for buttons, links,
  small text and focus; `#0050b8` on hover.

### Neutral
- Paper `oklch(99.2% 0 0)` with two steps (`paper-2`, `paper-3`) for wells and hovers; ink in three weights
  (`ink`, `ink-2`, `muted`) and `faint` for disabled text; one hairline `rule`.

### Status
- Verdicts: Likely rug in `likely-ink` on `likely-bg`, Possible rug in `possible-ink` on `possible-bg`,
  Unlikely rug in ink-2 on paper-3. "Rugged" in past outcomes uses `likely-ink`. Status colors never stand in
  for a wallet group.

### Wallet groups (charts)
In this order everywhere (`data/tokens.ts`, `--g-*`): team `#0081fb`, likely team `#c03fa8`, snipers
`#1baf7a`, bots and wash traders `#d9502e`, fresh wallets `#eda100`, everyone else `#a9a9ae`. Validated with
the dataviz checks on `#fcfcfb`: CVD worst adjacent ΔE 9.1, normal-vision worst 17.0; the grey fails the
chroma floor by design (it marks "nothing to worry about"). Snipers, fresh and grey sit under 3:1, so every
chart carries a legend.

### Named Rules
- One accent. Blue is the action and the team (in a copy-trade backtest, you); nothing else is blue.
- Candles in the market-cap chart are ink, hollow when up and solid when down, so color stays free for groups.
  Only the model card's rug illustration uses green and red candles.

## Typography

Literata for display and titles (weight 400, slight negative tracking), Hanken Grotesk for everything else,
JetBrains Mono only for addresses and code. Numbers are tabular.

### Hierarchy
- Hero 72px, two lines, the second in `muted`. Section heads 56px. Card titles 26px serif with a 14.5px
  muted subtitle. Body 16px; app UI 13 to 14px; chart ticks 11px.

### Named Rules
- No eyebrows, no tracked capitals, no middle-dot meta strings.

## Layout

- Container 1240px, 24px gutters (16px on phones). Sections 128px apart; the demo sits 36px under the hero's
  actions because it belongs to the hero.
- Card grid: `repeat(auto-fill, minmax(268px, 1fr))`, four across on the home page, fewer in the IDE.

## Elevation & Depth

### Shadow Vocabulary
- Window: a 0.5px edge plus a soft offset shadow (`--color-shadow`, `--color-shadow-soft`).
- Popovers and the tour card: 1px rule ring plus a soft offset shadow.

### Named Rules
- Glass only where it does a job: the token pills on the desktop photograph. No glass panels elsewhere.

## Shapes

Controls 8px, cards 10px, windows and popovers 12 to 14px, the desktop frame 18px, pills fully round.

## Components

### Buttons
- Primary: `#0064e0`, white text, 44px (34px in the nav), hover `#0050b8`, pressed scale 0.98.
- Secondary: paper with a 1px rule ring.

### Token pills
- On the photograph: white glass (50%) with ink text; the active pill solid white with a soft shadow.

### Cards (What we check)
- A well (`paper-2`) holding one small chart drawn from the check's own data, then a serif title, a muted
  subtitle and label/value rows on hairlines. The model card's picture is a labelled illustration.

### The demo window and the IDE
- Title bar with three window lights, an Analyze / Copy trade switch, workspace tabs with a 2px blue underline, the
  thread on a slightly darker side panel, and a rounded message box.
- The home demo has three examples: BABYBULL (a rug check), a copy-trade backtest of a real leaderboard wallet (its
  latest position's chart while the positions are priced, then the result at a glance), and Jim (a check that didn't
  rug). The message is typed a letter at a time and the link is pasted whole.
- Agent steps: a spinner, then a check; live counts under "Checking the token"; the answer streams in; "N
  numbers checked against the data" closes it.

### Rug check view (no receipt)
- Overview: token and mint, the rug chance as a large serif number with the verdict pill, "Not financial
  advice", what happened after the check (saved checks only), the agent's explanation, the main signals, Muse
  Glimmer's second opinion, the five most similar past launches, copycats.
- Chart: market cap in 15-second candles with volume by group and team sells marked.
- Holders: the bubble map (funders as dark hub dots with spokes; the team in blue) and the top holders.
- Signals: the 12 cards.

### Copy trade view (`ide/CopyTab.tsx`, `PositionChart.tsx`, `copy.css`)
- Form on top: the wallet (a pump.fun profile link or an address, editable after a run), SOL per position, and three
  segmented rows of native radios: Positions (25, 50, 100), "Buy after its buys" and "Sell after its sells" (2 s,
  10 s, 30 s, 1 min, 5 min, 10 min, Custom in seconds or minutes). Nothing runs until Run backtest is pressed; the
  values it will use are stated beside the button. One run per set of values: the same values make the button "Open
  result" (or "Showing this result") with when it ran, "Running…" while it runs, and "Run again with newer trades"
  once it's over 30 minutes old. Switching to Copy trade opens a blank form with the saved backtest to open; nothing
  replays or runs by itself. Without the backend the fieldset is disabled and the reason is
  shown. Each run opens in its own tab, named for the wallet and the timing. A run that reused the data already pulled
  for the wallet says so in its header.
- Totals: three wells. The wallet and you each have a serif P&L in SOL, the percentage on what was spent, and how many
  positions made money. The third has the median price move in the delay after its buys and after its sells. Then
  the backtest's notes and "Not financial advice". Timings tried on the same wallet are listed for comparison.
- Positions table: newest first, with grouped heads (Result: wallet and you; Price move: after its buy and after its
  sell). Each row has a two-dot drawing of the wallet's result (ink) against yours (blue) on one scale with zero
  marked. A row opens into its chart and every fill. A narrow editor area drops the buy time, then the drawing.
- Position chart: market cap in SOL as a step line, and time since its first buy on a log scale (labelled), so its
  seconds and your minutes both have room. Its buys and sells are ink triangles and yours are blue (up for a buy, down
  for a sell). Dashed blue lines join its first buy to yours and its last sell to yours: the move while you wait.
  The marks have hover tips, and the fills are also listed as text.

### Threads
- The file list and the thread can each be hidden (a button in its head, toggles in the top bar); the choice is
  remembered per visitor.
- A thread runs one live answer at a time, and the same message sent again while its result is fresh points to it.
- A thread keeps every result in it; earlier ones are a scroll up, and thread history reopens old threads intact.
- A message naming another token or wallet opens a new thread; a question about what's there is a follow-up, sent with
  the latest answer's `run_id` (or "demo:<saved id>") as `context_id` and answered from the data already pulled. A
  question in an example thread continues it in a thread of your own. Offline, follow-ups reply that they need the
  live agent.

### Named Rules
- Numbers, never a verdict on the wallet: no "good", "bad", "profitable trader" or "scam" labels. P&L is ink with
  its sign; green and red stay out of it.

## Do's and Don'ts

### Do:
- Show the product with real data from the saved checks; label anything else as an example or illustration.
- Disable what can't work yet and say why ("Live checks are coming soon").
- Keep "Not financial advice" on every result.

### Don't:
- Say "safe", name competitors, or bring back the receipt label for rug checks.
- Animate width, height, top or left; use one reveal at most per view and honour reduced motion.
- Add colors outside the tokens.

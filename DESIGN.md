---
name: Trade Receipts
description: Check a pump.fun token before you buy it. An agent-native IDE for crypto rug checks, with backtesting second.
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
  editor area in the middle, the agent's thread on the right, problems and output below.
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
- One accent. Blue is the action and the team; nothing else is blue.
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
- Title bar with three window lights, a Backtest/Analyze switch, workspace tabs with a 2px blue underline, the
  thread on a slightly darker side panel, and a rounded message box.
- Agent steps: a spinner, then a check; live counts under "Checking the token"; the answer streams in; "N
  numbers checked against the data" closes it.

### Rug check view (no receipt)
- Overview: token and mint, the rug chance as a large serif number with the verdict pill, "Not financial
  advice", what happened after the check (saved checks only), the agent's explanation, the main signals, Muse
  Glimmer's second opinion, the five most similar past launches, copycats.
- Chart: market cap in 15-second candles with volume by group and team sells marked.
- Holders: the bubble map (funders as dark hub dots with spokes; the team in blue) and the top holders.
- Signals: the 12 cards.

## Do's and Don'ts

### Do:
- Show the product with real data from the saved checks; label anything else as an example or illustration.
- Disable what can't work yet and say why ("Live checks are coming soon").
- Keep "Not financial advice" on every result.

### Don't:
- Say "safe", name competitors, or bring back the receipt label for rug checks.
- Animate width, height, top or left; use one reveal at most per view and honour reduced motion.
- Add colors outside the tokens.

# Trade Receipts

An agent-native IDE for financial research and automated backtesting. The main feature is the **rug check**: it scores new pump.fun tokens with Muse Glimmer, which we train ourselves, and shows the evidence. Crypto backtesting comes second. It's built solo for the Meta Global AI Developer Hackathon (Indie track), due Nov 4, 2026, 9 PM ET.

## Where things live

- **Rug check** (signals, wallet links, labels, snapshots, the model, the report): `SPEC.md` section 7. Terms such as team, rug, snapshot and rug chance are defined in `GLOSSARY.md`; use them exactly as defined there.
- **Why** only the team can rug, and why Glimmer is trained with reinforcement learning: `docs/adr/`.
- **What to build next:** `SPEC.md` section 15 (build order). Past decisions: section 16.
- **Hackathon** rules, rubric, banned project types, submission and judging: `notes/hackathon.md`. Weigh scope and demo choices against it.
- **Setup** before a build step (accounts, keys, `.env`, the prompt to start a new chat): `notes/setup.md`. Walk the user through the unchecked items before building.
- **Data sources and their licenses:** `notes/data-sources.md` and `SPEC.md` section 9. Check a source's terms there before using it.
- **UI work:** `DESIGN.md` (tokens, palettes, components) and `.impeccable/`. Product positioning: `PRODUCT.md`.

## Working agreements

- **Build features fully.** Sequence the work against the deadline rather than cutting scope.
- **Say "token"** for what the rug check scores. The receipt label is Token Facts.
- **The public site is crypto only for now.** Stock code stays in the repo, unplugged, for when stocks return.
- **Keep the preview honest.** Example values are labeled as examples. A control that can't work yet is disabled with a visible reason or "coming soon". Every number in model-written text comes from a tool and passes the numbers audit.
- **Facts and flags, never advice.** Results carry "Not financial advice". A low rug chance never says safe.
- **Copy stays plain and short.** Product and pitch copy names no competitors.
- **Use only services that are free with no credit card:**
  - BigQuery sandbox for past pump.fun history.
  - Helius's dashboard free plan for live token data.
  - GoPlus.
  - Hugging Face.
  - Modal's existing credits for Glimmer, with Kaggle's free GPUs as the training fallback.

  The one exception is the Meta Model API: its $150 credits need a card on file (`notes/setup.md`, step 6).

  Before adding anything new, confirm it has a no-card free tier.
- **Commit or push only when the user asks.**

## Guardrails

- **Meta Model API spend stays inside the $150 credits.** The user's card is on file, Meta has no hard cap (its spend limit only emails), and any overage is charged to the card. Every Meta API call:
  - goes through one budget-guarded client that estimates the cost first and refuses once the local ledger reaches $100;
  - is logged with its actual usage;
  - is cached by input.

  Use the contributor model while developing. `META_API_ENABLED` stays off unless the user turns it on, and there are no Meta API calls after the credits' 10-day window ends. Glimmer (open weights on Modal), Helius and BigQuery never touch this budget.

- **API keys** go in `.env` (gitignored), and the user adds them themselves. Code reads them from the environment; keys never appear in chat or commits.
- **Third-party data and clips** stay out of the repo. The root `data/` cache is gitignored, while `frontend/src/data/` holds made-up example data and is tracked.
- **Off-limits sources** (their terms rule them out): Yahoo/yfinance, Coinbase market data, Etherscan, and any TradingView data or site automation. MELT is used for its label definitions only.

## Gotchas

- **Plotly** is a custom bundle in `frontend/src/ide/report/plotly.ts`; register any new trace type there. `vite.config.ts` defines `global` and stubs the map stylesheet, both for Plotly.
- **Monaco** loads only the editor core plus Python and Markdown (`frontend/src/monaco/setup.ts`). Add other languages there.
- **Chart palettes** are validated with the dataviz skill's validator; keep the wallet-group order in `frontend/src/data/tokens.ts`.
- **A hidden browser pane** throttles timers and animation frames. When checking the home demo or the tour, read the DOM state rather than trusting screenshot timing.

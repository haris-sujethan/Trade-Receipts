# Trade Receipts

**Check a pump.fun token before you buy it.**

Trade Receipts is an agent-native IDE for crypto research. It has two modes:

- **Analyze** reads a new pump.fun token straight from the chain, shows who really holds it, and scores its **rug chance** with a model trained on past pump.fun launches.
- **Copy trade** backtests copying a pump.fun wallet a little late: what the wallet made, and what you'd have made buying and selling a few minutes after it.

Every number on screen comes from on-chain data and is checked before you see it. Results are facts and flags, never advice.

Built solo for the **Meta Global AI Developer Hackathon 2026 (Indie track)**. Everything in this repository was built during the hackathon.

- Waitlist: [tradereceipts.io](https://tradereceipts.io)
- Demo video: _link_

> For research and education. Not financial advice.

---

## Contents

1. [What it does](#what-it-does)
2. [How Meta's models are used](#how-metas-models-are-used)
3. [The data](#the-data)
4. [Labels: what counts as a rug](#labels-what-counts-as-a-rug)
5. [Signals and snapshots](#signals-and-snapshots)
6. [Training Muse Glimmer on Kaggle](#training-muse-glimmer-on-kaggle)
7. [Results](#results)
8. [Live checks](#live-checks)
9. [The agent and the numbers audit](#the-agent-and-the-numbers-audit)
10. [Copy-trade backtests](#copy-trade-backtests)
11. [Architecture](#architecture)
12. [Run it locally](#run-it-locally)
13. [Command line](#command-line)
14. [Repository map](#repository-map)
15. [Data sources and licenses](#data-sources-and-licenses)

---

## What it does

### Analyze: the rug check

Paste a pump.fun link, a ticker or a token's address into the chat. The agent:

1. **Reads every trade** since launch, from the bonding curve to PumpSwap.
2. **Traces the wallets**: the creator, the first 50 buyers and the 50 biggest holders, and who funded each of them, two hops back.
3. **Splits the holders** into the team, likely team, snipers, bots and wash traders, fresh wallets, and independent buyers.
4. **Checks the token's authorities**: whether new tokens can be minted, whether holders can be frozen, and more, cross-checked with GoPlus.
5. **Scores the rug chance** from 81 signals, and shows the 5 most similar past launches and how they ended.
6. **Explains it** in plain English with Muse Spark. Every number in the explanation is audited against the data.

The result opens as a file in the editor, with four views:

| View | What it shows |
|---|---|
| Overview | The rug chance, the verdict (Likely, Possible or Unlikely rug), what happened after similar launches, and the key signals |
| Chart | The real market-cap chart in candles, with the team's and snipers' trades marked |
| Holders | A bubble map of the biggest holders and first buyers, sized by share, colored by group and linked by funding |
| Signals | Every signal family, with this token's values |

The flags the agent calls out also show in a **Problems** panel, the way an editor lists errors in code. Follow-up questions are answered from the data already pulled, without fetching it again.

### Copy trade: the copy-trade backtest

Paste a pump.fun wallet. Choose how long after they buy you'd buy, how long after they sell you'd sell, and how many of their latest closed positions to copy (25, 50 or 100). The backtest replays every position:

- what the wallet made;
- what you'd have made, copying it late;
- how the price moved while you waited.

It opens with a chart for each position: their buys and sells, yours, and the move in between. The chat stays closed until you have a question, and then answers from that backtest's own numbers.

Example, from the saved run: a wallet from pump.fun's leaderboard made **+43.0%** across 50 positions. Copying it 5 minutes after each buy and 10 minutes after each sell made **−3.6%**.

---

## How Meta's models are used

| Model | Role |
|---|---|
| **Muse Glimmer** (Meta's open-weight 30B model, Apache 2.0, reads text and images) | Trained by us on past pump.fun launches: fine-tuned, then trained with reinforcement learning against real outcomes. It reads each token's signals, its holders, its trades over time and a bubble-map image, and answers with a rug chance and its reasons. Its rug chance is shown on every check as a second opinion. |
| **Muse Spark 1.3** (Meta Model API) | Runs the agent. It reads the user's message, decides which tools to call (find the token, check it, read token authorities, run a backtest, read an address from a screenshot or clip), and writes the explanation. Every number it writes passes the numbers audit. |

---

## The data

There was no rug dataset we could use, so we built one from raw chain data.

- **Source:** Google BigQuery's public Solana dataset (`bigquery-public-data.crypto_solana_mainnet_us`), queried from the free BigQuery sandbox (1 TiB of queries a month, no card).
- **Decoding:** pump.fun's events (launches, bonding-curve trades, graduations and PumpSwap trades) are decoded from the transactions' inner instructions with pump.fun's public program interface (IDL).
- **Launches:** **41,956** pump.fun launches pulled for May 11–16, 2026, plus Aug 12 and Sep 15 for a check months later.
- **Activity pulled:**
  - every trade of each token on the bonding curve and PumpSwap;
  - the SOL funding into each token's creator, first 50 buyers and 50 biggest holders, and into their funders, two hops back;
  - a wallet history table: every wallet's past launches, trades and outcomes.
- **Failed transactions** are dropped by chaining each bonding-curve trade's reserves to the next, so only trades that really happened count.

Pipeline: `backend/receipts/crypto/` (`bq.py`, `pull.py`, `events.py`, `funding.py`, `history.py`, `dataset.py`).

---

## Labels: what counts as a rug

Labels are computed from raw chain data, so the data and the model are ours to use. The definition is recorded in [ADR 0001](docs/adr/0001-only-the-team-can-rug.md).

| Label | Meaning |
|---|---|
| **Rugged** | Within 24 hours of launch, the **team** sold at least half of its peak holdings into buyers and the price fell at least 90% from its peak |
| **Faded** | Trading died out without a rug, including collapses caused by unlinked snipers |
| **Survived** | Still trading after 24 hours with no 90% collapse |

**Only the team can rug.** The team is the creator plus every wallet linked to it by funding, transfers or the launch bundle. Sniper dumps stay a signal, not a rug, so the model learns the scam the rug check exists to catch: a team selling into its own buyers.

The 24-hour window comes from the data: 99.2% of rugs in the May launches landed within a day. Terms are defined in [GLOSSARY.md](GLOSSARY.md).

---

## Signals and snapshots

- **Snapshots:** each token is rebuilt at **1, 5, 15 and 30 minutes, 1 hour and 6 hours** after launch, using only what had happened by then. A token checked 10 minutes after launch is compared with other tokens at 10 minutes.
- **No look-ahead:** snapshots taken after a token rugged are never trained on. A leakage test (`backend/tests/test_leakage.py`) rebuilds snapshots with everything after them deleted and requires identical signals.
- **81 signals per snapshot**, in families (`backend/receipts/crypto/signals.py`):
  - **Launch:** how much was bought in the launch block and the first 3 blocks.
  - **Team:** its share now and at peak, how much it sold, and when.
  - **Snipers:** how many, how many are known bots, and how much they bought, hold and sold.
  - **Holders:** concentration, clusters, hidden supply, and wallets funded in the last hour.
  - **Trading:** same-size and round-size buys, wash trading, and independent buyers.
  - **Chart:** curve progress, green candles, and the fall from peak.
  - **Reputation:** the wallets' past launches and rugs, counted only from before the token's launch.
- **Activity floor:** a snapshot enters the dataset once the token has real activity: 20 independent buyers or a 60 SOL market cap.
- **Split by date**, so the model is always tested on days it never saw:

| Split | Days | Tokens | Snapshots |
|---|---|---|---|
| Train | May 11–14, 2026 | 7,849 | 20,848 |
| Tune | May 15 | 2,001 | 5,011 |
| Test | May 16 | 854 | 2,210 |
| Later check | Aug 12 and Sep 15 | | 8,408 |

---

## Training Muse Glimmer on Kaggle

Glimmer is trained on **Kaggle's free GPUs** (2× NVIDIA T4, 30 GPU hours a week).

**Setup**
- **Base weights:** [unsloth/Muse-Glimmer-30B-unsloth-bnb-4bit](https://huggingface.co/unsloth/Muse-Glimmer-30B-unsloth-bnb-4bit) on Hugging Face (4-bit, 20.7 GB), split across both T4s and computed in float16.
- **LoRA:** rank 8 (alpha 16) on the language model's projections, 52M trainable parameters. The image encoder is frozen.
- **Optimizer:** 8-bit AdamW, gradients accumulated over 8 examples.
- **Prompts:** about 1,700 tokens plus one 448×448 bubble-map image per snapshot, built by `backend/receipts/crypto/prompt.py`.

**What Glimmer reads for one token at one snapshot**
- **The signals**, written as lines by family.
- **The 20 biggest holders:** share, group, when each first bought, how much it sold, and how it was funded.
- **The price line** from launch to the snapshot.
- **Trades over time:** SOL bought and sold by each group, in time buckets. The order is the giveaway: small identical buys, then independent buyers, then the team selling into every buy.
- **The bubble map** as an image.

**How it answers:** "Rug chance: N%" first, then the signals that raise and lower it. Every N from 1 to 99 is a single token, so one forward pass gives Glimmer's whole distribution over N, and the rug chance is its expected value.

**Stage 1: supervised fine-tuning** (learning rate 1e-4)
- 900 snapshots from the training days.
- Answers are taught by our gradient-boosted trees: their calibrated rug chance, made without seeing that day, and the signals that moved it most (SHAP).
- Every number in an answer is copied from its prompt, so answers pass the numbers audit by construction.

**Stage 2: reinforcement learning with GRPO** (learning rate 2e-5)
- About 900 more snapshots from the training days.
- For each snapshot, Glimmer samples **8 rug chances** from its distribution.
- Each is rewarded by the Brier score against what really happened, 1 − (N/100 − y)², and pushed up or down relative to the group's mean. This rewards being right and being honestly confident.

**Running it**
- The job is `backend/kaggle/glimmer_job.py`, pushed to Kaggle with `backend/kaggle/push.py`.
- Modes: `sft`, `rl`, and `score` for writing predictions.
- Each run's folder is in `backend/kaggle/jobs/`: `glimmer-sft`, `glimmer-rl`, `glimmer-score-*`, `glimmer-demo`.
- Predictions are scored locally with `uv run python -m receipts glimmer-eval`.

**Measured speed:** 23 seconds per training example and 8 seconds to score a snapshot. Scoring the demo tokens at every age took 20 GPU minutes.

---

## Results

Measured on **May 16**, the held-out test day. The headline number is the **fair AUC**: how well a model ranks rugs above non-rugs within the same mode and age, averaged. Pooled AUC is mostly a measure of age and mode (rug rates fall from 77% at 1 minute to 13% at 6 hours), so we don't lead with it. 0.5 is a coin flip.

| Model | Fair AUC |
|---|---|
| **Gradient-boosted trees** (LightGBM, the 81 signals), every test snapshot | **0.71** |
| **Muse Glimmer, fine-tuned**, 300 test snapshots | **0.74** |
| Muse Glimmer before training, same 300 snapshots | 0.62 |
| A typical red-flag checklist (10 rules, thresholds fixed in advance) | 0.44 |

- The trees hold up months later: 0.72 on Aug 12 and 0.70 on Sep 15.
- Fine-tuned Glimmer scores 0.76 on Aug 12.
- **Live checks score with the trees, with Glimmer's rug chance shown beside them as a second opinion.**
- Reports: `data/reports/baselines.json` and `data/reports/glimmer_*.json`. Code: `backend/receipts/crypto/baselines.py` and `glimmer_eval.py`.

---

## Live checks

A live check rebuilds the token from **Helius** and runs **the same dataset, label and signal code that built the training data**, so live scores match the evaluated model.

1. Every transaction that touched the mint, from launch to now.
2. Each traced wallet's transactions in the two days before the launch and since.
3. Their funders' incoming transfers.
4. For the early buyers, the tokens they bought in the day before, to tell sniper bots from the creator's bundle.

Then the trees score it and GoPlus cross-checks the token's authorities.

- **Parity:** on 8 May 16 test tokens, live checks gave the same verdict as their training snapshots on all 8. The rug chance moved 0.007 on average (`uv run python -m receipts live-parity`).
- **Cost:** about 3,000 Helius credits and one to four minutes per token.
- **Pace:** requests run 8 at a time, spaced to Helius's limits.
- **Limits:** 6 live checks per visitor per hour and 60 a day in all, so the free plan's 900,000 monthly credits last.
- **Unscored tokens:** a token that already rugged, is older than a day, or is priced in another token isn't scored. It still shows its chart, holders and signals, with the reason.

Code: `backend/receipts/crypto/live.py`, `helius.py`, `transactions.py`.

---

## The agent and the numbers audit

**The agent** (`backend/receipts/agent/loop.py`) runs on Muse Spark with these tools:

| Tool | What it does |
|---|---|
| `find_token` | Finds a token by ticker or name |
| `check_token` | The live rug check |
| `token_security` | GoPlus token authorities |
| `copy_trade` | The copy-trade backtest |
| `read_address` | Reads a token's address from a screenshot or clip |

Each step streams to the chat as it runs, with its progress (transactions read, wallets traced, funders traced). Follow-ups reuse the results already gathered in the thread.

**The numbers audit** (`backend/receipts/agent/audit.py`): numbers come from tools, never from the model. Every number in the agent's explanation is matched against the tool outputs before it's shown. The answer says how many numbers it checked, for example "19 numbers checked against the data."

**The Meta spend guard** (`backend/receipts/agent/meta.py`): every Meta call goes through one client.
- It prices each call before sending it, and refuses once the local ledger would pass $100, or $10 in a day.
- It logs each call's real usage, and caches by input.
- It stays off unless `META_API_ENABLED` is set.
- `uv run python -m receipts meta-report` shows spend.

---

## Copy-trade backtests

`backend/receipts/crypto/copytrade.py`:

1. Reads the wallet's latest transactions from Helius and finds its closed pump.fun positions, one per token.
2. Prices every fill as a market cap in SOL, from the token's own trades.
3. Copies each position at the chosen delays:
   - each buy happens that long after the wallet's buy, at the market price then;
   - each sell copies the same share of holdings that long after the wallet's sell.
4. Uses the fees each token's trades actually paid.
5. Reports the wallet's result, yours, how many positions made money, and the median price move in each wait.

Every backtest run from the form is saved, so questions about it in the chat are answered from its own numbers.

---

## Architecture

```
Browser (React + Vite + TypeScript)
  IDE: files · editor tabs (check, backtest) · Problems/Output · chat
    │  /api (server-sent events)
    ▼
FastAPI backend (Python 3.13)
  /api/agent      Muse Spark agent ─┬─ check_token ── live.py ── Helius
  /api/check      live rug check    ├─ token_security ── GoPlus
  /api/copytrade  backtest          ├─ copy_trade ── copytrade.py ── Helius
  /api/demo       saved runs        └─ numbers audit
    │
    └─ the same dataset, label and signal code as training
         ▲
Training: BigQuery public Solana data ─► decode ─► labels ─► snapshots
          ─► LightGBM trees, and Muse Glimmer (LoRA SFT, then GRPO) on Kaggle T4s
```

- **Frontend:** React, Vite, TypeScript, react-resizable-panels, Monaco (code views) and a custom Plotly bundle (charts).
- **Backend:** FastAPI, DuckDB, PyArrow, LightGBM, httpx.
- **Training:** Unsloth, PEFT (LoRA), bitsandbytes, PyTorch on Kaggle.

---

## Run it locally

**You need:**
- Node 22+
- Python 3.13 with [uv](https://docs.astral.sh/uv/)
- A free [Helius](https://dashboard.helius.dev) key, for live checks and backtests

**1. Keys.** Copy `.env.example` to `.env` at the repo root and fill in what you use. `.env` is gitignored.

| Variable | For |
|---|---|
| `HELIUS_API_KEY` | Live checks and copy-trade backtests |
| `GOOGLE_CLOUD_PROJECT` | Pulling history from BigQuery (only to rebuild the dataset) |
| `HF_TOKEN`, `KAGGLE_API_TOKEN` | Training Glimmer on Kaggle |
| `MODEL_API_KEY`, `META_API_ENABLED` | The Muse Spark agent. Without them, checks still run and show their own findings |

**2. Backend**

```bash
cd backend && uv sync && uv run uvicorn receipts.server:app --port 8000
```

**3. Frontend** (in another terminal)

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. The IDE talks to the backend through Vite's `/api` proxy.
- **First visit:** a guided tour plays a saved rug check and a saved backtest.
- **After the tour:** the IDE starts blank, with the examples in the `examples` folder.
- **Without the backend:** the IDE replays the saved examples.

**Tests**

```bash
cd backend && uv run pytest
```

```bash
cd frontend && npm run typecheck
```

---

## Command line

From `backend/`, run `uv run python -m receipts <command>`:

| Command | What it does |
|---|---|
| `bq-check` | BigQuery Solana tables, coverage and cost |
| `pull-block` | Pull and decode a block of days from BigQuery |
| `pull-funding` | Trace SOL funding for a block's wallets, two hops back |
| `wallet-history` | Build the wallet history table |
| `build-dataset may aug sep` | Build tokens, wallet links, labels and snapshots |
| `train-baselines` | Train and test the checklist and LightGBM |
| `glimmer-data` | Write Glimmer's prompts, bubble maps and fine-tuning answers |
| `glimmer-eval` | Score a Kaggle job's predictions against the outcomes |
| `live-check <mint>` | A live rug check from Helius |
| `live-parity` | Live checks of test tokens compared with their training snapshots |
| `copy-trade <wallet> --buy-after 300 --sell-after 600` | A copy-trade backtest of a wallet |
| `agent "<message>"` | The agent on one message |
| `goplus <mint>` | GoPlus token security |
| `meta-report` | Meta API spend so far |

---

## Repository map

| Path | What's there |
|---|---|
| `frontend/src/ide/` | The IDE: chat, check and backtest tabs, files, tour, state |
| `frontend/src/demo/` | Charts, the bubble map, result views, saved-run replays |
| `frontend/src/pages/` | Home, sign-up and IDE pages |
| `backend/receipts/server.py` | The HTTP API |
| `backend/receipts/agent/` | The agent loop, the numbers audit, the Meta client and its guard |
| `backend/receipts/crypto/` | Data pipeline, labels, signals, models, live checks, copy trade |
| `backend/kaggle/` | Glimmer's training and scoring job, and the script that pushes it to Kaggle |
| `backend/tests/` | Tests, including the leakage test |
| `docs/adr/` | Decisions: only the team can rug; Glimmer as the rug model |
| `SPEC.md` | The full spec and decisions log |
| `GLOSSARY.md` | Terms: token, team, rug, snapshot, rug chance |

---

## Data sources and licenses

| Source | Used for | Terms |
|---|---|---|
| Google BigQuery public Solana dataset | Training history | Public dataset, free sandbox |
| Helius | Live checks and backtests | Free plan |
| GoPlus | Token authorities | Free, credited as "Powered by GoPlus" |
| pump.fun public IDL | Decoding pump.fun events | Public |
| Muse Glimmer | The trained rug model | Apache 2.0 |
| Muse Spark (Meta Model API) | The agent and explanations | Meta Model API terms |

Raw third-party data stays out of the repository: `data/` is gitignored. The examples in `frontend/public/demo` are saved runs of real tokens. MELT's rug definitions informed the labels, but its data isn't trained on (non-commercial license). Full notes: `notes/data-sources.md`.

---

**For research and education. Not financial advice.** A low rug chance never means a token is safe.

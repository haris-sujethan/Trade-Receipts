# Setup before each build step

These are the accounts and keys the user sets up themselves. Every service must be free and need no credit card; the one exception is flagged below. Keys go in `.env` at the project root (gitignored), and the user fills in the values; they never go in chat or commits.

## Before step 1–2: the pump.fun data pipeline

- [x] **Commit the current work,** including `CLAUDE.md` and `frontend/src/data/` (committed Oct 31).
- [x] **BigQuery sandbox:** create a Google Cloud project with the sandbox at console.cloud.google.com/bigquery. It needs no card and no billing account. Note the project ID.
- [x] **Google Cloud CLI:** installed Oct 31 (`brew install --cask google-cloud-sdk`).
- [x] **Sign in to Google Cloud** once, so the pipeline can query as you without a key file:
  ```bash
  gcloud auth application-default login
  ```
- [x] **Helius:** get a free API key at dashboard.helius.dev. The dashboard free plan needs no card; the CLI signup asks for 1 USDC, so use the dashboard.
- [x] **`.env`** at the project root, copied from `.env.example`:
  ```
  GOOGLE_CLOUD_PROJECT=your-project-id
  HELIUS_API_KEY=your-key
  ```
- [x] **Check both** from `backend/`:
  ```bash
  cd backend && uv run python -m receipts helius-check
  ```
  ```bash
  cd backend && uv run python -m receipts bq-check
  ```

Done by the agent (Oct 31):
- [x] uv and the Python project in `backend/`, plus `.env.example`.
- [x] The pump.fun and PumpSwap IDLs, pinned to commit `639b87f` (Oct 13) and fetched into `data/idl/` at runtime, since their repo states no license.
- [x] Helius's limits: 1M credits a month; standard RPC calls cost 1 credit, `getTransactionsForAddress` 10 per 100 transactions, DAS 10, and the Wallet API (including funded-by) 100 a call, so funding traces use plain RPC calls.
- [x] GoPlus test call: works with no key.
- [x] The BigQuery tables, their coverage of May–October 2026, and the query cost (Oct 31). Findings are in `notes/data-sources.md`: pump.fun's events exist only in a few stretches, May 11–17 being the long one.

## Before step 4: training Glimmer

- [ ] **Modal:** the account already shows the hackathon credits without a card. Log in from the terminal:
  ```bash
  pip3 install modal
  ```
  ```bash
  modal token new
  ```
- [ ] **Hugging Face (optional):** Glimmer's weights (`meta-models/Muse-Glimmer-30B`) aren't gated (checked Oct 31), so downloading needs no account. An account and a write token (`HF_TOKEN` in `.env`) are only needed to publish the trained adapter for judges.
- [ ] **Fallback (only if Modal credits run short):** a Kaggle account (free GPUs; needs phone verification, no card). Its two 16 GB cards are a weak fit for a 30B model: possible for fine-tuning, impractical for reinforcement learning.

## Before step 6: the agent (Muse Spark, Voice Transcribe)

- [ ] **Meta Model API key** in `.env` as `MODEL_API_KEY`.
- [x] **Card on file:** yes, confirmed Oct 31. It's the one exception to the no-card rule: the Participant Guide requires a card before any API call works. **Going over the $150 charges this card, and that must never happen.**
  - Meta has **no hard cap**; its "spend limit" only sends an email.
  - The credits are valid for a **10-day window**, and any call after that is charged.
  - The app enforces the budget itself (`SPEC.md` section 12): a guarded client that refuses calls past a $100 ledger, `META_API_ENABLED` off by default, and no Meta API calls after the window.
- [ ] **Credit expiry:** check the exact end date on the Billing page and note it here: ______
- [ ] **Email alerts** on the Billing page at $50 and $100, as a backstop only.
- [ ] **Usage checks:** look at usage on the Billing page each day you build.

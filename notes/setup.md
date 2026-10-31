# Setup before each build step

These are the accounts and keys the user sets up themselves. Every service must be free and need no credit card; the one exception is flagged below. Keys go in `.env` at the project root (gitignored), and the user fills in the values; they never go in chat or commits.

## Before step 1–2: the pump.fun data pipeline

- [ ] **Commit the current work,** including `CLAUDE.md` and `frontend/src/data/` (it was never tracked until the `.gitignore` fix on Oct 31).
- [ ] **BigQuery sandbox:** create a Google Cloud project with the sandbox. It needs no card and no billing account. Note the project ID.
- [ ] **Google Cloud CLI:** install it and sign in once, so the pipeline can query as you without a key file:
  ```bash
  brew install --cask google-cloud-sdk
  ```
  ```bash
  gcloud auth application-default login
  ```
- [ ] **Helius:** get a free API key at dashboard.helius.dev. The dashboard free plan needs no card; the CLI signup asks for 1 USDC, so use the dashboard.
- [ ] **`.env`** at the project root:
  ```
  GOOGLE_CLOUD_PROJECT=your-project-id
  HELIUS_API_KEY=your-key
  ```
- [ ] **Open a new chat** in `~/Desktop/Trade-Receipts` and start it with:
  > Read CLAUDE.md, then SPEC.md section 7 and the build order in section 15, GLOSSARY.md and docs/adr. Start build steps 1–2: the pump.fun data pipeline. My BigQuery project and Helius key are in .env.

The agent then sets up the rest itself:
- uv and a Python project in `backend/`, plus a `.env.example`;
- a check of the BigQuery tables, their coverage of May–October 2026, and the query cost;
- the pump.fun and PumpSwap interface descriptions (IDLs);
- Helius's limits.

## Before step 4: training Glimmer

- [ ] **Modal:** the account already shows the hackathon credits without a card. Log in from the terminal:
  ```bash
  pip3 install modal
  ```
  ```bash
  modal token new
  ```
- [ ] **Hugging Face:** a free account, and a token if Meta asks you to accept Glimmer's license before downloading. Put it in `.env` as `HF_TOKEN`.
- [ ] **Fallback:** a Kaggle account (free GPUs; needs phone verification, no card) in case the Modal credits run short.

## Before step 6: the agent (Muse Spark, Voice Transcribe)

- [ ] **Meta Model API key** in `.env` as `MODEL_API_KEY`.
- [x] **Card on file:** yes, confirmed Oct 31. It's the one exception to the no-card rule: the Participant Guide requires a card before any API call works. **Going over the $150 charges this card, and that must never happen.**
  - Meta has **no hard cap**; its "spend limit" only sends an email.
  - The credits are valid for a **10-day window**, and any call after that is charged.
  - The app enforces the budget itself (`SPEC.md` section 12): a guarded client that refuses calls past a $100 ledger, `META_API_ENABLED` off by default, and no Meta API calls after the window.
- [ ] **Credit expiry:** check the exact end date on the Billing page and note it here: ______
- [ ] **Email alerts** on the Billing page at $50 and $100, as a backstop only.
- [ ] **Usage checks:** look at usage on the Billing page each day you build.

# Data source research (Oct 30, 2026)

Findings from background research while grilling the spec. Items marked unconfirmed need a check before relying on them. Decisions based on this go into SPEC.md once the grilling round is done.

## US stock prices

**Only free, licensed route found that covers 2010–today including delisted stocks:** Tiingo, with each user entering their own free key (Tiingo developer program: register the app, credit Tiingo, never handle users' Tiingo passwords).

- Delisted names confirmed in Tiingo's ticker list (YHOO, CELG, TWTR, BBBYQ). Actual history pulls for them are unconfirmed.
- Free tier limits: 50 requests/hour, 1,000/day, **500 unique symbols/month**. The S&P 500 has had more than 500 members since 2010, so a full-index backtest doesn't fit one free key in one month.
- Free tier alone is "internal use only." Public display needs written permission (email Tiingo with academic affiliation).
- Ruled out for a public app: Alpaca (written consent needed, "U.S. residents only"), Massive/Polygon individual plans, EODHD, FMP, Alpha Vantage, Stooq (personal use), Yahoo/yfinance (automated collection banned), WRDS/CRSP via TMU (academic research only), Kaggle snapshots (end 2017–2020, no delisted names).
- Possible extras: QuantConnect allows exporting summary results of your own backtests (pre-run only, not our engine). Ken French data library has survivorship-free industry and factor portfolio returns (no stated license).
- S&P 500 historical membership: `github.com/fja05680/sp500`, MIT license, 1996 onward; post-2019 changes may be incomplete.
- SEC EDGAR fundamentals: free and official.

Sources: tiingo.com/documentation/appendix/developers · tiingo.com/documentation/general · tiingo.com/about/pricing · apimedia.tiingo.com/docs/tiingo/daily/supported_tickers.zip · quantconnect.com/terms · files.alpaca.markets/disclosures/library/TermsAndConditions.pdf · stooq.com/terms.html · wrds-www.wharton.upenn.edu/users/tou · github.com/fja05680/sp500

## Crypto: APIs

| Need | Source | Notes |
|---|---|---|
| Token permissions, holders, LP lock | GoPlus | Works without a key; free tier about 30 calls/min. Requires "Powered by GoPlus" credit. EVM and Solana fields cover everything in SPEC 7.3 |
| EVM logs and forking | Ankr free (getLogs 3,000 blocks; 1,000 on BNB), Alchemy free (getLogs 10 blocks) | Both have archive data; anvil forking works with archive endpoints |
| Solana history | Helius free: 1M credits/month, archival included | getSignaturesForAddress and getTransaction 1 credit each |
| Major coin candles | ~~Coinbase Exchange public candles~~ **Ruled out** | Coinbase Market Data Terms (updated Aug 7, 2026): personal or research use only; "may not be used to build an application intended for use by end users"; no displaying derived charts or analytics to third parties; no use for training AI/ML models. Source: coinbase.com/legal/market_data |
| Intraday crypto archive | Binance Vision | CC BY-NC-SA 4.0: non-commercial, credit required. Research and evals only |
| Avoid | Etherscan | Terms count any app offered to others as commercial ($299/mo). Free tier excludes Base and BNB |

## Crypto: training data for the rug-risk model

**Bulk data for free**

- **BigQuery public datasets** (1 TiB of queries/month free; sandbox needs no card): Ethereum (`token_transfers`, `logs`, `decoded_events`, `traces`), Solana (`crypto_solana_mainnet_us`, community-supported, has had multi-day stalls), Base (`base-data-pdp.base_mainnet`). **No BNB dataset.** Querying one program's day of Solana instructions costs about $0.02 of quota.
- **Coinbase CDP SQL API:** Base and Solana; 1,000 queries/month free, 50k rows each; Solana history about 3 months.
- **Helius:** enough for top-holder funding traces. A graduated pump.fun token's first 30 days can cost 10k–100k+ credits (estimate), so not for bulk pulls.
- Not usable: Dune (free plan is now view-only), Flipside (shut down), Bitquery (personal use only), GoldRush (no permanent free tier).

**Launchpad mechanics (changes the checklist's emphasis)**

On the major launchpads, the creator usually **can't** pull liquidity. The rug is insiders, the dev, or bundled wallets selling into buyers.

| Launchpad | Liquidity after launch |
|---|---|
| pump.fun (Solana) | Bonding curve, then a canonical PumpSwap pool with LP burned. Non-canonical pools made by the creator can be withdrawn |
| Raydium LaunchLab / bonk.fun | LP burned or locked |
| four.meme (BNB) | PancakeSwap; LP burn announced in 2025 (unconfirmed in effect) |
| Clanker (Base) | Locked in an LP locker with no withdraw function |
| Zora (Base) | Hook locks liquidity (unconfirmed) |
| Plain Uniswap pairs (mostly Ethereum) | Deployer holds LP: the classic pull is possible |

Program IDs: pump.fun `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, PumpSwap `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`.

**Labeled datasets**

| Dataset | Chain | Size | License | Use |
|---|---|---|---|---|
| SolRPDS | Solana | 62,895 pools, 22,195 rug-pattern tokens (2021–Oct 2024) | CC BY 4.0 | Reference and label design |
| MELT | Solana (pump.fun to Raydium) | 41,470 launches, 122 features (Dec 2024–Mar 2025) | CC BY-NC 4.0 | Label definitions; non-commercial only |
| CRPWarner, Trapdoor | Ethereum | small / 30k tokens | No license | Avoid |

No Base or recent BNB rug dataset was found.

**Suggested path:** Solana from BigQuery (pump.fun instructions over sampled days, about 5k tokens), Ethereum from BigQuery (Uniswap pair events, LP pulls labelable directly), Base from the CDP SQL API or BigQuery, Helius only for funding traces. BNB is the weak spot: free RPC logs only, or move it later. Compute our own outcome labels, modeled on MELT and SolRPDS definitions.

Sources: docs.cloud.google.com/blockchain-analytics/docs/supported-datasets · docs.cloud.google.com/bigquery/docs/sandbox · docs.cdp.coinbase.com/data/sql-api/welcome.md · helius.dev/docs/billing/credits.md · github.com/pump-fun/pump-public-docs · docs.raydium.io/user-flows/burn-and-earn · clanker.gitbook.io/documentation/references/deployed-contracts · docs.zora.co/coins · github.com/DeFiLabX/SolRPDS · github.com/git-disl/MELT · docs.gopluslabs.io/reference/response-details · ankr.com/docs/rpc-service/service-plans · github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md · etherscan.io/apiterms

## Pine Script tooling and competitors

**Competitors that already write Pine with AI and fix errors**

| Product | What it does | Price |
|---|---|---|
| TradingView AI Copilot (launched Sept–Oct 2026) | Writes indicators and strategies inside TradingView, reads compile errors and fixes them, explains backtests | Paid add-on |
| LuxAlgo Quant | Writes Pine, repairs runtime errors, backtests on LuxAlgo's charts (reportedly via PineTS) | Plans from free to $119.99/mo |
| Pineify | "Error-free Pine Script" via its own syntax validation; TradingView is the final check | One-time $99–259 |
| QuantPad (quantpad.ai) | Projects / Quant Copilot / Social; cloud backtests with bundled data; runs Pine through its AGPL `pine-runner` (wraps PineTS) | Reportedly $59.99–169.99/mo |

None publishes a measured compile rate. "AI writes Pine that compiles" is now table stakes.

**Running and linting Pine outside TradingView** (accuracy numbers are self-reported)

| Tool | License | Notes |
|---|---|---|
| PineTS / pinets-cli | AGPL-3.0 (commercial license available) | TypeScript; v6 experimental; strategy.* covered; own docs: 12 of 31 TradingView strategy scripts match exactly |
| Resin | Apache-2.0 | TypeScript; v5/v6; commission, slippage, pyramiding; claims 19/19 TradingView strategy scenarios; very new (Aug 2026, 11 stars) |
| PyneCore | Apache-2.0 runtime | Excellent parity, but compiling Pine into it needs PyneComp, a paid SaaS with no free tier |
| PineForge | Engine Apache-2.0; code generator source-available | C++; v6 |
| pine-tools / pine-lint | MIT | v6 linter (CLI, language server, MCP). Its `--tv` flag uses an undocumented TradingView endpoint: avoid |
| pinescript-v6-validator | MIT | Rule-based checks, including reading the still-forming bar |

TradingView has **no public API** to compile, validate, or upload Pine. Its terms ban feeding TradingView data into outside tools for algorithmic use.

**Lint rules from TradingView's own docs:** `request.security` with `lookahead_on` and no `[1]` offset (future leak); higher-timeframe requests without offset or `barstate.isconfirmed` (repaints); `calc_on_every_tick`; `calc_on_order_fills`; `process_orders_on_close`; missing commission, zero slippage, zero margin; strategies on Heikin Ashi charts; `varip`, `timenow`, and most `barstate.*` (repaint); v6 traps models make (removed `when=` and `transp`, bool can't be `na`).

Sources: quantpad.ai · github.com/QuantPad/pine-runner · tradingview.com/support/solutions/43000795135 · luxalgo.com/features/quant · pineify.app · github.com/LuxAlgo/PineTS · docs.luxalgo.com/developers/pinets/api-coverage/strategy · github.com/nullarch/resin · github.com/PyneSys/pynecore · pynesys.io · github.com/folknor/pine-tools · tradingview.com/policies · tradingview.com/pine-script-docs/concepts/repainting · tradingview.com/pine-script-docs/concepts/strategies · tradingview.com/pine-script-docs/migration-guides/to-pine-version-6

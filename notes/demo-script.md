# Demo video script (3:00)

About 440 words of voiceover, at a calm pace. **Screen** is what to show and **Say** is the voiceover. Every number below comes from `SPEC.md` 7.7–7.10, `frontend/src/data/model.ts`, or the saved runs.

---

## 0:00–0:15 · The hook

**Screen:** the Raylight promo's opener ("Rugs are predictable, and avoidable"), then the home page.

**Say:** "On pump.fun, most new tokens rug. In our data, about nine in ten tokens with real activity rugged within a day, usually in the first minutes. A rug leaves a pattern on chain. Trade Receipts reads it before you buy."

## 0:15–0:30 · What it is

**Screen:** Launch IDE. Click through the first steps of the tour: the two modes and the examples folder.

**Say:** "Trade Receipts is an IDE for crypto research, built during this hackathon. Analyze checks a pump.fun token for a rug. Copy trade backtests what you'd make copying a wallet a few minutes late."

## 0:30–1:15 · A live rug check

**Screen:** paste a pump.fun link into the chat.
- Point out "Thinking…", then each step as it runs: transactions read, wallets traced, funders traced.
- Open Chart, then Holders: the bubble map with the team in blue.
- Open Signals, then the rug chance and the numbers check.
- End on BABYBULL: 86%, "Rugged 31 minutes later."

**Say:**
- "I paste a token. Muse Spark, Meta's model, runs the agent. It decides which tools to call and shows every step."
- "It reads every trade since launch, traces who funded each wallet, and splits the team from snipers, bots and real buyers. Here's the real chart, and the bubble map: wallets tied by funding cluster together, and the team is blue."
- "Eighty-one signals go into a rug chance. Spark explains it in plain English, and every number it writes is checked against the data before you see it."
- "This one, checked fifteen minutes after launch, scored 86%. It rugged thirty-one minutes later."

## 1:15–2:05 · How we built the model

**Screen:** the receipt or model numbers. Briefly show `backend/receipts/crypto/` and the Kaggle job.

**Say:**
- "There was no rug dataset we could use, so we built one."
- "We pulled 41,956 pump.fun launches from Google BigQuery's free public Solana dataset and decoded them with pump.fun's public program interface."
- "We wrote our own labels from raw chain data. A rug is the team selling at least half its peak holdings while the price falls 90%. Snipers dumping isn't a rug; only the team can rug."
- "Each token is rebuilt at 1, 5 and 15 minutes, up to 6 hours, using only what had happened by then. A leakage test proves no signal reads the future."
- "We split by date: train on May 11 to 14, tune on the 15th, test on the 16th, then check again in August and September."
- "The training days hold 7,849 tokens and 20,848 snapshots."
- "Then we trained Muse Glimmer, Meta's open-weight model, on Kaggle's free GPUs, with 4-bit weights and LoRA. It was fine-tuned on 900 of those snapshots, with answers taught by our tree model. That took it from 0.62 to 0.74 fair AUC on the test day. We also tried reinforcement learning with GRPO. It pushed answers to 1% or 99% and scored worse, so we show that instead of hiding it."
- "Today the live score comes from gradient-boosted trees on the same signals, at 0.71 across every test snapshot. A typical checklist of red flags scores 0.44, worse than a coin flip. Glimmer gives a second opinion."
- "Live checks fetch from Helius and run the exact same code that built the training data."

## 2:05–2:40 · Copy trade

**Screen:** switch to Copy trade (a new tab, chat closed).
- Paste a pump.fun wallet, pick 5 minutes after they buy and 10 after they sell, and run it.
- Show the result, scroll the positions, open one chart.
- Click "Ask about this result" and ask "Why did I lose when they won?"

**Say:**
- "Copy trade answers a different question: what if I copied this trader? I paste a wallet and say how late I'd buy and sell."
- "This wallet from pump.fun's leaderboard made 43% across 50 positions. Copying it just five minutes late lost 3.6%. The chart shows why: the price runs before you get in."
- "I can ask about the result, and the agent answers from the data it already pulled."

## 2:40–3:00 · Close

**Screen:** "Don't get rugged.", then the logo, the waitlist and tradereceipts.io.

**Say:** "Muse Spark runs the agent and writes the explanations. Muse Glimmer is trained on real outcomes. Every number is checked against the chain. Trade Receipts gives you facts and flags, never advice. Don't get rugged. Join the waitlist."

---

### Before recording

- Have the backend running so the live check and the backtest work. Use a token about 15 minutes old so the check is quick, or replay BABYBULL from the examples folder.
- Live checks take one to four minutes, so cut the wait in editing, and say so on screen if you speed it up.
- Don't say "safe", and don't name other products.

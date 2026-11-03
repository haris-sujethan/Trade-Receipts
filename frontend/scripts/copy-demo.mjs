// Copies the backend's saved demo runs into public/demo/ so the static site can replay them without a backend:
// rug checks (<mint>_900.json) into index.json, copy-trade backtests (kind "copy_trade") into copy-index.json.
// The runs are derived chain data: public/demo/ is gitignored, like data/.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const runs = join(root, "data", "demo");
const clips = join(root, "data", "test-clips");
const out = join(root, "frontend", "public", "demo");
const order = join(root, "backend", "receipts", "agent", "demo.py");

if (!existsSync(runs)) {
  console.warn("copy-demo: no data/demo/ here, so the home demo will show its empty state");
  process.exit(0);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const index = [];
const copies = [];
for (const file of readdirSync(runs).filter((f) => f.endsWith(".json")).sort()) {
  const run = JSON.parse(readFileSync(join(runs, file), "utf8"));
  const id = file.replace(/\.json$/, "");
  writeFileSync(join(out, `${id}.json`), JSON.stringify(run));
  if (run.kind === "copy_trade") {
    const r = run.events.find((e) => e.type === "answer")?.copy_trade;
    copies.push({
      id,
      wallet: run.wallet,
      message: run.message,
      saved_at: run.saved_at,
      buy_after_s: r?.buy_after_s ?? null,
      sell_after_s: r?.sell_after_s ?? null,
      size_sol: r?.size_sol ?? null,
      positions: r?.positions ?? null,
    });
    continue;
  }
  const check = run.events.find((e) => e.type === "answer")?.check ?? {};
  index.push({
    id,
    mint: run.mint,
    age_s: run.age_s,
    about: run.about,
    symbol: check.symbol ?? null,
    verdict: check.verdict ?? null,
    rug_chance: check.trees_rug_chance ?? null,
    clip: run.clip ?? null,
  });
  if (run.clip && existsSync(join(clips, run.clip))) copyFileSync(join(clips, run.clip), join(out, run.clip));
}
// Same order as the backend's demo list (TOKENS in backend/receipts/agent/demo.py, the hero first); any run it
// doesn't name follows, highest rug chance first.
const tokens = existsSync(order) ? (readFileSync(order, "utf8").match(/^TOKENS = \[[\s\S]*?^\]/m)?.[0] ?? "") : "";
const listed = [...tokens.matchAll(/\(\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"/g)].map((m) => m[1]);
const rank = (mint) => (listed.includes(mint) ? listed.indexOf(mint) : listed.length);
index.sort((a, b) => rank(a.mint) - rank(b.mint) || (b.rug_chance ?? 0) - (a.rug_chance ?? 0));
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 1));
writeFileSync(join(out, "copy-index.json"), JSON.stringify(copies, null, 1));
console.log(`copy-demo: ${index.length} checks and ${copies.length} copy-trade backtests into public/demo/`);

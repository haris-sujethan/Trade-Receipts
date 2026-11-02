// Copies the backend's saved demo runs into public/demo/ so the static site can replay them without a backend.
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
for (const file of readdirSync(runs).filter((f) => f.endsWith(".json")).sort()) {
  const run = JSON.parse(readFileSync(join(runs, file), "utf8"));
  const id = file.replace(/\.json$/, "");
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
  writeFileSync(join(out, `${id}.json`), JSON.stringify(run));
  if (run.clip && existsSync(join(clips, run.clip))) copyFileSync(join(clips, run.clip), join(out, run.clip));
}
// Same order as the backend's demo list (TOKENS in backend/receipts/agent/demo.py, the hero first); any run it
// doesn't name follows, highest rug chance first.
const listed = existsSync(order) ? [...readFileSync(order, "utf8").matchAll(/\(\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"/g)].map((m) => m[1]) : [];
const rank = (mint) => (listed.includes(mint) ? listed.indexOf(mint) : listed.length);
index.sort((a, b) => rank(a.mint) - rank(b.mint) || (b.rug_chance ?? 0) - (a.rug_chance ?? 0));
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 1));
console.log(`copy-demo: ${index.length} runs into public/demo/`);

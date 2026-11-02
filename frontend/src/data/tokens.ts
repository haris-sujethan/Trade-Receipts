// Example rug checks for the preview. MOON and KITE are made-up tokens; every value here is an example,
// generated from a fixed seed so the page looks the same on every load. No model has scored them.

import type { Facts } from "./examples";

/* ---------- Who traded ---------- */

export type Group = "team" | "likelyTeam" | "sniper" | "bot" | "fresh" | "independent";

/** Stack order for the real chart, suspicious groups first, independent buyers last. */
export const GROUPS: Group[] = ["team", "likelyTeam", "sniper", "bot", "fresh", "independent"];

export const GROUP_LABEL: Record<Group, string> = {
  team: "Team",
  likelyTeam: "Likely team",
  sniper: "Snipers",
  bot: "Bots and wash trades",
  fresh: "Fresh wallets",
  independent: "Independent buyers",
};

// The wallet palette, in this order everywhere (styles/tokens.css mirrors it as --g-*). The team is Meta blue.
// Validated with the dataviz palette checks on #fcfcfb: CVD worst adjacent 9.1, normal-vision worst 17.0; the
// grey fails the chroma floor by design. Snipers, fresh wallets and the grey sit under 3:1, so charts carry a legend.
// Independent buyers are deliberately neutral: color marks the wallets worth worrying about.
export const GROUP_COLOR: Record<Group, string> = {
  team: "#0081fb",
  likelyTeam: "#c03fa8",
  sniper: "#1baf7a",
  bot: "#d9502e",
  fresh: "#eda100",
  independent: "#a9a9ae",
};

/** The bubble map is a scatter, so only three groups get color (they pass every pair); the rest are grey. */
export const MAP_COLORED: Group[] = ["team", "likelyTeam", "sniper"];

/* ---------- Shapes ---------- */

export type Candle = { o: number; h: number; l: number; c: number };

export type Wallet = {
  id: string;
  x: number;
  y: number;
  /** Percent of supply. */
  share: number;
  group: Group;
  /** Wallet under a day old. */
  fresh?: boolean;
  role?: "creator" | "funder";
};

export type Link = { a: string; b: string; kind: "team" | "likely" };

export type SignalStatus = "red" | "caution" | "pass" | "unknown";

export type Signal = { family: string; name: string; value: string; status: SignalStatus };

export type Claim = { claim: string; at: string; chain: string; verdict: "Contradicted" | "Can't check" | "Supported" };

export type SimilarToken = { name: string; similarity: string; outcome: string };

export type Verdict = "Likely rug" | "Possible rug" | "Unlikely rug";

export type TokenCheck = {
  id: "moon" | "kite";
  name: string;
  ticker: string;
  mint: string;
  /** Short form, as on screen. */
  mintShort: string;
  /** How old the token was when it was checked. */
  age: string;
  stage: "Bonding curve" | "Graduated";
  checkedFrom: string;
  verdict: Verdict;
  /** Percent. */
  rugChance: number;
  explanation: string[];
  /** The model's own terse reasoning, shown under "How the model saw it". */
  modelView: string;
  candleSeconds: number;
  candles: Candle[];
  volume: Record<Group, number[]>;
  /** Candle index and size of each team sell. */
  teamSells: { i: number; sol: number }[];
  independentShare: string;
  teamCanSellInto: string;
  wallets: Wallet[];
  links: Link[];
  notes: { x: number; y: number; text: string }[];
  signals: Signal[];
  claims?: Claim[];
  similar: SimilarToken[];
  facts: Facts;
};

/* ---------- Generators ---------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function address(r: () => number) {
  const pick = () => B58[Math.floor(r() * B58.length)];
  return `${pick()}${pick()}${pick()}${pick()}…${pick()}${pick()}${pick()}`;
}

/** Candles from a list of closes, with wicks. */
function candlesFrom(closes: number[], open: number, r: () => number): Candle[] {
  let prev = open;
  return closes.map((c) => {
    const o = prev;
    const h = Math.max(o, c) * (1 + r() * 0.04);
    const l = Math.min(o, c) * (1 - r() * 0.04);
    prev = c;
    return { o: round(o), h: round(h), l: round(l), c: round(c) };
  });
}

function round(v: number, d = 1) {
  const k = 10 ** d;
  return Math.round(v * k) / k;
}

function ring(cx: number, cy: number, radius: number, n: number, turn = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });
}

function scatter(r: () => number, n: number, box: [number, number, number, number]) {
  const [x0, x1, y0, y1] = box;
  return Array.from({ length: n }, () => ({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0) }));
}

/* ---------- MOON: a likely rug, checked from a shill clip ---------- */

function buildMoon(): TokenCheck {
  const r = rng(707);
  const N = 30;
  // Market cap in $K. The bundle opens it high, then a slow, mostly green climb; the team sells into buys late on.
  const sells = new Set([18, 20, 22, 24, 25, 27, 29]);
  const closes: number[] = [];
  let cap = 38;
  for (let i = 0; i < N; i++) {
    if (i === 0) cap = 38;
    else if (sells.has(i)) cap *= 0.955 + r() * 0.02;
    else cap *= 1.055 + r() * 0.04;
    closes.push(cap);
  }
  const candles = candlesFrom(closes, 5, r);
  const green = candles.filter((k) => k.c > k.o).length;

  const volume = {} as Record<Group, number[]>;
  for (const g of GROUPS) volume[g] = Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    volume.team[i] = i === 0 ? 42 : i === 1 ? 4 : sells.has(i) ? 3.5 + r() * 2.5 : r() * 0.6;
    volume.likelyTeam[i] = i >= 2 && i <= 8 ? 3 : r() * 0.4;
    volume.sniper[i] = i === 0 ? 6 : i === 1 ? 4 : i === 2 ? 1.2 : r() * 0.3;
    volume.bot[i] = 1.4 + r() * 1.2;
    volume.fresh[i] = 0.8 + r() * 1.8;
    volume.independent[i] = i < 8 ? r() * 0.3 : 0.3 + r() * (i / N) * 1.6;
  }
  for (const g of GROUPS) volume[g] = volume[g].map((v) => round(v, 2));

  // The bubble map: one funder with a spider of team wallets, the creator's bundle, a likely-team ring.
  const wallets: Wallet[] = [];
  const links: Link[] = [];
  const funder = { x: -0.62, y: 0.18 };
  wallets.push({ id: "Fund…r8Q", ...funder, share: 0.6, group: "team", role: "funder" });
  wallets.push({ id: "Crea…7xK", x: -0.12, y: 0.02, share: 1.1, group: "team", role: "creator", fresh: true });
  links.push({ a: "Fund…r8Q", b: "Crea…7xK", kind: "team" });
  ring(funder.x, funder.y, 0.3, 13, 0.3).forEach((p, i) => {
    const id = address(r);
    wallets.push({ id, ...p, share: round(1.05 + r() * 0.25, 2), group: "team", fresh: i % 3 !== 0 });
    links.push({ a: "Fund…r8Q", b: id, kind: "team" });
  });
  ring(-0.12, 0.02, 0.15, 5, 1.1).forEach((p) => {
    const id = address(r);
    wallets.push({ id, ...p, share: round(1.3 + r() * 0.2, 2), group: "team", fresh: true });
    links.push({ a: "Crea…7xK", b: id, kind: "team" });
  });
  const likely = ring(0.48, 0.48, 0.14, 6, 0.4).map((p) => {
    const id = address(r);
    wallets.push({ id, ...p, share: 1.5, group: "likelyTeam", fresh: true });
    return id;
  });
  likely.forEach((id, i) => links.push({ a: id, b: likely[(i + 1) % likely.length], kind: "likely" }));
  scatter(r, 5, [0.35, 0.8, -0.6, -0.2]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: round(1 + r() * 0.4, 2), group: "sniper" }),
  );
  scatter(r, 4, [-0.1, 0.25, -0.7, -0.45]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: 0.5, group: "bot" }),
  );
  scatter(r, 10, [-0.95, 0.95, -0.95, -0.55]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: round(0.4 + r() * 0.2, 2), group: "fresh", fresh: true }),
  );
  scatter(r, 19, [0.05, 0.98, -0.15, 0.95]).forEach((p) => {
    if (Math.hypot(p.x - 0.48, p.y - 0.48) < 0.24) p.x -= 0.3;
    wallets.push({ id: address(r), ...p, share: round(0.15 + r() * 0.6, 2), group: "independent" });
  });

  return {
    id: "moon",
    name: "MOON",
    ticker: "MOON",
    mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    mintShort: "7xKX…gAsU",
    age: "15 minutes",
    stage: "Bonding curve",
    checkedFrom: "a shill clip, moon_shill.mp4",
    verdict: "Likely rug",
    rugChance: 87,
    explanation: [
      "MOON looks busy, but most of the buying comes from the people who launched it. Two groups of wallets tied to the creator hold 23% of the supply, and 31% was bought in the same instant the token launched.",
      "38 of the first 52 buys were exactly 0.5 SOL: one person spreading money across many wallets. Independent buyers made only 11% of the buying, and the team has already sold seven times, each within seconds of a new buyer arriving.",
      "Tokens that looked like this 15 minutes after launch usually rugged within hours.",
    ],
    modelView:
      "Bundle in the creation slot: 31% of supply. Cluster A (14 wallets, one funder): 16%. Cluster B (5 wallets in the creator's bundle): 7%. Likely team (6 wallets, same exchange, 1.5 SOL each): 9%, identical balances. 38 of 52 early buys at 0.5 SOL. Team sold 7 times within 5 s of a buy. Independent buy volume 11%. Fees 0.004 SOL per $1k volume, flat while market cap rose 5x. Matches pre-rug launches. P(rug) = 0.87.",
    candleSeconds: 30,
    candles,
    volume,
    teamSells: [...sells].map((i) => ({ i, sol: volume.team[i] })),
    independentShare: "11%",
    teamCanSellInto: "$41K",
    wallets,
    links,
    notes: [
      { x: -0.55, y: 0.6, text: "Team A · 16%" },
      { x: -0.12, y: -0.26, text: "Team B · 7%" },
      { x: 0.48, y: 0.72, text: "Likely team · 9%" },
    ],
    signals: [
      { family: "Launch", name: "Bought in the launch instant", value: "31% of supply", status: "red" },
      { family: "Launch", name: "Identical early buys", value: "38 of 52 at 0.5 SOL", status: "red" },
      { family: "Launch", name: "Snipers", value: "6% of supply", status: "caution" },
      { family: "Supply", name: "Team supply", value: "23% in 2 clusters", status: "red" },
      { family: "Supply", name: "Likely team", value: "9% in 6 wallets", status: "red" },
      { family: "Supply", name: "Identical balances", value: "6 holders at 1.50%", status: "red" },
      { family: "Wallets", name: "Fresh wallets", value: "61% of holders under a day old", status: "red" },
      { family: "Wallets", name: "Independent buyers", value: "19 of 212 holders", status: "red" },
      { family: "Trading", name: "Team selling into buys", value: "7 sells within 5 s of a buy", status: "red" },
      { family: "Trading", name: "Wash trading", value: "4 wallets made 31% of trades", status: "caution" },
      { family: "Chart", name: "Green candles", value: `${green} of ${N}`, status: "caution" },
      { family: "Fees", name: "Fees paid", value: "0.004 SOL per $1k of volume", status: "red" },
      { family: "Creator", name: "Creator history", value: "11 earlier tokens, 9 rugged", status: "red" },
      { family: "Creator", name: "Creator funding", value: "Fresh wallet, funded 4 min before launch", status: "caution" },
      { family: "Permissions", name: "Mint and freeze", value: "Both revoked", status: "pass" },
      { family: "Exit", name: "Team moving funds to exchanges", value: "None yet", status: "pass" },
    ],
    claims: [
      { claim: "“Community token, no team”", at: "0:12", chain: "Team holds 23% across 19 wallets", verdict: "Contradicted" },
      { claim: "“Dev is doxxed”", at: "0:27", chain: "Creator wallet is 4 minutes old; no public identity found", verdict: "Can't check" },
      { claim: "“This can't rug”", at: "0:40", chain: "The team could sell into $41K of buyers right now", verdict: "Contradicted" },
    ],
    similar: [
      { name: "ZORBO", similarity: "93%", outcome: "Rugged 38 minutes after launch" },
      { name: "PLINK", similarity: "91%", outcome: "Rugged 2 hours after launch" },
      { name: "MUNCH", similarity: "89%", outcome: "Rugged 1 hour after launch" },
      { name: "TIKI", similarity: "88%", outcome: "Faded within 6 hours" },
      { name: "QUOLL", similarity: "86%", outcome: "Rugged 5 hours after launch" },
    ],
    facts: {
      subject: "MOON · pump.fun · made-up example",
      serving: "Checked 15 minutes after launch · example values",
      claimed: { label: "Team supply, as pitched", value: "“None”" },
      tested: { label: "Team supply, on-chain", value: "23%", tone: "bad" },
      rows: [
        { label: "Rug chance", value: "87%", tone: "bad" },
        { label: "Verdict", value: "Likely rug", tone: "bad", rule: "mid" },
        { label: "Bought in the launch instant", value: "31%", tone: "bad" },
        { label: "Identical 0.5 SOL buys", value: "38 of 52", tone: "bad" },
        { label: "Independent buyers", value: "19 of 212", tone: "bad" },
        { label: "Team sells into buys", value: "7", tone: "bad" },
        { label: "Fees per $1k volume", value: "0.004 SOL" },
        { label: "Mint and freeze", value: "Revoked", rule: "mid" },
      ],
      footnote: "Example values for a made-up token. The live score comes from a model trained on thousands of past pump.fun tokens. Not financial advice.",
    },
  };
}

/* ---------- KITE: an unlikely rug, checked from its mint ---------- */

function buildKite(): TokenCheck {
  const r = rng(4242);
  const N = 30;
  const closes: number[] = [];
  let cap = 9;
  for (let i = 0; i < N; i++) {
    cap *= i % 3 === 2 ? 0.93 + r() * 0.05 : 1.04 + r() * 0.07;
    closes.push(cap);
  }
  const candles = candlesFrom(closes, 6, r);
  const green = candles.filter((k) => k.c > k.o).length;

  const volume = {} as Record<Group, number[]>;
  for (const g of GROUPS) volume[g] = Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    volume.team[i] = i === 0 ? 1.2 : 0;
    volume.likelyTeam[i] = 0;
    volume.sniper[i] = i === 0 ? 2.2 : i === 1 ? 1 : 0;
    volume.bot[i] = 0.2 + r() * 0.5;
    volume.fresh[i] = 0.4 + r() * 0.8;
    volume.independent[i] = 1.5 + r() * 3.5 + i * 0.08;
  }
  for (const g of GROUPS) volume[g] = volume[g].map((v) => round(v, 2));

  const wallets: Wallet[] = [];
  const links: Link[] = [];
  wallets.push({ id: "Crea…4nP", x: -0.4, y: 0.3, share: 3, group: "team", role: "creator" });
  scatter(r, 3, [0.4, 0.85, -0.6, -0.25]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: round(0.6 + r() * 0.4, 2), group: "sniper" }),
  );
  scatter(r, 3, [-0.2, 0.2, -0.75, -0.5]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: 0.4, group: "bot" }),
  );
  scatter(r, 9, [-0.95, 0.95, -0.95, -0.6]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: round(0.3 + r() * 0.4, 2), group: "fresh", fresh: true }),
  );
  scatter(r, 50, [-0.95, 0.95, -0.5, 0.95]).forEach((p) =>
    wallets.push({ id: address(r), ...p, share: round(0.2 + r() * 1.7, 2), group: "independent" }),
  );

  return {
    id: "kite",
    name: "KITE",
    ticker: "KITE",
    mint: "4nPqv7MnZ1tH6s2yWcR9dQe8LbJx3uKfA5GmTo2kT2e",
    mintShort: "4nPq…kT2e",
    age: "1 hour",
    stage: "Graduated",
    checkedFrom: "its mint, pasted",
    verdict: "Unlikely rug",
    rugChance: 14,
    explanation: [
      "KITE's buyers look like separate people. No group of linked wallets holds more than 2%, balances vary, and most buyers have their own trading history.",
      "The creator holds 3% and hasn't sold. Independent buyers made 71% of the buying, and fees grew along with the market cap, as they do when real traders pile in.",
      "Unlikely rug doesn't mean safe. Most new tokens still lose value, and a team can change course later.",
    ],
    modelView:
      "No cluster above 2%. Creator 3%, no sells. Balances varied. Independent buy volume 71%. Fees 1.9 SOL per $1k volume, rising with market cap. Snipers 2%, exited at 4 min. Matches launches that faded or survived. P(rug) = 0.14.",
    candleSeconds: 120,
    candles,
    volume,
    teamSells: [],
    independentShare: "71%",
    teamCanSellInto: "$3K",
    wallets,
    links,
    notes: [{ x: -0.4, y: 0.5, text: "Creator · 3%" }],
    signals: [
      { family: "Launch", name: "Bought in the launch instant", value: "4% of supply", status: "pass" },
      { family: "Launch", name: "Identical early buys", value: "3 of 61", status: "pass" },
      { family: "Launch", name: "Snipers", value: "2% of supply, sold by minute 4", status: "caution" },
      { family: "Supply", name: "Team supply", value: "3%, the creator alone", status: "pass" },
      { family: "Supply", name: "Identical balances", value: "None", status: "pass" },
      { family: "Wallets", name: "Fresh wallets", value: "14% of holders under a day old", status: "pass" },
      { family: "Wallets", name: "Independent buyers", value: "148 of 166 holders", status: "pass" },
      { family: "Trading", name: "Team selling into buys", value: "None", status: "pass" },
      { family: "Trading", name: "Wash trading", value: "3 wallets made 6% of trades", status: "pass" },
      { family: "Chart", name: "Green candles", value: `${green} of ${N}`, status: "pass" },
      { family: "Fees", name: "Fees paid", value: "1.9 SOL per $1k of volume", status: "pass" },
      { family: "Creator", name: "Creator history", value: "2 earlier tokens, both faded", status: "caution" },
      { family: "Creator", name: "Creator funding", value: "From an exchange, 3 days before launch", status: "pass" },
      { family: "Permissions", name: "Mint and freeze", value: "Both revoked", status: "pass" },
      { family: "Social", name: "Links in the token's profile", value: "No website or social links", status: "unknown" },
    ],
    similar: [
      { name: "BRAMBLE", similarity: "90%", outcome: "Survived the first week" },
      { name: "OTTERS", similarity: "88%", outcome: "Faded within 2 days" },
      { name: "LUMEN", similarity: "87%", outcome: "Survived the first week" },
      { name: "PIPIT", similarity: "85%", outcome: "Faded within a day" },
      { name: "WREN", similarity: "84%", outcome: "Rugged 3 days after launch" },
    ],
    facts: {
      subject: "KITE · pump.fun · made-up example",
      serving: "Checked 1 hour after launch · example values",
      tested: { label: "Rug chance", value: "14%" },
      rows: [
        { label: "Verdict", value: "Unlikely rug", tone: "strong", rule: "mid" },
        { label: "Team supply", value: "3%" },
        { label: "Bought in the launch instant", value: "4%" },
        { label: "Independent buyers", value: "148 of 166" },
        { label: "Team sells", value: "0" },
        { label: "Fees per $1k volume", value: "1.9 SOL" },
        { label: "Mint and freeze", value: "Revoked", rule: "mid" },
      ],
      footnote:
        "Example values for a made-up token. Unlikely rug isn't safe: most new tokens still lose value. Not financial advice.",
    },
  };
}

export const tokenChecks: Record<TokenCheck["id"], TokenCheck> = {
  moon: buildMoon(),
  kite: buildKite(),
};

/** The research file the agent writes, as text, for the replay's code view. */
export function tokenMarkdown(t: TokenCheck): string {
  return `# ${t.name} (pump.fun)

Example rug check. ${t.name} is a made-up token used to show the report.

Mint: ${t.mint}
Checked: ${t.age} after launch, from ${t.checkedFrom}
Stage: ${t.stage}

## Verdict

${t.verdict} · ${t.rugChance}% rug chance

${t.explanation.join("\n\n")}

## Signals

| Signal | Value | Status |
|---|---|---|
${t.signals.map((s) => `| ${s.name} | ${s.value} | ${statusWord[s.status]} |`).join("\n")}
${
  t.claims
    ? `
## Claims vs. chain

| Claim | Said at | On-chain | Verdict |
|---|---|---|---|
${t.claims.map((c) => `| ${c.claim} | ${c.at} | ${c.chain} | ${c.verdict} |`).join("\n")}
`
    : ""
}
## Similar past tokens

${t.similar.map((s) => `- ${s.name} (${s.similarity} similar): ${s.outcome}`).join("\n")}
`;
}

export const statusWord: Record<SignalStatus, string> = {
  red: "Red flag",
  caution: "Caution",
  pass: "Pass",
  unknown: "Can't check",
};

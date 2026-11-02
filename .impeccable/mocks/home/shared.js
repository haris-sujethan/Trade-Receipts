// Shared example data and renderers for the five glass direction mocks.
// MOON is the made-up token from frontend/src/data/tokens.ts, rebuilt with the same seed so every value matches the app.
(function () {
  const TR = (window.TR = {});

  /* ---------- Data (ported from tokens.ts, same generator) ---------- */

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const address = (r) => {
    const p = () => B58[Math.floor(r() * B58.length)];
    return `${p()}${p()}${p()}${p()}…${p()}${p()}${p()}`;
  };
  const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  function candlesFrom(closes, open, r) {
    let prev = open;
    return closes.map((c) => {
      const o = prev;
      const h = Math.max(o, c) * (1 + r() * 0.04);
      const l = Math.min(o, c) * (1 - r() * 0.04);
      prev = c;
      return { o: round(o), h: round(h), l: round(l), c: round(c) };
    });
  }
  const ring = (cx, cy, radius, n, turn = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = turn + (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    });
  const scatter = (r, n, [x0, x1, y0, y1]) =>
    Array.from({ length: n }, () => ({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0) }));

  const GROUPS = ["team", "likelyTeam", "sniper", "bot", "fresh", "independent"];
  const GROUP_LABEL = {
    team: "Team",
    likelyTeam: "Likely team",
    sniper: "Snipers",
    bot: "Bots and wash trades",
    fresh: "Fresh wallets",
    independent: "Independent buyers",
  };
  const MAP_COLORED = ["team", "likelyTeam", "sniper"];
  TR.GROUPS = GROUPS;
  TR.GROUP_LABEL = GROUP_LABEL;

  function buildMoon() {
    const r = rng(707);
    const N = 30;
    const sells = new Set([18, 20, 22, 24, 25, 27, 29]);
    const closes = [];
    let cap = 38;
    for (let i = 0; i < N; i++) {
      if (i === 0) cap = 38;
      else if (sells.has(i)) cap *= 0.955 + r() * 0.02;
      else cap *= 1.055 + r() * 0.04;
      closes.push(cap);
    }
    const candles = candlesFrom(closes, 5, r);
    const green = candles.filter((k) => k.c > k.o).length;
    const volume = {};
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

    const wallets = [];
    const links = [];
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
    scatter(r, 4, [-0.1, 0.25, -0.7, -0.45]).forEach((p) => wallets.push({ id: address(r), ...p, share: 0.5, group: "bot" }));
    scatter(r, 10, [-0.95, 0.95, -0.95, -0.55]).forEach((p) =>
      wallets.push({ id: address(r), ...p, share: round(0.4 + r() * 0.2, 2), group: "fresh", fresh: true }),
    );
    scatter(r, 19, [0.05, 0.98, -0.15, 0.95]).forEach((p) => {
      if (Math.hypot(p.x - 0.48, p.y - 0.48) < 0.24) p.x -= 0.3;
      wallets.push({ id: address(r), ...p, share: round(0.15 + r() * 0.6, 2), group: "independent" });
    });

    return {
      name: "MOON",
      mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      mintShort: "7xKX…gAsU",
      age: "15 minutes",
      stage: "Bonding curve",
      verdict: "Likely rug",
      rugChance: 87,
      explanation: [
        "MOON looks busy, but most of the buying comes from the people who launched it. Two groups of wallets tied to the creator hold 23% of the supply, and 31% was bought in the same instant the token launched.",
        "38 of the first 52 buys were exactly 0.5 SOL: one person spreading money across many wallets. Independent buyers made only 11% of the buying, and the team has already sold seven times, each within seconds of a new buyer arriving.",
        "Tokens that looked like this 15 minutes after launch usually rugged within hours.",
      ],
      modelView:
        "Bundle in the creation slot: 31% of supply. Cluster A (14 wallets, one funder): 16%. Cluster B (5 wallets in the creator's bundle): 7%. Likely team (6 wallets, same exchange, 1.5 SOL each): 9%, identical balances. 38 of 52 early buys at 0.5 SOL. Team sold 7 times within 5 s of a buy. Independent buy volume 11%. P(rug) = 0.87.",
      candleSeconds: 30,
      candles,
      volume,
      teamSells: [...sells],
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
        { claim: "“Dev is doxxed”", at: "0:27", chain: "Creator wallet is 4 minutes old", verdict: "Can't check" },
        { claim: "“This can't rug”", at: "0:40", chain: "Team could sell into $41K of buyers now", verdict: "Contradicted" },
      ],
      facts: {
        subject: "MOON · pump.fun · made-up example",
        serving: "Checked 15 minutes after launch · example values",
        claimed: { label: "Team supply, as pitched", value: "“None”" },
        tested: { label: "Team supply, on-chain", value: "23%" },
        rows: [
          { label: "Rug chance", value: "87%", bad: true },
          { label: "Verdict", value: "Likely rug", bad: true, rule: true },
          { label: "Bought in the launch instant", value: "31%", bad: true },
          { label: "Identical 0.5 SOL buys", value: "38 of 52", bad: true },
          { label: "Independent buyers", value: "19 of 212", bad: true },
          { label: "Team sells into buys", value: "7", bad: true },
          { label: "Fees per $1k volume", value: "0.004 SOL" },
          { label: "Mint and freeze", value: "Revoked", rule: true },
        ],
        footnote:
          "Example values for a made-up token. The live score comes from a model trained on thousands of past pump.fun tokens. Not financial advice.",
      },
    };
  }
  const T = (TR.moon = buildMoon());

  /* ---------- Icons (Lucide paths, 1.75 stroke) ---------- */

  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    red: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    caution: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    pass: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    unknown: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    split: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
    sidebar: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    thread: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    map: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="8" r="2"/><circle cx="9" cy="17" r="4"/><path d="m8.5 8.5 1 4"/><path d="m16.2 9.3-3.4 4.2"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17V9"/><path d="M13 17V5"/><path d="M18 17v-3"/>',
  };
  const icon = (name, size = 15, cls = "") =>
    `<svg class="tr-i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
  TR.icon = icon;

  const STATUS_WORD = { red: "Red flag", caution: "Caution", pass: "Pass", unknown: "Can't check" };
  TR.statusWord = STATUS_WORD;
  TR.counts = T.signals.reduce((m, s) => ((m[s.status] = (m[s.status] || 0) + 1), m), {});

  /* ---------- Real chart: market cap candles over volume split by who traded ---------- */

  function niceStep(span, target) {
    const raw = span / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  TR.realChart = function ({ w = 760, h = 360, labels = true } = {}) {
    const N = T.candles.length;
    const padL = 44, padR = 12, padT = labels ? 20 : 8, padB = 24, gap = labels ? 30 : 16;
    const plotW = w - padL - padR;
    const avail = h - padT - padB - gap;
    const pH = Math.round(avail * 0.6), vH = avail - pH;
    const pTop = padT, vTop = padT + pH + gap, vBot = vTop + vH;
    const band = plotW / N, bw = Math.max(3, band * 0.56);
    const X = (i) => padL + band * i + band / 2;
    const maxHigh = Math.max(...T.candles.map((k) => k.h));
    const pStep = niceStep(maxHigh * 1.12, 4);
    const pMax = Math.ceil((maxHigh * 1.12) / pStep) * pStep;
    const YP = (v) => pTop + pH - (v / pMax) * pH;

    const totals = T.candles.map((_, i) => GROUPS.reduce((s, g) => s + T.volume[g][i], 0));
    const rest = Math.max(...totals.slice(1));
    const vStep = niceStep(rest * 1.15, 2);
    const vMax = Math.ceil((rest * 1.15) / vStep) * vStep;
    const YV = (v) => vBot - (Math.min(v, vMax) / vMax) * vH;

    let s = `<svg class="tr-chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="MOON market cap over its first 15 minutes, with each candle's volume split by who traded. The team sold seven times in the last half.">`;
    // grid + ticks
    for (let v = 0; v <= pMax + 1e-9; v += pStep) {
      const y = YP(v);
      s += `<line class="trc-grid" x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}"/>`;
      s += `<text class="trc-tick" x="${padL - 8}" y="${y + 3.5}" text-anchor="end">$${v}K</text>`;
    }
    for (let v = 0; v <= vMax + 1e-9; v += vStep) {
      const y = YV(v);
      s += `<line class="trc-grid" x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}"/>`;
      s += `<text class="trc-tick" x="${padL - 8}" y="${y + 3.5}" text-anchor="end">${v}</text>`;
    }
    if (labels) {
      s += `<text class="trc-label" x="${padL}" y="${pTop - 8}">Market cap</text>`;
      s += `<text class="trc-label" x="${padL}" y="${vTop - 9}">Volume by who traded, SOL</text>`;
    }
    [0, 10, 20, 30].forEach((i) => {
      const x = padL + band * i;
      s += `<text class="trc-tick" x="${x}" y="${h - 6}" text-anchor="${i === 0 ? "start" : i === 30 ? "end" : "middle"}">${(i * T.candleSeconds) / 60}${i === 30 ? " min" : ""}</text>`;
    });
    // volume stacks
    T.candles.forEach((_, i) => {
      let acc = 0;
      const tip = GROUPS.filter((g) => T.volume[g][i] > 0.05)
        .map((g) => `${GROUP_LABEL[g]} ${T.volume[g][i]}`)
        .join(", ");
      s += `<g><title>Minute ${((i * 30) / 60).toFixed(1)} · ${round(totals[i])} SOL: ${tip}</title>`;
      GROUPS.forEach((g) => {
        const v = T.volume[g][i];
        if (v <= 0) return;
        const y0 = YV(acc), y1 = YV(acc + v);
        acc += v;
        if (y0 - y1 < 0.6) return;
        s += `<rect class="trc-vol" x="${X(i) - bw / 2}" y="${y1}" width="${bw}" height="${y0 - y1}" style="fill:var(--g-${g})"${g === "likelyTeam" ? ' data-hatch="1"' : ""}/>`;
      });
      s += `</g>`;
    });
    // clipped launch bundle
    const x0 = X(0);
    s += `<path class="trc-break" d="M${x0 - bw / 2 - 2} ${vTop + 6} l${bw + 4} -4 M${x0 - bw / 2 - 2} ${vTop + 10} l${bw + 4} -4"/>`;
    s += `<text class="trc-anno" x="${x0 + bw / 2 + 6}" y="${vTop + 9}">Launch bundle: ${Math.round(totals[0])} SOL</text>`;
    // candles
    T.candles.forEach((k, i) => {
      const up = k.c >= k.o;
      const yo = YP(k.o), yc = YP(k.c);
      const top = Math.min(yo, yc), hgt = Math.max(1.2, Math.abs(yo - yc));
      s += `<g><title>Minute ${((i * 30) / 60).toFixed(1)} · open $${k.o}K, close $${k.c}K</title>`;
      s += `<line class="trc-wick" x1="${X(i)}" x2="${X(i)}" y1="${YP(k.h)}" y2="${YP(k.l)}"/>`;
      s += `<rect class="trc-candle ${up ? "is-up" : "is-down"}" x="${X(i) - bw / 2}" y="${top}" width="${bw}" height="${hgt}" rx="1"/></g>`;
    });
    // team sells
    T.teamSells.forEach((i) => {
      const k = T.candles[i];
      const y = YP(k.h) - 6;
      s += `<path class="trc-sell" d="M${X(i) - 5} ${y - 8} h10 l-5 8 z"><title>Team sell, ${T.volume.team[i]} SOL</title></path>`;
    });
    s += `</svg>`;
    return s;
  };

  TR.chartLegend = () =>
    `<ul class="tr-legend" aria-label="Chart key"><li><i class="tr-key-tri"></i>Team sell</li>${GROUPS.map(
      (g) => `<li><i class="tr-key-sw" style="background:var(--g-${g})"></i>${GROUP_LABEL[g]}</li>`,
    ).join("")}</ul>`;

  TR.chartStats = () =>
    `<dl class="tr-stats"><div><dt>Buying from independent buyers</dt><dd class="is-bad">${T.independentShare}</dd></div><div><dt>What the team could sell into now</dt><dd>${T.teamCanSellInto}</dd></div></dl>`;

  /* ---------- Bubble map ---------- */

  TR.bubbleMap = function ({ w = 560, h = 420, notes = true } = {}) {
    const m = 26;
    const sx = (w / 2 - m) / 0.98, sy = (h / 2 - m) / 0.98;
    const k = Math.min(w, h) / 440;
    const X = (x) => w / 2 + x * sx, Y = (y) => h / 2 - y * sy;
    const R = (share) => (3.2 + Math.sqrt(share) * 7.2) * k;
    const by = Object.fromEntries(T.wallets.map((wl) => [wl.id, wl]));
    let s = `<svg class="tr-map" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Bubble map of MOON's top holders and first buyers. One funder links 14 team wallets; the creator's bundle adds 5 more; 6 likely-team wallets sit in a ring.">`;
    T.links.forEach((l) => {
      const a = by[l.a], b = by[l.b];
      s += `<line class="trm-link ${l.kind === "likely" ? "is-likely" : ""}" x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}"/>`;
    });
    const order = [...T.wallets].sort((a, b) => (a.group === "independent") - (b.group === "independent") || 0).reverse();
    order.forEach((wl) => {
      const g = MAP_COLORED.includes(wl.group) ? wl.group : "other";
      const cx = X(wl.x), cy = Y(wl.y), r = R(wl.share);
      const label = `${wl.id} · ${wl.role ? wl.role[0].toUpperCase() + wl.role.slice(1) + " · " : ""}${GROUP_LABEL[wl.group]} · ${wl.share}% of supply${wl.fresh ? " · under a day old" : ""}`;
      if (wl.role === "funder") {
        const d = r + 3;
        s += `<path class="trm-funder" d="M${cx} ${cy - d} L${cx + d} ${cy} L${cx} ${cy + d} L${cx - d} ${cy} Z" style="--c:var(--g-team)"><title>${label}</title></path>`;
        return;
      }
      s += `<circle class="trm-dot ${wl.fresh ? "is-fresh" : ""}" cx="${cx}" cy="${cy}" r="${r}" style="--c:var(--g-${g})"><title>${label}</title></circle>`;
      if (wl.role === "creator") s += `<circle class="trm-creator" cx="${cx}" cy="${cy}" r="${r + 4}"/>`;
    });
    if (notes) {
      T.notes.forEach((n) => (s += `<text class="trm-note" x="${X(n.x)}" y="${Y(n.y)}" text-anchor="middle">${n.text}</text>`));
      const f = by["Fund…r8Q"];
      s += `<text class="trm-note is-small" x="${X(f.x)}" y="${Y(f.y) + R(f.share) + 18}" text-anchor="middle">Funder</text>`;
    }
    s += `</svg>`;
    return s;
  };

  TR.mapLegend = () =>
    `<ul class="tr-legend" aria-label="Map key"><li><i class="tr-key-dot" style="background:var(--g-team)"></i>Team</li><li><i class="tr-key-dot" style="background:var(--g-likelyTeam)"></i>Likely team</li><li><i class="tr-key-dot" style="background:var(--g-sniper)"></i>Snipers</li><li><i class="tr-key-dot" style="background:var(--g-other)"></i>Everyone else</li><li><i class="tr-key-dot is-ring"></i>Under a day old</li><li><i class="tr-key-diamond"></i>Funder</li><li><i class="tr-key-line"></i>Team link</li><li><i class="tr-key-line is-dotted"></i>Likely-team link</li></ul>`;

  /* ---------- Chance band: where 87% sits among the three verdicts ---------- */

  TR.chanceBand = () =>
    `<div class="tr-band" role="img" aria-label="Rug chance 87%, inside the Likely rug band (60% and up)"><div class="tr-band__track"><span class="tr-band__seg is-unlikely" style="width:25%"><em>Unlikely</em></span><span class="tr-band__seg is-possible" style="width:35%"><em>Possible</em></span><span class="tr-band__seg is-likely" style="width:40%"><em>Likely rug</em></span></div><span class="tr-band__mark" style="left:87%"></span><div class="tr-band__ticks"><span style="left:0">0</span><span style="left:25%">25</span><span style="left:60%">60</span><span style="left:100%">100%</span></div></div>`;

  /* ---------- Text blocks ---------- */

  TR.why = () => T.explanation.map((p) => `<p>${p}</p>`).join("");

  TR.signals = ({ families = false } = {}) => {
    let out = `<ul class="tr-signals">`;
    let fam = "";
    T.signals.forEach((sg) => {
      if (families && sg.family !== fam) {
        fam = sg.family;
        out += `<li class="tr-sig-fam">${fam}</li>`;
      }
      out += `<li class="tr-sig is-${sg.status}"><span class="tr-sig__status">${icon(sg.status, 14)}${STATUS_WORD[sg.status]}</span><span class="tr-sig__name">${sg.name}</span><span class="tr-sig__value">${sg.value}</span></li>`;
    });
    return out + `</ul>`;
  };

  TR.claims = () =>
    `<ul class="tr-claims">${T.claims
      .map(
        (c) =>
          `<li><span class="tr-claim__q">${c.claim}<small>${c.at}</small></span><span class="tr-claim__chain">${c.chain}</span><span class="tr-claim__v ${c.verdict === "Contradicted" ? "is-bad" : ""}">${c.verdict}</span></li>`,
      )
      .join("")}</ul>`;

  TR.facts = ({ title = "Token Facts" } = {}) => {
    const f = T.facts;
    return `<section class="tr-facts" aria-label="${title}: ${f.subject}"><h3 class="tr-facts__title">${title}</h3><p class="tr-facts__subject">${f.subject}</p><p class="tr-facts__serving">${f.serving}</p><div class="tr-facts__claimed"><span>${f.claimed.label}</span><s><span class="tr-sr">Contradicted by the chain: </span>${f.claimed.value}</s></div><div class="tr-facts__tested"><span>${f.tested.label}</span><b>${f.tested.value}</b></div><dl class="tr-facts__rows">${f.rows
      .map((r) => `<div class="${r.rule ? "has-rule" : ""}"><dt>${r.label}</dt><dd class="${r.bad ? "is-bad" : ""}">${r.value}</dd></div>`)
      .join("")}</dl><p class="tr-facts__foot">${f.footnote}</p></section>`;
  };

  /* ---------- IDE shell pieces ---------- */

  TR.tree = () => {
    const file = (name, kind, active) =>
      `<li><a class="tr-file ${active ? "is-active" : ""}" href="#" ${active ? 'aria-current="page"' : ""}>${icon(kind, 14)}<span>${name}</span>${active ? '<i class="tr-file__dot" title="Just written by the agent"></i>' : ""}</a></li>`;
    const dir = (name, items) =>
      `<li class="tr-dir"><span class="tr-dir__name">${icon("chevronDown", 13)}${name}</span><ul>${items}</ul></li>`;
    return `<ul class="tr-tree">${dir("tokens", file("MOON-7xKX.md", "file", true) + file("KITE-4nPq.md", "file"))}${dir(
      "strategies",
      file("rsi_dip.pine", "code") + file("golden_cross.pine", "code"),
    )}${dir("clips", file("moon_shill.mp4", "film") + file("guru_clip.mp4", "film"))}</ul>`;
  };

  const STEPS = [
    ["Transcribed the clip", "", "Muse Voice Transcribe · 2.8s"],
    ["Read the token off the screen", "Mint shown at 0:21: 7xKX…gAsU", "Muse Spark 1.3 · 5.1s"],
    ["Found 3 tokens named MOON", "The clip shows the mint, so it's this one", ""],
    ["Found 3 claims", "“No team” 0:12 · “Dev is doxxed” 0:27 · “This can't rug” 0:40", ""],
    ["Pulled MOON's first 15 minutes", "412 trades, 212 holders, 96 funding transfers", "1.9s"],
    ["Traced who funded every wallet", "2 team clusters: 19 wallets hold 23%", ""],
    ["Split the buying by who bought", "Independent buyers: 11% of buy volume", ""],
    ["Wrote tokens/MOON-7xKX.md", "", ""],
    ["Scored the rug chance", "Likely rug · 87%", "Muse Glimmer"],
  ];
  TR.thread = ({ compactSteps = false } = {}) => {
    const steps = compactSteps ? STEPS.filter((_, i) => [1, 4, 5, 6, 8].includes(i)) : STEPS;
    return `<div class="tr-msg tr-msg--user"><span class="tr-clipchip">${icon("film", 14)}moon_shill.mp4<small>0:52</small></span><p>Is this token legit? Someone's shilling it everywhere.</p></div><ol class="tr-steps">${steps
      .map(
        ([t, d, m]) =>
          `<li><span class="tr-step__ok">${icon("check", 12)}</span><span class="tr-step__body"><b>${t}</b>${d ? `<span>${d}</span>` : ""}</span>${m ? `<small>${m}</small>` : ""}</li>`,
      )
      .join("")}</ol><div class="tr-msg tr-msg--agent"><p>Likely rug, with an 87% rug chance. Two groups of wallets tied to the creator hold 23% of MOON, most early buys were the same 0.5 SOL, and the team has sold into new buyers seven times. The full report is open.</p><p class="tr-audit">${icon("pass", 13)}Numbers checked against the check</p></div>`;
  };

  function mdLines() {
    const L = [
      "# MOON (pump.fun)",
      "",
      "Example rug check. MOON is a made-up token used to show the report.",
      "",
      `Mint: ${T.mint}`,
      "Checked: 15 minutes after launch, from a shill clip, moon_shill.mp4",
      "Stage: Bonding curve",
      "",
      "## Verdict",
      "",
      "Likely rug · 87% rug chance",
      "",
      ...T.explanation.flatMap((p) => [p, ""]),
      "## Signals",
      "",
      "| Signal | Value | Status |",
      "|---|---|---|",
      ...T.signals.map((sg) => `| ${sg.name} | ${sg.value} | ${STATUS_WORD[sg.status]} |`),
    ];
    return L;
  }
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  TR.editor = ({ lines = 40 } = {}) =>
    `<pre class="tr-code"><code>${mdLines()
      .slice(0, lines)
      .map((l, i) => {
        let cls = "";
        if (l.startsWith("#")) cls = "md-h";
        else if (l.startsWith("|")) cls = "md-t";
        else if (/^(Mint|Checked|Stage):/.test(l)) cls = "md-k";
        else if (l.startsWith("Likely rug")) cls = "md-v";
        const body = cls === "md-k" ? `<b>${esc(l.split(":")[0])}:</b>${esc(l.slice(l.indexOf(":") + 1))}` : esc(l);
        return `<span class="tr-ln">${i + 1}</span><span class="tr-cl ${cls}">${body || " "}</span>`;
      })
      .join("\n")}</code></pre>`;

  /* ---------- Shared base CSS for the pieces above (each direction themes it with variables) ---------- */

  const css = `
  .tr-i{flex:none;display:inline-block;vertical-align:-2px}
  .tr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .tr-chart,.tr-map{display:block;width:100%;height:auto;overflow:visible}
  .trc-grid{stroke:var(--chart-grid);stroke-width:1;shape-rendering:crispEdges}
  .trc-tick{fill:var(--chart-muted);font:500 10.5px var(--mono);font-variant-numeric:tabular-nums}
  .trc-label{fill:var(--chart-text);font:600 11px var(--sans)}
  .trc-anno{fill:var(--chart-muted);font:500 10.5px var(--sans)}
  .trc-break{stroke:var(--chart-bg);stroke-width:2.5;fill:none}
  .trc-vol{stroke:var(--chart-bg);stroke-width:1}
  .trc-wick{stroke:var(--candle);stroke-width:1.2}
  .trc-candle{stroke:var(--candle);stroke-width:1.2}
  .trc-candle.is-up{fill:var(--chart-bg)}
  .trc-candle.is-down{fill:var(--candle)}
  .trc-sell{fill:var(--g-team);stroke:var(--chart-bg);stroke-width:1.5;stroke-linejoin:round}
  .trm-link{stroke:var(--g-team);stroke-width:1.1;opacity:.55}
  .trm-link.is-likely{stroke:var(--g-likelyTeam);stroke-dasharray:2 3;opacity:.9}
  .trm-dot{fill:var(--c);stroke:var(--chart-bg);stroke-width:1.5}
  .trm-dot.is-fresh{fill:var(--chart-bg);stroke:var(--c);stroke-width:2}
  .trm-funder{fill:var(--c);stroke:var(--chart-bg);stroke-width:1.5}
  .trm-creator{fill:none;stroke:var(--chart-text);stroke-width:1.2;stroke-dasharray:3 2}
  .trm-note{fill:var(--chart-text);font:650 11.5px var(--sans);paint-order:stroke;stroke:var(--chart-bg);stroke-width:4px;stroke-linejoin:round}
  .trm-note.is-small{font-weight:500;font-size:10.5px;fill:var(--chart-muted)}
  .tr-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:0;list-style:none;font-size:11.5px;color:var(--text-2)}
  .tr-legend li{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .tr-key-sw{width:10px;height:10px;border-radius:2px;display:inline-block}
  .tr-key-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .tr-key-dot.is-ring{background:transparent;box-shadow:inset 0 0 0 1.75px var(--text-2)}
  .tr-key-diamond{width:8px;height:8px;background:var(--g-team);transform:rotate(45deg);display:inline-block}
  .tr-key-line{width:16px;border-top:1.5px solid var(--g-team);display:inline-block}
  .tr-key-line.is-dotted{border-top:1.5px dotted var(--g-likelyTeam)}
  .tr-key-tri{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid var(--g-team);display:inline-block}
  .tr-tree,.tr-tree ul{list-style:none;margin:0;padding:0}
  .tr-tree ul{padding-left:14px}
  .tr-dir__name{display:flex;align-items:center;gap:5px;padding:5px 8px;color:var(--text-2);font-size:12.5px}
  .tr-file{display:flex;align-items:center;gap:7px;padding:5px 8px;color:var(--text-1);text-decoration:none;font-size:12.5px;border-radius:7px;position:relative}
  .tr-file .tr-i{color:var(--text-3)}
  .tr-file__dot{width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:auto}
  .tr-steps{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .tr-steps li{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:start;padding:5px 0;font-size:12.5px;line-height:1.4}
  .tr-step__ok{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;margin-top:1px}
  .tr-step__body b{font-weight:550;display:block}
  .tr-step__body span{color:var(--text-2);display:block;font-size:12px}
  .tr-steps small{color:var(--text-3);font-size:11px;white-space:nowrap;margin-top:1px}
  .tr-clipchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:550}
  .tr-clipchip small{color:var(--text-3);font-weight:400;font-variant-numeric:tabular-nums}
  .tr-audit{display:flex;align-items:center;gap:6px;color:var(--text-2);font-size:11.5px;margin:8px 0 0}
  .tr-code{margin:0;font:400 12px/1.65 var(--mono);white-space:pre;overflow:hidden}
  .tr-code code{display:grid;grid-template-columns:auto 1fr;column-gap:16px}
  .tr-ln{color:var(--code-ln);text-align:right;user-select:none}
  .tr-cl{color:var(--code-text);overflow:hidden;text-overflow:ellipsis}
  .md-h{color:var(--code-h);font-weight:700}
  .md-t{color:var(--code-t)}
  .md-k b{color:var(--code-k);font-weight:500}
  .md-v{color:var(--code-v);font-weight:700}
  .tr-signals{list-style:none;margin:0;padding:0}
  .tr-sig{display:grid;grid-template-columns:92px minmax(0,1fr) minmax(0,max-content);gap:12px;align-items:baseline;font-size:13px}
  .tr-sig__value{max-width:22ch}
  .tr-sig__status{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px}
  .tr-sig__value{font-variant-numeric:tabular-nums;text-align:right;color:var(--text-2)}
  .tr-sig.is-red .tr-sig__status{color:var(--bad)}
  .tr-sig.is-caution .tr-sig__status{color:var(--warn)}
  .tr-sig.is-pass .tr-sig__status{color:var(--ok)}
  .tr-sig.is-unknown .tr-sig__status{color:var(--text-3)}
  .tr-facts__claimed s{text-decoration:none;position:relative;color:var(--text-3)}
  .tr-facts__claimed s::after{content:"";position:absolute;left:-2px;right:-2px;top:52%;height:2.5px;background:var(--bad);border-radius:2px}
  .tr-facts__rows{margin:0}
  .tr-facts__rows div{display:flex;justify-content:space-between;gap:12px}
  .tr-facts__rows dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}
  .tr-facts__rows dd.is-bad,.tr-facts__tested b{color:var(--bad)}
  .tr-band{position:relative;padding-bottom:16px}
  .tr-band__track{display:flex;height:8px;gap:2px}
  .tr-band__seg:first-child{border-radius:999px 0 0 999px}.tr-band__seg:last-child{border-radius:0 999px 999px 0}
  .tr-band__seg{display:block;position:relative}
  .tr-band__seg em{position:absolute;top:12px;left:0;font-style:normal;font-size:10.5px;color:var(--text-3);white-space:nowrap}
  .tr-band__seg.is-likely em{color:var(--bad);font-weight:600}
  .tr-band__mark{position:absolute;top:-4px;width:3px;height:16px;border-radius:2px;background:var(--text-1);transform:translateX(-50%);box-shadow:0 0 0 2px var(--chart-bg)}
  .tr-band__ticks{display:none}
  .tr-claims{list-style:none;margin:0;padding:0}
  .tr-claims li{display:grid;grid-template-columns:1.1fr 1.3fr auto;gap:12px;align-items:baseline;font-size:12.5px}
  .tr-claim__q small{margin-left:6px;color:var(--text-3);font-variant-numeric:tabular-nums}
  .tr-claim__chain{color:var(--text-2)}
  .tr-claim__v{font-weight:600;color:var(--text-2)}
  .tr-claim__v.is-bad{color:var(--bad)}
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.prepend(st);

  /* ---------- Mount: fill [data-slot] elements ---------- */

  TR.mount = function () {
    document.querySelectorAll("[data-slot]").forEach((el) => {
      const d = el.dataset;
      const w = +d.w || undefined, h = +d.h || undefined;
      const map = {
        chart: () => TR.realChart({ w, h, labels: d.labels !== "0" }),
        map: () => TR.bubbleMap({ w, h, notes: d.notes !== "0" }),
        chartLegend: TR.chartLegend,
        mapLegend: TR.mapLegend,
        stats: TR.chartStats,
        band: TR.chanceBand,
        why: TR.why,
        signals: () => TR.signals({ families: d.families === "1" }),
        claims: TR.claims,
        facts: () => TR.facts(),
        tree: TR.tree,
        thread: () => TR.thread({ compactSteps: d.compact === "1" }),
        editor: () => TR.editor({ lines: +d.lines || 40 }),
      };
      if (map[d.slot]) el.innerHTML = map[d.slot]();
    });
    document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 15)));
    if (/full/.test(location.search)) {
      const mark = () => (document.documentElement.dataset.h = Math.ceil(document.querySelector(".app").getBoundingClientRect().height + 24));
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(mark, 50));
    }
    // ?shot=2 scrolls the report to the second capture point
    if (/shot=2/.test(location.search)) {
      const go = () => {
        const sc = document.querySelector("[data-scroller]");
        const tg = document.querySelector("[data-shot2]");
        if (sc && tg) sc.scrollTop = tg.offsetTop - (+sc.dataset.offset || 16);
      };
      go();
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", TR.mount);
  else TR.mount();
})();

// The backtest report behind each run: trades, regimes, monthly returns.
// Every value is generated from a fixed seed and is an example, not a real backtest.

import { runs } from "./examples";
import type { Point } from "./series";

export const REGIMES = ["Calm uptrend", "Volatile uptrend", "Calm downtrend", "Volatile downtrend"] as const;
export type Regime = (typeof REGIMES)[number];

// Validated with the dataviz palette checks on white: lightness, chroma, CVD, contrast all pass.
export const REGIME_COLORS: Record<Regime, string> = {
  "Calm uptrend": "#1f7a4d",
  "Volatile uptrend": "#4a86c8",
  "Calm downtrend": "#2f4f99",
  "Volatile downtrend": "#b0559a",
};

export const GAIN = "#1f7a4d";
export const LOSS = "#c3261c";

export type Trade = {
  n: number;
  entry: string;
  held: number;
  feature: number;
  ret: number;
  pnl: number;
  regime: Regime;
};

export type Tile = { label: string; value: string; note?: string; bad?: boolean };

export type Report = {
  title: string;
  compareText: string;
  meta: string;
  tiles: Tile[];
  benchmarkName: string;
  trades: Trade[];
  featureLabel: string;
  heldLabel: string;
  heldUnit: string;
  regimeTotals: Record<Regime, number>;
  regimeTiles: Tile[];
  regimeInsight: string;
  scatterInsight: string;
  monthly: { years: number[]; values: (number | null)[][] };
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

function money(v: number) {
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

function maxDrawdown(dd: Point[]) {
  return `−${Math.abs(Math.min(...dd.map((p) => p.value))).toFixed(0)}%`;
}

function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

type Spec = {
  seed: number;
  count: number;
  start: string;
  end: string;
  targetPnl: number;
  feature: { min: number; max: number; better: "low" | "high" };
  held: { median: number; max: number };
  regimeOdds: number[];
  regimeMean: number[];
  noise: number;
};

function makeTrades(spec: Spec): Trade[] {
  const r = rng(spec.seed);
  const t0 = new Date(spec.start + "T00:00:00Z").getTime();
  const t1 = new Date(spec.end + "T00:00:00Z").getTime();
  const trades: Trade[] = [];
  for (let i = 0; i < spec.count; i++) {
    const u = r();
    let acc = 0;
    let ri = 0;
    for (; ri < spec.regimeOdds.length - 1; ri++) {
      acc += spec.regimeOdds[ri];
      if (u < acc) break;
    }
    const f = spec.feature.min + r() * (spec.feature.max - spec.feature.min);
    const span = spec.feature.max - spec.feature.min;
    // Entries at the "better" end of the feature range do better.
    const edge = ((spec.feature.better === "low" ? spec.feature.max - f : f - spec.feature.min) / span - 0.5) * 4;
    const held = Math.max(1, Math.min(spec.held.max, Math.round(spec.held.median * Math.exp(gauss(r) * 0.6))));
    const ret = spec.regimeMean[ri] + edge + gauss(r) * spec.noise;
    const time = t0 + ((t1 - t0) * (i + r() * 0.8)) / spec.count;
    trades.push({
      n: i + 1,
      entry: new Date(time).toISOString().slice(0, 10),
      held,
      feature: Math.round(f * 10) / 10,
      ret: Math.round(ret * 10) / 10,
      pnl: ret,
      regime: REGIMES[ri],
    });
  }
  // Scale dollar P&L so the trades add up to the run's total. A negative scale would turn every winner into a
  // loser, so a seed whose trades net the wrong way is a mistake to fix here, not to paper over.
  const raw = trades.reduce((s, t) => s + t.pnl, 0);
  const k = spec.targetPnl / raw;
  if (!(k > 0)) throw new Error(`Seed ${spec.seed} nets ${raw.toFixed(1)}, the wrong sign for ${spec.targetPnl}. Pick another seed.`);
  for (const t of trades) t.pnl = Math.round(t.pnl * k);
  return trades;
}

function monthly(series: Point[]) {
  const ends = new Map<string, number>();
  for (const p of series) ends.set(p.time.slice(0, 7), p.value);
  const keys = [...ends.keys()];
  const years = [...new Set(keys.map((k) => Number(k.slice(0, 4))))];
  const values = years.map(() => Array<number | null>(12).fill(null));
  let prev = series[0].value;
  for (const k of keys) {
    const v = ends.get(k)!;
    const y = years.indexOf(Number(k.slice(0, 4)));
    values[y][Number(k.slice(5, 7)) - 1] = Math.round((v / prev - 1) * 1000) / 10;
    prev = v;
  }
  return { years, values };
}

function summarize(trades: Trade[]) {
  const totals = Object.fromEntries(REGIMES.map((g) => [g, 0])) as Record<Regime, number>;
  for (const t of trades) totals[t.regime] += t.pnl;
  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const profit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const calmShare = Math.max(0, totals["Calm uptrend"]) / Math.max(1, totals["Calm uptrend"] + Math.max(0, totals["Volatile uptrend"]));
  const down = totals["Calm downtrend"] + totals["Volatile downtrend"];
  const wins = trades.filter((t) => t.ret > 0).length;
  return { totals, net, profit, calmShare, down, winRate: wins / trades.length };
}

function splitInsight(trades: Trade[], featureName: string, cut: number, below: string, above: string) {
  const lo = trades.filter((t) => t.feature < cut);
  const hi = trades.filter((t) => t.feature >= cut);
  const wr = (xs: Trade[]) => xs.filter((t) => t.ret > 0).length / Math.max(1, xs.length);
  return `Entries ${below} ${featureName} ${cut} won ${pct(wr(lo))} of the time; entries ${above} won ${pct(wr(hi))}. The deeper the dip at entry, the better the trade tended to go.`;
}

function build(runId: string): Report | null {
  const run = runs[runId];
  if (!run) return null;
  const focus = run.series.find((s) => s.focus)!;

  if (runId === "rsi") {
    const trades = makeTrades({
      seed: 41,
      count: 148,
      start: "2021-01-04",
      end: "2026-10-20",
      targetPnl: 4120,
      feature: { min: 12, max: 30, better: "low" },
      held: { median: 7, max: 45 },
      regimeOdds: [0.4, 0.27, 0.18, 0.15],
      regimeMean: [2.6, 1.2, -1.6, -2.4],
      noise: 5.5,
    });
    const s = summarize(trades);
    const avgHeld = trades.reduce((a, t) => a + t.held, 0) / trades.length;
    return {
      title: "RSI dip · BTC-USD · 4-hour",
      compareText: "simply holding BTC",
      meta: "Jan 2021 – Oct 2026 · $10,000 start · 0.1% fees and slippage · example values",
      benchmarkName: "Holding BTC",
      tiles: [
        { label: "Total return", value: "+41%", note: "Holding BTC: +262%" },
        { label: "Per year", value: "6.1%" },
        { label: "Max drawdown", value: maxDrawdown(run.drawdown) },
        { label: "Win rate", value: pct(s.winRate) },
        { label: "Trades", value: String(trades.length) },
        { label: "Average hold", value: `${avgHeld.toFixed(1)} days` },
      ],
      trades,
      featureLabel: "RSI at entry",
      heldLabel: "Days held",
      heldUnit: "days",
      regimeTotals: s.totals,
      regimeTiles: [
        { label: "Net P&L", value: money(s.net) },
        { label: "Share of profit in calm uptrends", value: pct(s.calmShare) },
        { label: "Downtrend P&L", value: money(s.down), bad: s.down < 0 },
      ],
      regimeInsight: `The strategy only made money when Bitcoin was already rising. Calm uptrends carried ${pct(
        s.calmShare,
      )} of the profit, and every downtrend lost money: ${money(s.down)} in total.`,
      scatterInsight: splitInsight(trades, "RSI", 20, "below", "at or above it"),
      monthly: monthly(focus.data),
    };
  }

  if (runId === "cashflow") {
    const trades = makeTrades({
      seed: 77,
      count: 420,
      start: "2010-02-01",
      end: "2026-09-01",
      targetPnl: 631000,
      feature: { min: 4, max: 70, better: "high" },
      held: { median: 3, max: 14 },
      regimeOdds: [0.46, 0.24, 0.17, 0.13],
      regimeMean: [3.1, 2.2, -0.6, -1.4],
      noise: 7,
    });
    const s = summarize(trades);
    const avgHeld = trades.reduce((a, t) => a + t.held, 0) / trades.length;
    return {
      title: "Cash-flow top 20 · S&P 500 · monthly",
      compareText: "the naive version of the same backtest and the S&P 500",
      meta: "Jan 2010 – Oct 2026 · $100,000 start · 5 bps slippage · example values",
      benchmarkName: "Naive backtest",
      tiles: [
        { label: "Per year", value: "12.6%", note: "S&P 500: 11.0%" },
        { label: "Total return", value: "+631%" },
        { label: "Max drawdown", value: maxDrawdown(run.drawdown) },
        { label: "Win rate", value: pct(s.winRate) },
        { label: "Positions", value: String(trades.length) },
        { label: "Average hold", value: `${avgHeld.toFixed(1)} months` },
      ],
      trades,
      featureLabel: "6-month return at entry (%)",
      heldLabel: "Months held",
      heldUnit: "months",
      regimeTotals: s.totals,
      regimeTiles: [
        { label: "Net P&L", value: money(s.net) },
        { label: "Share of profit in calm uptrends", value: pct(s.calmShare) },
        { label: "Downtrend P&L", value: money(s.down), bad: s.down < 0 },
      ],
      regimeInsight: `Most of the gain came in calm uptrends (${pct(
        s.calmShare,
      )} of the profit). The unemployment switch to Treasuries kept downtrend losses to ${money(s.down)}.`,
      scatterInsight: `Positions bought with the strongest 6-month run did best: the top third won ${pct(
        trades.filter((t) => t.feature >= 48).filter((t) => t.ret > 0).length /
          Math.max(1, trades.filter((t) => t.feature >= 48).length),
      )} of the time, the bottom third ${pct(
        trades.filter((t) => t.feature < 26).filter((t) => t.ret > 0).length /
          Math.max(1, trades.filter((t) => t.feature < 26).length),
      )}.`,
      monthly: monthly(focus.data),
    };
  }

  return null;
}

const cache = new Map<string, Report | null>();

export function reportFor(runId: string): Report | null {
  if (!cache.has(runId)) cache.set(runId, build(runId));
  return cache.get(runId)!;
}

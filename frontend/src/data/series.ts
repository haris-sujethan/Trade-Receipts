// Deterministic example series so the UI looks the same on every load.
// These are illustrative values, not real backtests.

export type Point = { time: string; value: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function weekly(start: string, weeks: number): string[] {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < weeks; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** A random walk scaled so it ends at `endReturn` (e.g. 0.41 for +41%). */
export function walk(
  seed: number,
  start: string,
  weeks: number,
  endReturn: number,
  volatility: number,
  capital = 10_000,
): Point[] {
  const r = rng(seed);
  const dates = weekly(start, weeks);
  const raw: number[] = [0];
  for (let i = 1; i < weeks; i++) {
    const shock = (r() - 0.5) * 2 * volatility;
    raw.push(raw[i - 1] + shock);
  }
  // Tilt the walk so it lands exactly on the target log return.
  const target = Math.log(1 + endReturn);
  const drift = (target - raw[weeks - 1]) / (weeks - 1);
  return dates.map((time, i) => ({
    time,
    value: Math.round(capital * Math.exp(raw[i] + drift * i)),
  }));
}

export function drawdown(series: Point[]): Point[] {
  let peak = -Infinity;
  return series.map((p) => {
    peak = Math.max(peak, p.value);
    return { time: p.time, value: Math.round((p.value / peak - 1) * 1000) / 10 };
  });
}

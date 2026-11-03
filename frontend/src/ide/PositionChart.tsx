import { useMemo, useState } from "react";
import { duration, type Fill, type Position } from "../demo/runs";

/**
 * One copied position: the token's price from the wallet's first buy until the copier's last sell, with the wallet's
 * trades (ink) and the copier's (blue) marked on it. Time runs on a log scale, so the wallet's few seconds and the
 * copier's minutes of waiting both have room.
 */

type Mark = { s: number; v: number; side: Fill["side"]; who: "wallet" | "you"; sol: number; rest?: boolean };

const TIME_TICKS = [0, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 21600, 43200, 86400];
const tickLabel = (s: number) => (s === 0 ? "0" : s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : `${s / 3600}h`);
const log = (s: number) => Math.log10(1 + Math.max(0, s));
export const mcap = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1)} SOL`;
const tickPrice = (v: number) => `${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1)} SOL`;

/** A few round prices between lo and hi: 1-2-5 steps on a log scale, even steps on a linear one. */
function priceTicks(lo: number, hi: number, logScale: boolean): number[] {
  if (logScale) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (v >= lo && v <= hi) out.push(v);
      }
    if (out.length >= 2) return out;
  }
  // The smallest round step that keeps it to four lines or fewer.
  const mag = 10 ** Math.floor(Math.log10((hi - lo) / 4));
  const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).find((s) => (hi - lo) / s <= 4) ?? hi - lo;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** An up triangle for a buy, a down one for a sell, centred on the price. */
export function triangle(x: number, y: number, side: Fill["side"], s = 5.5) {
  return side === "buy" ? `M${x} ${y - s}L${x + s} ${y + s * 0.8}L${x - s} ${y + s * 0.8}Z` : `M${x} ${y + s}L${x + s} ${y - s * 0.8}L${x - s} ${y - s * 0.8}Z`;
}

export function PositionChart({ p, buyAfter, sellAfter, width = 760, height = 250 }: { p: Position; buyAfter: number; sellAfter: number; width?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const t0 = p.first_buy_ts;
    // The price is the last trade at or before each moment, as the backtest reads it; the fills are trades too.
    const points = [...p.price_path, ...p.wallet_fills, ...p.you.trades]
      .map((q) => ({ s: q.t - t0, v: q.mcap_sol }))
      .filter((q) => q.s >= 0 && q.v > 0)
      .sort((a, b) => a.s - b.s);
    const marks: Mark[] = [
      ...p.wallet_fills.map((f) => ({ s: f.t - t0, v: f.mcap_sol, side: f.side, who: "wallet" as const, sol: f.sol })),
      ...p.you.trades.map((f) => ({ s: f.t - t0, v: f.mcap_sol, side: f.side, who: "you" as const, sol: f.sol, rest: f.rest })),
    ];
    const end = Math.max(1, buyAfter, p.held_s + sellAfter, ...points.map((q) => q.s));
    const padL = 10;
    const padR = 62;
    const top = 12;
    const bottom = 24;
    const x = (s: number) => padL + (log(s) / log(end)) * (width - padL - padR);
    const values = points.map((q) => q.v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi === lo) [lo, hi] = [lo * 0.9, hi * 1.1];
    const logScale = hi / lo > 5;
    const [yMin, yMax] = logScale ? [lo / 1.15, hi * 1.15] : [Math.max(0, lo - (hi - lo) * 0.14), hi + (hi - lo) * 0.14];
    const f = logScale ? Math.log10 : (v: number) => v;
    const y = (v: number) => top + (1 - (f(v) - f(yMin)) / (f(yMax) - f(yMin))) * (height - top - bottom);

    let d = "";
    points.forEach((q, i) => {
      d += i === 0 ? `M${x(q.s).toFixed(1)} ${y(q.v).toFixed(1)}` : `H${x(q.s).toFixed(1)}V${y(q.v).toFixed(1)}`;
    });
    if (points.length) d += `H${x(end).toFixed(1)}`;

    const xTicks: number[] = [];
    for (const s of TIME_TICKS) if (s <= end && (!xTicks.length || x(s) - x(xTicks[xTicks.length - 1]) >= 30)) xTicks.push(s);

    // The waits: from its first buy to your first buy, and from its last sell to your last sell.
    const firstBuy = marks.find((m) => m.who === "wallet" && m.side === "buy");
    const yourBuy = marks.find((m) => m.who === "you" && m.side === "buy");
    const lastSell = [...marks].reverse().find((m) => m.who === "wallet" && m.side === "sell");
    const yourSell = [...marks].reverse().find((m) => m.who === "you" && m.side === "sell");
    const waits = [
      firstBuy && yourBuy ? [firstBuy, yourBuy] : null,
      lastSell && yourSell ? [lastSell, yourSell] : null,
    ].filter((w): w is [Mark, Mark] => !!w && w[1].s > w[0].s);

    return { x, y, d, marks, xTicks, yTicks: priceTicks(yMin, yMax, logScale), waits, padL, padR, top, bottom, logScale };
  }, [p, buyAfter, sellAfter, width, height]);

  const shown = hover != null ? geo.marks[hover] : null;
  const who = (m: Mark) =>
    m.who === "wallet"
      ? m.side === "buy"
        ? `It bought ${m.sol.toFixed(2)} SOL`
        : `It sold for ${m.sol.toFixed(2)} SOL`
      : m.side === "buy"
        ? `You buy ${m.sol.toFixed(2)} SOL`
        : `You sell ${m.rest ? "the rest " : ""}for ${m.sol.toFixed(2)} SOL`;

  return (
    <div className="pchart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${p.symbol || p.mint.slice(0, 6)}: market cap in SOL from the wallet's first buy to your last sell, with its trades and yours marked`}
        onPointerLeave={() => setHover(null)}
      >
        {geo.yTicks.map((v) => (
          <g key={v}>
            <line x1={geo.padL} x2={width - geo.padR} y1={geo.y(v)} y2={geo.y(v)} className="pchart__grid" />
            <text x={width - geo.padR + 8} y={geo.y(v) + 3.5} className="pchart__tick">
              {tickPrice(v)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((s) => (
          <text key={s} x={geo.x(s)} y={height - 6} className="pchart__tick" textAnchor={s === 0 ? "start" : "middle"}>
            {tickLabel(s)}
          </text>
        ))}
        <path d={geo.d} className="pchart__price" />
        {geo.waits.map(([a, b], i) => (
          <line key={i} x1={geo.x(a.s)} y1={geo.y(a.v)} x2={geo.x(b.s)} y2={geo.y(b.v)} className="pchart__wait" />
        ))}
        {geo.marks.map((m, i) => (
          <path key={i} d={triangle(geo.x(m.s), geo.y(m.v), m.side)} className={`pchart__mark pchart__mark--${m.who}${hover === i ? " is-on" : ""}`} />
        ))}
        {/* Hit targets bigger than the marks */}
        {geo.marks.map((m, i) => (
          <circle key={i} cx={geo.x(m.s)} cy={geo.y(m.v)} r={11} className="pchart__hit" onPointerEnter={() => setHover(i)} />
        ))}
      </svg>
      {shown && (
        <div
          className={`pchart__tip${geo.x(shown.s) > width * 0.72 ? " pchart__tip--left" : ""}`}
          style={{ left: `${(geo.x(shown.s) / width) * 100}%`, top: `${(geo.y(shown.v) / height) * 100}%` }}
        >
          <span>{who(shown)}</span>
          <span>Market cap {mcap(shown.v)}</span>
          <span>{shown.s === 0 ? "At its first buy" : `${duration(shown.s)} after its first buy`}</span>
        </div>
      )}
    </div>
  );
}

/** The chart's key, shared with the totals: ink for the wallet, blue for you. */
export function MarkKey({ who }: { who: "wallet" | "you" }) {
  return (
    <svg className="mark-key" viewBox="0 0 22 12" width="22" height="12" aria-hidden>
      <path d={triangle(6, 6.5, "buy", 4.5)} className={`pchart__mark pchart__mark--${who}`} />
      <path d={triangle(16, 5.5, "sell", 4.5)} className={`pchart__mark pchart__mark--${who}`} />
    </svg>
  );
}

/**
 * Each position's result as two dots on one scale: the wallet's (ink) and yours (blue), with zero marked. The numbers
 * sit in the cells beside it, so the drawing is for the eye only.
 */
export function ResultBar({ wallet, you, lo, hi, width = 120, height = 16 }: { wallet: number | null; you: number | null; lo: number; hi: number; width?: number; height?: number }) {
  const x = (v: number) => 5 + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (width - 10);
  const mid = height / 2;
  return (
    <svg className="rbar" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <line x1={x(0)} x2={x(0)} y1={1} y2={height - 1} className="rbar__zero" />
      {wallet != null && you != null && <line x1={x(wallet)} x2={x(you)} y1={mid} y2={mid} className="rbar__gap" />}
      {wallet != null && <circle cx={x(wallet)} cy={mid} r={3.6} className="rbar__dot rbar__dot--wallet" />}
      {you != null && <circle cx={x(you)} cy={mid} r={3.6} className="rbar__dot rbar__dot--you" />}
    </svg>
  );
}

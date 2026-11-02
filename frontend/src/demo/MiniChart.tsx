import { useMemo } from "react";
import { CHART_ORDER, CHART_SWATCH, swatchVar } from "./groups";
import { whole, type Check } from "./runs";

type Props = {
  chart: Check["chart"];
  width: number;
  height: number;
  /** Candles drawn so far (the rest are still being read). */
  upTo?: number;
  /** Volume by who traded, under the price. */
  volume?: boolean;
  /** Team sells, marked above their candles. */
  sells?: boolean;
  /** Small copies drop the axes and labels. */
  compact?: boolean;
  /** Only the first N candles. */
  first?: number;
  /** Draw the price; off leaves the volume alone. */
  price?: boolean;
  label?: string;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Market cap in SOL as candles (hollow up, solid down, so color stays free for wallet groups), with volume by group. */
export function MiniChart({ chart, width, height, upTo, volume = true, sells = true, compact, first, price = true, label }: Props) {
  const candles = first ? chart.candles.slice(0, first) : chart.candles;
  const shown = Math.min(candles.length, upTo ?? candles.length);
  const geo = useMemo(() => {
    const padR = compact ? 4 : 52;
    const padL = compact ? 4 : 8;
    const top = compact ? 6 : 18;
    const volH = !price ? height - (compact ? 4 : 22) : volume ? Math.round(height * (compact ? 0.3 : 0.26)) : 0;
    const axisH = compact ? 0 : 18;
    const priceBottom = height - volH - axisH - (volume ? 8 : 0);
    // The launch block can start near zero; scale to the rest of the chart and clip that one candle.
    const later = candles.slice(1);
    const lo = Math.min(...later.map((c) => c.low));
    const hi = Math.max(...candles.map((c) => c.high));
    const span = hi - lo || 1;
    const yMin = lo - span * 0.08;
    const yMax = hi + span * 0.12;
    const y = (v: number) => top + (1 - (Math.max(v, yMin) - yMin) / (yMax - yMin)) * (priceBottom - top);
    const step = (width - padL - padR) / candles.length;
    const x = (i: number) => padL + step * i + step / 2;
    const vol = candles.map((c) => CHART_ORDER.map((g) => ({ g, v: (c.volume[g]?.buy_sol ?? 0) + (c.volume[g]?.sell_sol ?? 0) })));
    const totals = vol.map((v) => v.reduce((s, p) => s + p.v, 0));
    const vMax = Math.max(1e-9, ...totals.slice(1)) * 1.1;
    const volTop = height - axisH - volH;
    const vy = (v: number) => (Math.min(v, vMax) / vMax) * volH;
    const clipped = candles[0] && candles[0].low < yMin;
    return { padL, padR, top, priceBottom, y, x, step, vol, totals, vMax, volTop, vy, volH, axisH, yMin, yMax, clipped };
  }, [candles, width, height, volume, compact, price]);

  const sellCandles = useMemo(() => {
    const per = new Map<number, number>();
    for (const s of chart.team_sells) {
      const i = Math.floor(s.t / chart.candle_s);
      if (i < candles.length) per.set(i, (per.get(i) ?? 0) + s.sol);
    }
    return [...per.entries()];
  }, [chart, candles.length]);

  const w = Math.max(1.5, geo.step * 0.62);
  const ticks = compact ? [] : [geo.yMin + (geo.yMax - geo.yMin) * 0.2, geo.yMin + (geo.yMax - geo.yMin) * 0.55, geo.yMin + (geo.yMax - geo.yMin) * 0.9];

  return (
    <svg className="mchart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? "Market cap in SOL, with volume by who traded"}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={geo.padL} x2={width - geo.padR} y1={geo.y(t)} y2={geo.y(t)} className="mchart__grid" />
          <text x={width - geo.padR + 6} y={geo.y(t) + 3.5} className="mchart__tick">
            {whole(t)}
          </text>
        </g>
      ))}
      {price && candles.slice(0, shown).map((c, i) => {
        const up = c.close >= c.open;
        const yo = geo.y(c.open);
        const yc = geo.y(c.close);
        return (
          <g key={c.t} className={up ? "mchart__up" : "mchart__down"}>
            <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.y(c.high)} y2={geo.y(c.low)} className="mchart__wick" />
            <rect x={geo.x(i) - w / 2} y={Math.min(yo, yc)} width={w} height={Math.max(1, Math.abs(yc - yo))} className="mchart__body" rx={compact ? 0.5 : 1} />
          </g>
        );
      })}
      {!compact && geo.clipped && shown > 0 && (
        <text x={geo.x(0) + w} y={geo.priceBottom - 4} className="mchart__note">
          Launch block, from {whole(candles[0].open)} SOL
        </text>
      )}
      {price && sells &&
        sellCandles
          .filter(([i]) => i < shown)
          .map(([i]) => {
            const yy = geo.y(candles[i].high) - (compact ? 4 : 6);
            const s = compact ? 2.6 : 4;
            return <path key={i} d={`M${geo.x(i) - s} ${yy - s * 1.4}L${geo.x(i) + s} ${yy - s * 1.4}L${geo.x(i)} ${yy}Z`} className="mchart__sell" />;
          })}
      {volume &&
        geo.vol.slice(0, shown).map((stack, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {stack.map(({ g, v }) => {
                if (v <= 0) return null;
                const h = geo.vy(acc + v) - geo.vy(acc);
                acc += v;
                if (h <= 0) return null;
                return <rect key={g} x={geo.x(i) - w / 2} y={geo.volTop + geo.volH - geo.vy(acc)} width={w} height={h} style={{ fill: swatchVar(CHART_SWATCH[g]) }} className="mchart__vol" />;
              })}
              {!compact && geo.totals[i] > geo.vMax && (
                <text x={geo.x(i) + w} y={geo.volTop + 9} className="mchart__note">
                  {whole(geo.totals[i])} SOL
                </text>
              )}
            </g>
          );
        })}
      {!compact &&
        [0, 5, 10, 15].map((m) => {
          const i = Math.min(candles.length - 1, Math.round((m * 60) / chart.candle_s));
          return (
            <text key={m} x={geo.x(i)} y={height - 4} className="mchart__tick" textAnchor="middle">
              {clock(m * 60)}
            </text>
          );
        })}
    </svg>
  );
}

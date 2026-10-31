import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, LineSeries, LineStyle, type IChartApi } from "lightweight-charts";
import type { Point } from "../data/series";

type Series = { name: string; data: Point[]; focus?: boolean };

// The chosen line burns brightest; every other line recedes.
const quiet = ["#8a8a91", "#55555c"];

function colorsFor(series: Series[]): string[] {
  let q = 0;
  return series.map((s) => (s.focus ? "#ffffff" : quiet[q++ % quiet.length]));
}

export function EquityChart({ series, drawdown }: { series: Series[]; drawdown: Point[] }) {
  const el = useRef<HTMLDivElement>(null);
  const colors = colorsFor(series);

  useEffect(() => {
    if (!el.current) return;
    const chart: IChartApi = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#111113" },
        textColor: "#a6a6ab",
        fontFamily: "Public Sans Variable, system-ui, sans-serif",
        fontSize: 12,
        panes: { separatorColor: "#26262b", separatorHoverColor: "#36363d" },
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#1c1c20", style: LineStyle.Solid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: {
        vertLine: { color: "#55555b", labelBackgroundColor: "#26262b" },
        horzLine: { color: "#55555b", labelBackgroundColor: "#26262b" },
      },
      handleScroll: false,
      handleScale: false,
    });

    const lineColors = colorsFor(series);
    // Draw quiet lines first so the focus line sits on top.
    const order = series.map((s, i) => ({ s, color: lineColors[i] })).sort((a, b) => Number(!!a.s.focus) - Number(!!b.s.focus));
    for (const { s, color } of order) {
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: s.focus ? 2 : 1,
        priceLineVisible: false,
        lastValueVisible: !!s.focus,
        crosshairMarkerVisible: !!s.focus,
        title: "",
      });
      line.setData(s.data);
    }

    const dd = chart.addSeries(
      AreaSeries,
      {
        lineColor: "#f0675c",
        topColor: "rgba(240,103,92,0.28)",
        bottomColor: "rgba(240,103,92,0.28)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(0)}%` },
      },
      1,
    );
    dd.setData(drawdown);
    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(90);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [series, drawdown]);

  return (
    <figure className="chart">
      <figcaption className="chart__legend">
        {series.map((s, i) => (
          <span key={s.name} className={s.focus ? "is-focus" : ""}>
            <i style={{ background: colors[i] }} aria-hidden />
            {s.name}
          </span>
        ))}
        <span className="chart__dd">
          <i aria-hidden />
          Drawdown
        </span>
      </figcaption>
      <div ref={el} className="chart__canvas" role="img" aria-label={`Equity curve: ${series.map((s) => s.name).join(", ")}, with drawdown below`} />
    </figure>
  );
}

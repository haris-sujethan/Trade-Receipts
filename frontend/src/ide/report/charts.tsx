import { useMemo } from "react";
import type { Data, Layout } from "plotly.js";
import type { Point } from "../../data/series";
import { GAIN, LOSS, REGIME_COLORS, REGIMES, type Report } from "../../data/report";
import { axis, dollars, INK, INK_2, Plot, signed, type ChartTable } from "./Plot";

const BENCH = ["#8a8a91", "#b4b4b9"];

/* ---------- Equity vs. benchmarks, with drawdown underneath ---------- */

export function EquityPlot({
  series,
  dd,
  start,
}: {
  series: { name: string; data: Point[]; focus?: boolean }[];
  dd: Point[];
  start: number;
}) {
  const { data, layout, narrowLayout, table } = useMemo(() => {
    let b = 0;
    const ordered = [...series].sort((a, c) => Number(!!a.focus) - Number(!!c.focus));
    const lines: Data[] = ordered.map((s) => ({
      type: "scatter",
      mode: "lines",
      name: s.name,
      x: s.data.map((p) => p.time),
      y: s.data.map((p) => p.value),
      line: { color: s.focus ? INK : BENCH[b++ % BENCH.length], width: s.focus ? 2.5 : 1.5 },
      hovertemplate: `${s.name}: $%{y:,.0f}<extra></extra>`,
      xaxis: "x",
      yaxis: "y",
    }));
    const drawdown: Data = {
      type: "scatter",
      mode: "lines",
      name: "Drawdown",
      x: dd.map((p) => p.time),
      y: dd.map((p) => p.value),
      fill: "tozeroy",
      fillcolor: "rgba(195,38,28,0.12)",
      line: { color: LOSS, width: 1.5 },
      hovertemplate: "Drawdown: %{y:.1f}%<extra></extra>",
      xaxis: "x",
      yaxis: "y2",
      showlegend: false,
    };
    // Direct labels at the right edge: name and total return.
    const ends = ordered.map((s) => {
      const last = s.data[s.data.length - 1];
      const ret = last.value / start - 1;
      return {
        x: last.time,
        y: last.value,
        xref: "x" as const,
        yref: "y" as const,
        xanchor: "left" as const,
        text: `${s.focus ? "<b>" : ""}${s.name}<br>${ret >= 0 ? "+" : "−"}${Math.abs(ret * 100).toFixed(0)}%${s.focus ? "</b>" : ""}`,
        showarrow: false,
        xshift: 8,
        align: "left" as const,
        font: { size: 12, color: s.focus ? INK : INK_2 },
      };
    });
    const layout: Partial<Layout> = {
      margin: { l: 8, r: 120, t: 8, b: 8 },
      hovermode: "x unified",
      xaxis: axis({ anchor: "y2", showspikes: true, spikecolor: INK_2, spikethickness: 1, spikedash: "solid" }),
      yaxis: axis({ domain: [0.34, 1], tickprefix: "$", tickformat: ",.0s" }),
      yaxis2: axis({ domain: [0, 0.24], ticksuffix: "%", tickformat: ".0f", title: { text: "Drawdown", font: { size: 11, color: INK_2 } } }),
      annotations: ends,
    };
    // Narrow: the end labels would squeeze the plot, so a legend across the top names the lines instead.
    const narrowLayout: Partial<Layout> = {
      margin: { l: 8, r: 8, t: 36, b: 8 },
      annotations: [],
      showlegend: true,
      legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { size: 11, color: INK_2 } },
    };
    // Month-end values; every series shares the same dates.
    const focus = series.find((s) => s.focus) ?? series[0];
    const monthEnds = focus.data
      .map((p, i) => ({ p, i }))
      .filter(({ p }, k, all) => k === all.length - 1 || all[k + 1].p.time.slice(0, 7) !== p.time.slice(0, 7));
    const table: ChartTable = {
      columns: ["Month", ...ordered.map((s) => s.name).reverse(), "Drawdown"],
      rows: () =>
        monthEnds.map(({ p, i }) => [
          p.time.slice(0, 7),
          ...[...ordered].reverse().map((s) => dollars(s.data[i]?.value ?? NaN)),
          signed(dd[i]?.value ?? 0),
        ]),
    };
    return { data: [...lines, drawdown], layout, narrowLayout, table };
  }, [series, dd, start]);

  return (
    <Plot
      data={data}
      layout={layout}
      narrowLayout={narrowLayout}
      height={420}
      label="Equity curve against benchmarks, with drawdown below"
      table={table}
    />
  );
}

/* ---------- Cumulative P&L by trade, colored by market regime ---------- */

export function RegimePlot({ report }: { report: Report }) {
  const { data, layout, table } = useMemo(() => {
    const segs = Object.fromEntries(REGIMES.map((g) => [g, { x: [] as (number | null)[], y: [] as (number | null)[] }]));
    let cum = 0;
    const hoverX: number[] = [];
    const hoverY: number[] = [];
    const hoverText: string[] = [];
    for (const t of report.trades) {
      const prev = cum;
      cum += t.pnl;
      const s = segs[t.regime];
      s.x.push(t.n - 1, t.n, null);
      s.y.push(prev, cum, null);
      hoverX.push(t.n);
      hoverY.push(cum);
      hoverText.push(
        `Trade ${t.n} · ${t.regime}<br>${t.pnl >= 0 ? "+" : "−"}$${Math.abs(t.pnl).toLocaleString("en-US")} · total $${Math.round(cum).toLocaleString("en-US")}`,
      );
    }
    const lines: Data[] = REGIMES.map((g) => ({
      type: "scatter",
      mode: "lines",
      name: g,
      x: segs[g].x,
      y: segs[g].y,
      line: { color: REGIME_COLORS[g], width: 2 },
      hoverinfo: "skip",
      connectgaps: false,
    }));
    // An invisible layer carries the tooltips for every trade.
    const hover: Data = {
      type: "scatter",
      mode: "markers",
      x: hoverX,
      y: hoverY,
      text: hoverText,
      marker: { size: 14, color: "rgba(0,0,0,0)" },
      hovertemplate: "%{text}<extra></extra>",
    };
    const layout: Partial<Layout> = {
      margin: { l: 8, r: 16, t: 8, b: 8 },
      hovermode: "closest",
      xaxis: axis({ title: { text: "Trade number", font: { size: 12, color: INK_2 } } }),
      yaxis: axis({ tickprefix: "$", tickformat: ",.0s", zeroline: true, zerolinecolor: "#cfcfcb" }),
    };
    const table: ChartTable = {
      columns: ["Regime", "Trades", "Win rate", "Net P&L"],
      rows: () =>
        REGIMES.map((g) => {
          const ts = report.trades.filter((t) => t.regime === g);
          const wins = ts.filter((t) => t.ret > 0).length;
          return [g, ts.length, `${Math.round((wins / Math.max(1, ts.length)) * 100)}%`, dollars(report.regimeTotals[g])];
        }),
    };
    return { data: [...lines, hover], layout, table };
  }, [report]);

  return (
    <Plot
      data={data}
      layout={layout}
      height={320}
      label="Cumulative profit and loss by trade, colored by market regime"
      table={table}
    />
  );
}

/* ---------- Every trade in 3D ---------- */

export function TradesPlot3D({ report }: { report: Report }) {
  const { data, layout, table } = useMemo(() => {
    const make = (win: boolean): Data => {
      const ts = report.trades.filter((t) => (t.ret > 0) === win);
      return {
        type: "scatter3d",
        mode: "markers",
        name: win ? "Winners" : "Losers",
        x: ts.map((t) => t.feature),
        y: ts.map((t) => t.held),
        z: ts.map((t) => t.ret),
        text: ts.map(
          (t) =>
            `Trade ${t.n} · ${t.entry}<br>${report.featureLabel}: ${t.feature}<br>${report.heldLabel}: ${t.held}<br>Return: ${t.ret > 0 ? "+" : ""}${t.ret}%`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          size: 4.5,
          color: win ? GAIN : LOSS,
          symbol: win ? "circle" : "diamond",
          line: { color: "#ffffff", width: 1 },
          opacity: 0.92,
        },
      };
    };
    const ax = (title: string) => ({
      title: { text: title, font: { size: 12, color: INK_2 } },
      gridcolor: "#e4e4e0",
      zerolinecolor: "#cfcfcb",
      backgroundcolor: "#ffffff",
      showbackground: true,
      tickfont: { size: 10, color: "#66666b" },
    });
    const layout: Partial<Layout> = {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        xaxis: ax(report.featureLabel),
        yaxis: ax(report.heldLabel),
        zaxis: ax("Trade return (%)"),
        camera: { eye: { x: 1.45, y: -1.45, z: 0.7 }, center: { x: 0, y: 0, z: -0.12 } },
        dragmode: "turntable",
        aspectmode: "manual",
        aspectratio: { x: 1, y: 1, z: 0.8 },
      },
    };
    const table: ChartTable = {
      columns: ["Trade", "Entry", report.featureLabel, report.heldLabel, "Return", "Regime"],
      rows: () => report.trades.map((t) => [t.n, t.entry, t.feature, t.held, signed(t.ret), t.regime]),
    };
    return { data: [make(true), make(false)], layout, table };
  }, [report]);

  return (
    <Plot
      data={data}
      layout={layout}
      height={460}
      label="Every trade in three dimensions: entry signal, time held, and return"
      table={table}
    />
  );
}

/* ---------- Monthly returns ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyPlot({ report }: { report: Report }) {
  const { data, layout, height, table } = useMemo(() => {
    const { years, values } = report.monthly;
    const all = values.flat().filter((v): v is number => v !== null);
    const lim = Math.max(...all.map(Math.abs), 1);
    const data: Data[] = [
      {
        type: "heatmap",
        x: MONTHS,
        y: years.map(String),
        z: values,
        zmin: -lim,
        zmax: lim,
        colorscale: [
          [0, "#e2938b"],
          [0.5, "#f4f4f1"],
          [1, "#8cc0a2"],
        ],
        showscale: false,
        xgap: 2,
        ygap: 2,
        texttemplate: "%{z:.1f}",
        textfont: { size: 10, color: INK },
        hovertemplate: "%{x} %{y}: %{z:.1f}%<extra></extra>",
      } as Data,
    ];
    const layout: Partial<Layout> = {
      margin: { l: 8, r: 8, t: 8, b: 8 },
      xaxis: axis({ side: "top", showgrid: false }),
      yaxis: axis({ autorange: "reversed", showgrid: false, type: "category" }),
    };
    const table: ChartTable = {
      columns: ["Year", ...MONTHS],
      rows: () => years.map((y, i) => [y, ...values[i].map((v) => (v === null ? "–" : signed(v)))]),
    };
    return { data, layout, height: Math.max(200, years.length * 26 + 48), table };
  }, [report]);

  return <Plot data={data} layout={layout} height={height} label="Monthly returns by year" table={table} />;
}

/* ---------- Trade return distribution ---------- */

export function ReturnsHistogram({ report }: { report: Report }) {
  const { data, layout, table } = useMemo(() => {
    const gains = report.trades.filter((t) => t.ret > 0).map((t) => t.ret);
    const losses = report.trades.filter((t) => t.ret <= 0).map((t) => t.ret);
    const low = Math.floor(Math.min(0, ...losses));
    const high = Math.ceil(Math.max(0, ...gains)) + 1;
    const data: Data[] = [
      {
        type: "histogram",
        name: "Losers",
        x: losses,
        xbins: { start: low, end: 0, size: 1 },
        marker: { color: LOSS },
        hovertemplate: "%{x}%: %{y} trades<extra></extra>",
      },
      {
        type: "histogram",
        name: "Winners",
        x: gains,
        xbins: { start: 0, end: high, size: 1 },
        marker: { color: GAIN },
        hovertemplate: "%{x}%: %{y} trades<extra></extra>",
      },
    ];
    const layout: Partial<Layout> = {
      barmode: "overlay",
      bargap: 0.12,
      margin: { l: 8, r: 8, t: 8, b: 8 },
      xaxis: axis({ ticksuffix: "%", title: { text: "Trade return", font: { size: 12, color: INK_2 } } }),
      yaxis: axis({ title: { text: "Trades", font: { size: 12, color: INK_2 } } }),
    };
    // Same 1-point bins as the bars: losers fill [n, n+1) up to 0, winners (0, …).
    const table: ChartTable = {
      columns: ["Return", "Trades"],
      rows: () =>
        Array.from({ length: high - low }, (_, k) => low + k)
          .map((from) => {
            const count = report.trades.filter((t) =>
              from < 0
                ? t.ret >= from && (t.ret < from + 1 || (from === -1 && t.ret === 0))
                : t.ret > 0 && t.ret >= from && t.ret < from + 1,
            ).length;
            return [`${signed(from, 0)} to ${signed(from + 1, 0)}`, count];
          })
          .filter((row) => row[1] !== 0),
    };
    return { data, layout, table };
  }, [report]);

  return (
    <Plot data={data} layout={layout} height={260} label="Distribution of trade returns, winners and losers" table={table} />
  );
}

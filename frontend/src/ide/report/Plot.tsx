import { useEffect, useRef, useState } from "react";
import type { Config, Data, Layout } from "plotly.js";

type PlotlyModule = typeof import("./plotly").default;

// Plotly is large, so it loads only when a report is first opened.
let plotlyPromise: Promise<PlotlyModule> | null = null;
function loadPlotly() {
  plotlyPromise ??= import("./plotly").then((m) => m.default);
  return plotlyPromise;
}

/** Chart ink comes from the same tokens as the page, so the two can't drift apart. */
function token(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const INK = token("--ink", "#111111");
export const INK_2 = token("--ink-2", "#444447");
export const INK_3 = token("--ink-3", "#66666b");
export const PAPER = token("--paper", "#ffffff");
export const GRID = "#eceef1";
const FONT = "Hanken Grotesk Variable, system-ui, sans-serif";

/** Below this width a chart switches to its narrow layout, if it has one. */
const NARROW = 520;

export function axis(extra: Record<string, unknown> = {}) {
  return {
    gridcolor: GRID,
    linecolor: GRID,
    zeroline: false,
    ticks: "" as const,
    tickfont: { size: 11, color: INK_3 },
    title: { font: { size: 12, color: INK_2 } },
    automargin: true,
    ...extra,
  };
}

const baseLayout: Partial<Layout> = {
  font: { family: FONT, size: 12, color: INK_2 },
  paper_bgcolor: PAPER,
  plot_bgcolor: PAPER,
  margin: { l: 8, r: 8, t: 8, b: 8 },
  showlegend: false,
  hoverlabel: {
    bgcolor: INK,
    bordercolor: INK,
    font: { family: FONT, size: 12, color: PAPER },
  },
};

// No scroll zoom: the page has to keep scrolling when the cursor passes over a chart.
const config: Partial<Config> = { displayModeBar: false, responsive: true, scrollZoom: false };

/** The numbers behind a chart, for anyone who'd rather read them than the picture. */
export type ChartTable = { columns: string[]; rows: () => (string | number)[][] };

type Props = {
  data: Data[];
  layout: Partial<Layout>;
  /** Overrides for narrow containers, such as dropping end labels for a legend. */
  narrowLayout?: Partial<Layout>;
  height: number;
  label: string;
  table?: ChartTable;
};

export function Plot({ data, layout, narrowLayout, height, label, table }: Props) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let plotly: PlotlyModule | null = null;
    let disposed = false;
    let narrow = node.clientWidth < NARROW;
    const draw = () =>
      plotly?.react(node, data, { ...baseLayout, ...layout, ...(narrow && narrowLayout), height }, config);
    loadPlotly().then((p) => {
      if (disposed) return;
      plotly = p;
      void draw();
    });
    const ro = new ResizeObserver(() => {
      if (!plotly) return;
      const now = node.clientWidth < NARROW;
      if (now !== narrow && narrowLayout) {
        narrow = now;
        void draw();
      } else if (node.offsetParent) {
        // Hidden charts (a closed tab, a collapsed pane) can't be resized; they redraw when shown.
        const done = plotly.Plots.resize(node) as unknown as Promise<void> | undefined;
        done?.catch(() => undefined);
      }
    });
    ro.observe(node);
    return () => {
      disposed = true;
      ro.disconnect();
      if (plotly) plotly.purge(node);
    };
  }, [data, layout, narrowLayout, height]);

  return (
    <div className="plot-figure">
      <div ref={el} className="plot" role="img" aria-label={label} style={{ height }} />
      {table && <ChartData label={label} table={table} />}
    </div>
  );
}

function ChartData({ label, table }: { label: string; table: ChartTable }) {
  // Rows are built only when someone opens the table; some charts have hundreds of trades.
  const [open, setOpen] = useState(false);
  return (
    <details className="chart-data" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Show the numbers</summary>
      {open && (
        <div className="chart-data__scroll" tabIndex={0} role="region" aria-label={`${label}: data`}>
          <table className="report-table report-table--data">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows().map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={j}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

/** Signed numbers with a true minus sign, as the labels print them. */
export function signed(v: number, digits = 1, suffix = "%") {
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 ? "−" : v > 0 ? "+" : ""}${s}${suffix}`;
}

export function dollars(v: number) {
  return `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

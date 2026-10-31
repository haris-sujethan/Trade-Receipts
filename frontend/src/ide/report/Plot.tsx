import { useEffect, useRef } from "react";
import type { Config, Data, Layout } from "plotly.js-dist-min";

type PlotlyModule = typeof import("plotly.js-dist-min").default;

// Plotly is large, so it loads only when a report is first opened.
let plotlyPromise: Promise<PlotlyModule> | null = null;
function loadPlotly() {
  plotlyPromise ??= import("plotly.js-dist-min").then((m) => m.default);
  return plotlyPromise;
}

export const INK = "#111111";
export const INK_2 = "#44444a";
export const INK_3 = "#66666b";
export const GRID = "#ececea";
const FONT = "Public Sans Variable, Public Sans, system-ui, sans-serif";

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
  paper_bgcolor: "#ffffff",
  plot_bgcolor: "#ffffff",
  margin: { l: 8, r: 8, t: 8, b: 8 },
  showlegend: false,
  hoverlabel: {
    bgcolor: INK,
    bordercolor: INK,
    font: { family: FONT, size: 12, color: "#ffffff" },
  },
};

// No scroll zoom: the page has to keep scrolling when the cursor passes over a chart.
const config: Partial<Config> = { displayModeBar: false, responsive: true, scrollZoom: false };

type Props = { data: Data[]; layout: Partial<Layout>; height: number; label: string };

export function Plot({ data, layout, height, label }: Props) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let plotly: PlotlyModule | null = null;
    let disposed = false;
    loadPlotly().then((p) => {
      if (disposed) return;
      plotly = p;
      p.react(node, data, { ...baseLayout, ...layout, height }, config);
    });
    const ro = new ResizeObserver(() => {
      if (plotly) plotly.Plots.resize(node);
    });
    ro.observe(node);
    return () => {
      disposed = true;
      ro.disconnect();
      if (plotly) plotly.purge(node);
    };
  }, [data, layout, height]);

  return <div ref={el} className="plot" role="img" aria-label={label} style={{ height }} />;
}

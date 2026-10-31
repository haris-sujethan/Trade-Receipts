import { useMemo } from "react";
import type { Data, Layout } from "plotly.js";
import { GROUP_COLOR, GROUP_LABEL, GROUPS, MAP_COLORED, type Group, type TokenCheck } from "../../data/tokens";
import { axis, INK, INK_2, PAPER, Plot, type ChartTable } from "./Plot";

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- The real chart: price, with volume split by who traded ---------- */

export function RealChart({ token }: { token: TokenCheck }) {
  const { data, layout, table } = useMemo(() => {
    const x = token.candles.map((_, i) => clock((i + 1) * token.candleSeconds));
    const price: Data = {
      type: "candlestick",
      name: "Market cap",
      x,
      open: token.candles.map((c) => c.o),
      high: token.candles.map((c) => c.h),
      low: token.candles.map((c) => c.l),
      close: token.candles.map((c) => c.c),
      // Ink candles, hollow when up and solid when down: shape carries direction, color stays free for wallet groups.
      increasing: { line: { color: INK, width: 1.2 }, fillcolor: PAPER },
      decreasing: { line: { color: INK, width: 1.2 }, fillcolor: INK },
      xaxis: "x",
      yaxis: "y",
      showlegend: false,
      hoverinfo: "x+y",
    } as Data;
    const sells: Data = {
      type: "scatter",
      mode: "markers",
      name: "Team sell",
      x: token.teamSells.map((s) => x[s.i]),
      y: token.teamSells.map((s) => token.candles[s.i].h * 1.06),
      text: token.teamSells.map((s) => `Team sold ${s.sol.toFixed(1)} SOL`),
      hovertemplate: "%{text}<extra></extra>",
      marker: { symbol: "triangle-down", size: 11, color: GROUP_COLOR.team, line: { color: INK, width: 1 } },
      xaxis: "x",
      yaxis: "y",
    };
    const bars: Data[] = GROUPS.map((g) => ({
      type: "bar",
      name: GROUP_LABEL[g],
      x,
      y: token.volume[g],
      marker: {
        color: GROUP_COLOR[g],
        line: { color: PAPER, width: 0.5 },
        // Likely team is hatched as well as colored, so it reads apart from the team without color.
        ...(g === "likelyTeam" ? { pattern: { shape: "/", fgcolor: PAPER, size: 5, solidity: 0.3 } } : {}),
      },
      hovertemplate: `${GROUP_LABEL[g]}: %{y:.1f} SOL<extra></extra>`,
      xaxis: "x",
      yaxis: "y2",
    }));
    // A launch bundle can dwarf every later candle. Cap the volume axis at the rest of the chart and label the
    // clipped bar with its real size, so the later trading stays readable.
    const totals = x.map((_, i) => GROUPS.reduce((sum, g) => sum + token.volume[g][i], 0));
    const rest = Math.max(...totals.slice(1));
    const clipped = totals[0] > rest * 2;
    const volumeTop = clipped ? rest * 1.35 : Math.max(...totals) * 1.1;
    // The legend is HTML above the chart (see TokenReport), so it wraps cleanly at any width.
    const layout: Partial<Layout> = {
      barmode: "stack",
      bargap: 0.18,
      hovermode: "x unified",
      margin: { l: 8, r: 8, t: 8, b: 8 },
      xaxis: axis({ anchor: "y2", type: "category", rangeslider: { visible: false }, nticks: 8 }),
      yaxis: axis({ domain: [0.42, 1], tickprefix: "$", ticksuffix: "K", title: { text: "Market cap", font: { size: 11, color: INK_2 } } }),
      yaxis2: axis({
        domain: [0, 0.34],
        range: [0, volumeTop],
        ticksuffix: " SOL",
        title: { text: "Volume", font: { size: 11, color: INK_2 } },
      }),
      annotations: clipped
        ? [
            {
              x: x[0],
              y: volumeTop,
              xref: "x",
              yref: "y2",
              text: `${totals[0].toFixed(0)} SOL ↑`,
              showarrow: false,
              xanchor: "left",
              yanchor: "top",
              xshift: 6,
              font: { size: 11, color: INK },
            },
          ]
        : [],
    };
    const table: ChartTable = {
      columns: ["Time", "Open", "High", "Low", "Close", ...GROUPS.map((g) => GROUP_LABEL[g]), "Team sell"],
      rows: () =>
        token.candles.map((c, i) => [
          x[i],
          `$${c.o}K`,
          `$${c.h}K`,
          `$${c.l}K`,
          `$${c.c}K`,
          ...GROUPS.map((g) => `${token.volume[g][i].toFixed(1)} SOL`),
          token.teamSells.some((s) => s.i === i) ? "Yes" : "",
        ]),
    };
    return { data: [price, sells, ...bars], layout, table };
  }, [token]);

  return (
    <Plot
      data={data}
      layout={layout}
      height={400}
      label={`${token.name}'s price with volume split by who traded`}
      table={table}
    />
  );
}

/* ---------- The bubble map ---------- */

function mapGroup(g: Group): Group | "other" {
  return MAP_COLORED.includes(g) ? g : "other";
}

export function BubbleMap({ token }: { token: TokenCheck }) {
  const { data, layout, table } = useMemo(() => {
    const byId = new Map(token.wallets.map((w) => [w.id, w]));
    const size = (share: number) => 7 + 15 * Math.sqrt(share / 1.6);

    const linkTrace = (kind: "team" | "likely"): Data => {
      const xs: (number | null)[] = [];
      const ys: (number | null)[] = [];
      for (const l of token.links.filter((k) => k.kind === kind)) {
        const a = byId.get(l.a);
        const b = byId.get(l.b);
        if (!a || !b) continue;
        xs.push(a.x, b.x, null);
        ys.push(a.y, b.y, null);
      }
      return {
        type: "scatter",
        mode: "lines",
        name: kind === "team" ? "Team link" : "Likely-team link",
        x: xs,
        y: ys,
        hoverinfo: "skip",
        showlegend: false,
        line:
          kind === "team"
            ? { color: GROUP_COLOR.team, width: 1.2 }
            : { color: GROUP_COLOR.likelyTeam, width: 1.4, dash: "dot" },
        opacity: 0.7,
      };
    };

    const nodes = (filter: (g: Group | "other", fresh: boolean) => boolean, name: string, color: string, hollow: boolean): Data => {
      const ws = token.wallets.filter((w) => w.role !== "funder" && filter(mapGroup(w.group), !!w.fresh));
      return {
        type: "scatter",
        mode: "markers",
        name,
        x: ws.map((w) => w.x),
        y: ws.map((w) => w.y),
        text: ws.map(
          (w) =>
            `${w.role === "creator" ? "Creator · " : ""}${w.id}<br>${GROUP_LABEL[w.group]} · ${w.share.toFixed(2)}% of supply${w.fresh ? "<br>Under a day old" : ""}`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          size: ws.map((w) => size(w.share)),
          color: hollow ? PAPER : color,
          line: { color: hollow ? color : PAPER, width: hollow ? 1.6 : 1.5 },
          opacity: 0.95,
        },
      };
    };

    const funder = token.wallets.find((w) => w.role === "funder");
    const creator = token.wallets.find((w) => w.role === "creator");
    const marks: Data[] = [];
    if (funder) {
      marks.push({
        type: "scatter",
        mode: "text+markers",
        name: "Funder",
        x: [funder.x],
        y: [funder.y],
        text: ["Funder"],
        textposition: "bottom center",
        textfont: { size: 11, color: INK },
        hovertemplate: `Funder ${funder.id}<br>Sent SOL to 14 team wallets<extra></extra>`,
        marker: { size: 12, symbol: "diamond", color: INK, line: { color: PAPER, width: 1.5 } },
        showlegend: false,
      });
    }
    if (creator) {
      marks.push({
        type: "scatter",
        mode: "text",
        x: [creator.x],
        y: [creator.y],
        text: ["Creator"],
        textposition: "top center",
        textfont: { size: 11, color: INK },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    const data: Data[] = [
      linkTrace("team"),
      linkTrace("likely"),
      nodes((g, fresh) => g === "other" && !fresh, "Everyone else", "#a9a9ae", false),
      nodes((g, fresh) => g === "other" && fresh, "Everyone else, under a day old", "#7d7d83", true),
      nodes((g) => g === "sniper", GROUP_LABEL.sniper, GROUP_COLOR.sniper, false),
      nodes((g) => g === "likelyTeam", GROUP_LABEL.likelyTeam, GROUP_COLOR.likelyTeam, false),
      nodes((g) => g === "team", GROUP_LABEL.team, GROUP_COLOR.team, false),
      ...marks,
    ];
    const layout: Partial<Layout> = {
      margin: { l: 4, r: 4, t: 4, b: 4 },
      hovermode: "closest",
      xaxis: { visible: false, range: [-1.08, 1.08], fixedrange: true },
      yaxis: { visible: false, range: [-1.05, 1.05], scaleanchor: "x", scaleratio: 1, fixedrange: true },
      annotations: token.notes.map((n) => ({
        x: n.x,
        y: n.y,
        text: n.text,
        showarrow: false,
        font: { size: 11, color: INK },
        bgcolor: "rgba(255,255,255,0.85)",
      })),
    };
    const table: ChartTable = {
      columns: ["Wallet", "Group", "Share of supply", "Under a day old"],
      rows: () =>
        [...token.wallets]
          .filter((w) => w.role !== "funder")
          .sort((a, b) => b.share - a.share)
          .map((w) => [
            `${w.role === "creator" ? "Creator · " : ""}${w.id}`,
            GROUP_LABEL[w.group],
            `${w.share.toFixed(2)}%`,
            w.fresh ? "Yes" : "",
          ]),
    };
    return { data, layout, table };
  }, [token]);

  return <Plot data={data} layout={layout} height={460} label={`Who holds ${token.name}: wallets sized by share, with links between them`} table={table} />;
}

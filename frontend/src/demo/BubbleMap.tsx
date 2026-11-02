import { useMemo, useState } from "react";
import { NODE_LABEL, NODE_SWATCH, swatchVar } from "./groups";
import { layoutMap } from "./layout";
import { pct, shortAddr, type MapFunder, type MapLink, type MapNode } from "./runs";

type Props = {
  nodes: MapNode[];
  links: MapLink[];
  /** Wallets that funded two or more holders, drawn as hubs. */
  funders?: MapFunder[];
  width: number;
  height: number;
  /** Share of wallets drawn so far, in the order they first bought (0–1). */
  appear?: number;
  /** How far the links have drawn (0–1). */
  linkDraw?: number;
  /** Which groups have their color yet: none while scanning, the team once funders are traced, then everyone. */
  color?: "none" | "team" | "all";
  /** The team's whole share from the check, which counts team wallets too small to draw. */
  teamShare?: number;
  /** Small copies drop the labels and the hover layer. */
  compact?: boolean;
  label?: string;
};

export function BubbleMap({ nodes, links, funders, width, height, appear = 1, linkDraw = 1, color = "all", teamShare, compact, label }: Props) {
  const map = useMemo(() => layoutMap(nodes, links, width, height, funders), [nodes, links, width, height, funders]);
  const order = useMemo(() => {
    const ranked = [...map.nodes].sort((a, b) => (a.first_buy_s ?? 1e9) - (b.first_buy_s ?? 1e9));
    return new Map(ranked.map((n, i) => [n.wallet, i]));
  }, [map]);
  const [hover, setHover] = useState<string | null>(null);
  const visibleCount = Math.ceil(appear * map.nodes.length);
  const creator = map.nodes.find((n) => n.hub === "creator");
  const team = map.nodes.filter((n) => n.group === "team" && n.share > 0 && !n.hub);
  const teamTotal = teamShare ?? team.reduce((s, n) => s + n.share, 0);
  const tied = map.nodes.filter((n) => n.linked);
  const teamCenter = team.length
    ? { x: team.reduce((s, n) => s + n.x, 0) / team.length, y: Math.min(...tied.map((n) => n.y - n.r)) }
    : null;
  const hovered = hover ? map.nodes.find((n) => n.wallet === hover) : null;

  const fillOf = (group: MapNode["group"]) => {
    const sw = NODE_SWATCH[group];
    if (color === "all" || (color === "team" && (sw === "team" || sw === "likely"))) return swatchVar(sw);
    return "var(--map-pending)";
  };

  return (
    <div className="bmap" style={{ aspectRatio: `${width} / ${height}` }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? "Bubble map of the token's holders"}>
        <g className="bmap__links">
          {map.links.map((l, i) => {
            const len = Math.hypot(l.t.x - l.s.x, l.t.y - l.s.y);
            return (
              <line
                key={i}
                x1={l.s.x}
                y1={l.s.y}
                x2={l.t.x}
                y2={l.t.y}
                className={`bmap__link bmap__link--${l.kind}`}
                style={{ strokeDasharray: l.kind === "same_exchange" ? "2 4" : `${len} ${len}`, strokeDashoffset: l.kind === "same_exchange" ? 0 : len * (1 - linkDraw), opacity: linkDraw > 0 ? 1 : 0 }}
              />
            );
          })}
        </g>
        <g>
          {map.nodes.map((n) => {
            // Hubs that hold nothing appear with their links; holders appear as they're traced.
            const pureHub = n.hub && n.share === 0;
            const shown = n.hub === "creator" || (pureHub ? linkDraw > 0 : (order.get(n.wallet) ?? 0) < visibleCount);
            return (
              <circle
                key={n.wallet}
                cx={n.x}
                cy={n.y}
                r={pureHub ? (n.hub === "creator" ? (compact ? 3.5 : 5) : compact ? 2.2 : 3.2) : n.r}
                className={`bmap__node${pureHub ? ` bmap__node--hub` : ""}${n.sold_out && !pureHub ? " bmap__node--out" : ""}`}
                style={{ fill: pureHub ? "var(--color-ink)" : fillOf(n.group), opacity: shown ? 1 : 0, transform: shown ? "scale(1)" : "scale(0.4)", transformOrigin: `${n.x}px ${n.y}px` }}
                onPointerEnter={compact ? undefined : () => setHover(n.wallet)}
                onPointerLeave={compact ? undefined : () => setHover(null)}
              />
            );
          })}
        </g>
        {!compact && creator && linkDraw > 0.2 && (
          <text x={creator.x} y={creator.y + 20} className="bmap__label" textAnchor="middle">
            Creator
          </text>
        )}
        {!compact && teamCenter && color !== "none" && (
          <text x={teamCenter.x} y={Math.max(14, teamCenter.y - 8)} className="bmap__label bmap__label--strong" textAnchor="middle">
            Team {pct(teamTotal)}
          </text>
        )}
      </svg>
      {hovered && (
        <div className="bmap__tip" style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%` }}>
          <span className="mono">{shortAddr(hovered.wallet)}</span>
          <span>
            {hovered.hub === "creator" ? "Creator" : hovered.hub === "funder" && hovered.share === 0 ? "Funded 2 or more holders" : NODE_LABEL[hovered.group]}
            {hovered.share > 0 && `, ${pct(hovered.share, 2)} of supply`}
          </span>
          {hovered.first_buy_s != null && <span>First bought {Math.round(hovered.first_buy_s)} s after launch</span>}
        </div>
      )}
    </div>
  );
}

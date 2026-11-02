import type { MapFunder, MapLink, MapNode } from "./runs";

export type Hub = "creator" | "funder";
export type Placed = MapNode & { x: number; y: number; r: number; linked: boolean; hub?: Hub };
export type PlacedLink = { kind: MapLink["kind"] | "funds"; s: Placed; t: Placed };

/** Linked wallets gather on the left, everyone else in a cloud on the right. */
const HUB_X = -190;
const CLOUD_X = 120;

/**
 * Lays out a run's bubble map, the same every time for the same run. Each hub (the creator, and every wallet that
 * funded two or more holders) gets its funded wallets around it, so a team reads as spiders; everyone else settles
 * into a cloud by share. Bubbles are sized by share of supply, by area.
 */
export function layoutMap(nodes: MapNode[], links: MapLink[], w: number, h: number, funders: MapFunder[] = []) {
  const byWallet = new Map<string, Placed>();
  const radius = (share: number) => 3.2 + 34 * Math.sqrt(share);
  const add = (wallet: string, hub: Hub) => {
    const known = byWallet.get(wallet);
    if (known) {
      known.hub = known.hub ?? hub;
      return known;
    }
    // A hub can hold nothing now (often the creator, always a pure funder); it still belongs on the map.
    const p: Placed = {
      wallet,
      share: 0,
      group: "team",
      cluster: "team",
      sold_out: true,
      creator: hub === "creator",
      first_buy_s: null,
      x: 0,
      y: 0,
      r: radius(0),
      linked: true,
      hub,
    };
    byWallet.set(wallet, p);
    return p;
  };

  for (const n of nodes) byWallet.set(n.wallet, { ...n, x: 0, y: 0, r: radius(n.share), linked: false, hub: n.creator ? "creator" : undefined });

  const edges: PlacedLink[] = [];
  const hubWallets = new Set(funders.map((f) => f.wallet));
  for (const l of links) {
    // With funder hubs drawn, the pairwise shared-funder links and the hubs' own funding links would only repeat them.
    if (l.kind === "shared_funder" && funders.length) continue;
    if (l.kind === "funded" && hubWallets.has(l.source)) continue;
    const t = byWallet.get(l.target);
    if (!t) continue;
    edges.push({ kind: l.kind, s: l.kind === "launch_bundle" ? add(l.source, "creator") : byWallet.get(l.source) ?? add(l.source, "funder"), t });
  }
  for (const f of funders) {
    const hub = add(f.wallet, "funder");
    for (const target of f.funds) {
      const t = byWallet.get(target);
      if (t && t !== hub) edges.push({ kind: "funds", s: hub, t });
    }
  }
  for (const e of edges) e.s.linked = e.t.linked = true;

  const placed = [...byWallet.values()];
  // Hubs: the creator in the middle of the left side, funders on a ring around it.
  const hubs = placed
    .filter((n) => n.hub && edges.some((e) => e.s === n))
    .sort((a, b) => Number(b.hub === "creator") - Number(a.hub === "creator"));
  // The ring sits just outside the wallets the hubs funded, so spokes stay short and a shared team reads as one group.
  const funded = new Set(edges.filter((e) => hubs.includes(e.s) && !hubs.includes(e.t)).map((e) => e.t));
  const area = [...funded].reduce((sum, n) => sum + (n.r + 2) ** 2, 0);
  const ring = Math.max(46, Math.sqrt(area) * 1.15 + 16);
  const creatorFirst = hubs[0]?.hub === "creator";
  hubs.forEach((hub, i) => {
    if (i === 0 && creatorFirst) Object.assign(hub, { x: HUB_X, y: 0 });
    else {
      const k = creatorFirst ? i - 1 : i;
      const of = hubs.length - (creatorFirst ? 1 : 0);
      const a = (k / Math.max(1, of)) * Math.PI * 2 - Math.PI / 2;
      Object.assign(hub, { x: HUB_X + Math.cos(a) * ring, y: Math.sin(a) * ring });
    }
  });
  const isHub = new Set(hubs);

  const homeOf = new Map<Placed, Placed>();
  const fundedBy = new Map<Placed, number>();
  for (const e of edges) if (isHub.has(e.s) && !isHub.has(e.t)) fundedBy.set(e.t, (fundedBy.get(e.t) ?? 0) + 1);
  for (const hub of hubs) {
    const kids = edges.filter((e) => e.s === hub && !isHub.has(e.t) && (fundedBy.get(e.t) ?? 0) < 2).map((e) => e.t);
    const around = 26 + kids.reduce((s, k) => s + k.r, 0) / 2.6;
    kids.forEach((k, j) => {
      if (homeOf.has(k)) return;
      const a = (j / kids.length) * Math.PI * 2 - Math.PI / 2;
      k.x = hub.x + Math.cos(a) * around;
      k.y = hub.y + Math.sin(a) * around;
      homeOf.set(k, hub);
    });
  }
  // Wallets funded by several hubs belong to all of them: they start in the middle, packed by the collisions below.
  const shared = [...fundedBy.entries()].filter(([, c]) => c >= 2).map(([n]) => n);
  shared.forEach((n, i) => {
    const a = i * Math.PI * (3 - Math.sqrt(5));
    const d = 6 * Math.sqrt(i + 1);
    n.x = HUB_X + Math.cos(a) * d;
    n.y = Math.sin(a) * d;
  });

  // Linked wallets with no hub of their own (one wallet funding another) start beside their partner.
  for (const e of edges) {
    if (!isHub.has(e.s) && !homeOf.has(e.t) && !isHub.has(e.t)) {
      e.t.x = e.s.x + 20;
      e.t.y = e.s.y + 20;
    }
  }

  // Everyone else on a sunflower spiral, biggest holders nearest the middle.
  const rest = placed.filter((n) => !n.linked).sort((a, b) => b.share - a.share);
  const golden = Math.PI * (3 - Math.sqrt(5));
  rest.forEach((n, i) => {
    const d = 10 + 15 * Math.sqrt(i + 1);
    n.x = CLOUD_X + Math.cos(i * golden) * d * 1.25;
    n.y = Math.sin(i * golden) * d * 1.1;
  });

  // Settle: linked wallets keep near their hub, links act as springs, bubbles never overlap.
  for (let it = 0; it < 240; it++) {
    const cool = 1 - it / 240;
    for (const e of edges) {
      if (isHub.has(e.t) || (fundedBy.get(e.t) ?? 0) >= 2) continue;
      const dx = e.t.x - e.s.x;
      const dy = e.t.y - e.s.y;
      const d = Math.hypot(dx, dy) || 1;
      const rest = e.s.r + e.t.r * 2 + 24;
      const f = ((d - rest) / d) * 0.05 * cool;
      e.t.x -= dx * f;
      e.t.y -= dy * f;
    }
    for (const n of placed) {
      if (isHub.has(n)) continue;
      const home = (fundedBy.get(n) ?? 0) >= 2 ? undefined : homeOf.get(n);
      const pull = home ? 0.01 : n.linked ? 0.03 : 0.012;
      const cx = home ? home.x : n.linked ? HUB_X : CLOUD_X;
      const cy = home ? home.y : 0;
      n.x -= (n.x - cx) * pull * cool;
      n.y -= (n.y - cy) * pull * (home ? 1.4 : 0.9) * cool;
    }
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r + 2.5;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / d / 2;
        // Hubs are anchors: the other bubble moves.
        const wa = isHub.has(a) ? 0 : isHub.has(b) ? 2 : 1;
        const wb = 2 - wa;
        a.x -= dx * push * wa;
        a.y -= dy * push * wa;
        b.x += dx * push * wb;
        b.y += dy * push * wb;
      }
    }
  }

  // Close the gap: the cloud sits just right of the linked wallets.
  const cloud = placed.filter((n) => !n.linked);
  const tied = placed.filter((n) => n.linked);
  if (cloud.length && tied.length) {
    const shift = Math.max(...tied.map((n) => n.x + n.r)) + 30 - Math.min(...cloud.map((n) => n.x - n.r));
    for (const n of cloud) n.x += shift;
  }

  // Fit into the box.
  const pad = 14;
  const minX = Math.min(...placed.map((n) => n.x - n.r));
  const maxX = Math.max(...placed.map((n) => n.x + n.r));
  const minY = Math.min(...placed.map((n) => n.y - n.r));
  const maxY = Math.max(...placed.map((n) => n.y + n.r));
  const k = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const ox = (w - (maxX - minX) * k) / 2;
  const oy = (h - (maxY - minY) * k) / 2;
  for (const n of placed) {
    n.x = ox + (n.x - minX) * k;
    n.y = oy + (n.y - minY) * k;
    n.r *= k;
  }

  return { nodes: placed, links: edges };
}

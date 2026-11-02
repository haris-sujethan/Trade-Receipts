import type { ChartGroup, NodeGroup } from "./runs";

/**
 * Wallet groups as the saved runs name them, mapped onto the validated wallet palette (`--g-*`, in the order
 * `data/tokens.ts` keeps). Sniper bots and wash traders share the bot color; "other" shares the independent grey.
 */
export type Swatch = "team" | "likely" | "sniper" | "bot" | "fresh" | "independent";

export const NODE_SWATCH: Record<NodeGroup, Swatch> = {
  team: "team",
  "likely team": "likely",
  snipers: "sniper",
  "sniper bots": "bot",
  "wash traders": "bot",
  "fresh wallets": "fresh",
  independent: "independent",
  other: "independent",
};

export const CHART_SWATCH: Record<ChartGroup, Swatch> = {
  team: "team",
  "likely team": "likely",
  snipers: "sniper",
  "bots and wash trades": "bot",
  "fresh wallets": "fresh",
  independent: "independent",
  other: "independent",
};

/** Stack order for volume, suspicious groups first and independent buyers last. */
export const CHART_ORDER: ChartGroup[] = [
  "team",
  "likely team",
  "snipers",
  "bots and wash trades",
  "fresh wallets",
  "independent",
  "other",
];

export const SWATCH_LABEL: Record<Swatch, string> = {
  team: "Team",
  likely: "Likely team",
  sniper: "Snipers",
  bot: "Bots and wash traders",
  fresh: "Fresh wallets",
  independent: "Everyone else",
};

export const NODE_LABEL: Record<NodeGroup, string> = {
  team: "Team",
  "likely team": "Likely team",
  snipers: "Sniper",
  "sniper bots": "Sniper bot",
  "wash traders": "Wash trader",
  "fresh wallets": "Fresh wallet",
  independent: "Independent",
  other: "Other",
};

export const swatchVar = (s: Swatch) => `var(--g-${s})`;

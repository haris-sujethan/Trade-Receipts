/**
 * Saved rug checks, replayed on the home page. The backend saves each run as the agent streamed it
 * (`data/demo/<mint>_900.json`); `scripts/copy-demo.mjs` copies them into `public/demo/` for the static site.
 */

export type RunSummary = {
  id: string;
  mint: string;
  age_s: number;
  /** What happened to the token after the check, e.g. "rugged 7.7 hours later". */
  about: string;
  symbol: string | null;
  verdict: Verdict | null;
  rug_chance: number | null;
  clip: string | null;
};

export type Verdict = "Likely rug" | "Possible rug" | "Unlikely rug";

/** A claim the clip made, word for word, with the second it was shown or said. */
export type Claim = { quote: string; at_s: number | null };

export type StepEvent = {
  type: "step";
  tool: "read_address" | "check_token" | "token_security" | "find_token" | string;
  status: "running" | "done" | "error";
  summary?: string;
  ms?: number;
  args?: Record<string, unknown>;
  /** read_address only, when the run carries it: what the agent read from the clip. */
  result?: { mint?: string | null; ticker?: string | null; claims?: Claim[] };
};

export type ProgressEvent = {
  type: "progress";
  tool: string;
  step: "token" | "wallets" | "busy" | "funders" | "snipes";
  transactions?: number;
  scanned?: number;
  checked?: number;
  of?: number;
  lookups?: number;
  sniper_bots?: number;
};

export type NodeGroup =
  | "team"
  | "likely team"
  | "snipers"
  | "sniper bots"
  | "wash traders"
  | "fresh wallets"
  | "independent"
  | "other";

export type ChartGroup = "team" | "likely team" | "snipers" | "bots and wash trades" | "fresh wallets" | "independent" | "other";

export type MapNode = {
  wallet: string;
  share: number;
  group: NodeGroup;
  cluster: string;
  sold_out: boolean;
  creator: boolean;
  first_buy_s: number | null;
};

export type MapLink = { source: string; target: string; kind: "launch_bundle" | "funded" | "shared_funder" | "same_exchange" };

/** A wallet that directly funded two or more wallets on the map (never an exchange or bot hub). */
export type MapFunder = { wallet: string; funds: string[] };

export type Candle = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: Partial<Record<ChartGroup, { buy_sol: number; sell_sol: number }>>;
};

export type Similar = {
  mint: string;
  ended: "rugged" | "faded" | "survived";
  rugged_after_s: number | null;
  mcap_sol: number;
  holders: number;
  team_share: number;
  link: string;
};

export type Check = {
  mint: string;
  name: string;
  symbol: string;
  age_s: number;
  as_of: number;
  status: string;
  verdict: Verdict;
  trees_rug_chance: number;
  creator: string;
  transactions_read: number;
  traced_wallets: number;
  glimmer: { rug_chance: number; model: string } | null;
  signals: Record<string, number | boolean | null>;
  chart: {
    candle_s: number;
    candles: Candle[];
    team_sells: { t: number; sol: number; mcap_sol: number; wallet: string }[];
    independent_buy_share: number;
    team_value_sol: number;
    mcap_sol: number;
  };
  bubble_map: { nodes: MapNode[]; links: MapLink[]; funders?: MapFunder[] };
  similar: Similar[];
  copycats: { total: number; tokens: { mint: string; name: string; symbol: string; age_s: number }[] };
  /** The most repeated exact buy sizes: how many buys, from how many wallets. */
  same_size_buys?: { sol: number; count: number; wallets: number }[];
};

export type AnswerEvent = {
  type: "answer";
  text: string;
  audit: { numbers: number; passed: boolean; first_try_passed: boolean; unverified: string[] };
  check: Check;
};

export type RunEvent = StepEvent | ProgressEvent | AnswerEvent;

export type Run = {
  id: string;
  mint: string;
  age_s: number;
  about: string;
  message: string;
  clip: string | null;
  events: RunEvent[];
  /** Hindsight, kept apart from what the agent saw: the market cap after the check, and when it rugged. */
  after?: { candle_s: number; candles: { t: number; close: number }[]; rug_s: number | null };
};

const BASE = `${import.meta.env.BASE_URL}demo/`;

export async function loadRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${BASE}index.json`);
  if (!res.ok) throw new Error(`No saved runs (${res.status})`);
  return res.json();
}

const cache = new Map<string, Promise<Run>>();

export function loadRun(id: string): Promise<Run> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${BASE}${id}.json`).then((res) => {
      if (!res.ok) throw new Error(`Couldn't load the run (${res.status})`);
      return res.json().then((run: Omit<Run, "id">) => ({ ...run, id }));
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export const clipUrl = (name: string) => `${BASE}${name}`;

export function answerOf(run: Run): AnswerEvent | undefined {
  return run.events.find((e): e is AnswerEvent => e.type === "answer");
}

/* ---------- Formatting ---------- */

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const whole = (v: number) => Math.round(v).toLocaleString("en-US");
export const sol = (v: number) => `${v >= 100 ? whole(v) : v.toFixed(1)} SOL`;
export const clipTime = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;
export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function hoursAfter(seconds: number) {
  return seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} h`;
}

/**
 * Saved runs, replayed on the home page and in the IDE. The backend saves each run as the agent streamed it: rug
 * checks as `data/demo/<mint>_900.json`, copy-trade backtests as `data/demo/copy_<wallet>.json`.
 * `scripts/copy-demo.mjs` copies them into `public/demo/` for the static site.
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
  /** A rug check's: token, wallets, busy, funders, snipes. A copy-trade backtest's: wallet, positions, or reused (the
   * wallet's data was pulled by a run in the last 30 minutes). */
  step: "token" | "wallets" | "busy" | "funders" | "snipes" | "wallet" | "positions" | "reused";
  transactions?: number;
  scanned?: number;
  checked?: number;
  of?: number;
  done?: number;
  /** A copy-trade backtest's wallet step: closed positions found so far. */
  positions?: number;
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
  /** `covered` is false for tokens launched after the name-search history ends (mid-September 2026). */
  copycats?: { total: number; covered?: boolean; tokens: { mint: string; name: string; symbol: string; age_s: number }[] };
  /** The most repeated exact buy sizes: how many buys, from how many wallets. */
  same_size_buys?: { sol: number; count: number; wallets: number }[];
};

/* ---------- Copy-trade backtests (backend/receipts/crypto/copytrade.py) ---------- */

/** What someone spent and got back, in SOL. `pnl_pct` is null when nothing was spent. */
export type Result = { spent_sol: number; got_sol: number; pnl_sol: number; pnl_pct: number | null };

/** One fill: the wallet's own, or the copier's a delay later. Prices are market caps in SOL. */
export type Fill = { t: number; side: "buy" | "sell"; mcap_sol: number; sol: number; rest?: boolean };

/** How far the price moved in the copier's delay after the wallet's first buy, or after its last sell. */
export type AfterEffect = { mcap_after: number | null; change: number | null };

export type Position = {
  mint: string;
  name: string | null;
  symbol: string | null;
  first_buy_ts: number;
  last_sell_ts: number;
  held_s: number;
  buys: number;
  sells: number;
  wallet: Result;
  you: Result & { fee_rate: number; trades: Fill[] };
  after_buy: AfterEffect & { mcap_at_buy: number };
  after_sell: AfterEffect & { mcap_at_sell: number };
  /** The token's trades over the position and the delays, thinned to about 120 points. */
  price_path: { t: number; mcap_sol: number }[];
  wallet_fills: Fill[];
};

export type Totals = { spent_sol: number; pnl_sol: number; pnl_pct: number | null; won: number };

export type CopyTrade = {
  wallet: string;
  buy_after_s: number;
  sell_after_s: number;
  size_sol: number;
  /** Closed positions copied, one per token; fewer than `positions_wanted` when the history read had no more. */
  positions: number;
  positions_wanted?: number;
  /** What the run is based on: the wallet's transactions read, from when to when, and whether that's all of them. */
  history?: { transactions: number; from_ts: number | null; to_ts: number | null; complete: boolean; hours: number | null };
  /** True when the wallet's positions and prices came from a run in the last 30 minutes: no new reads. */
  reused_data?: boolean;
  skipped: { still_open: number; bought_before_history: number; not_sol_priced: number; no_prices: number };
  wallet_total: Totals;
  you_total: Totals;
  /** The latest closed positions, newest first. */
  rows: Position[];
  notes: string[];
};

/** What a copy-trade backtest is asked: the wallet (an address or a pump.fun profile link), the timing, the size, and
 * how many of its latest closed positions to copy (1 to 100). */
export type CopyRequest = { wallet: string; buy_after_s: number; sell_after_s: number; size_sol: number; positions: number };

export type CopySummary = {
  id: string;
  wallet: string;
  message: string;
  saved_at: number;
  buy_after_s: number | null;
  sell_after_s: number | null;
  size_sol: number | null;
  positions: number | null;
};

export type AnswerEvent = {
  type: "answer";
  text: string;
  audit: { numbers: number; passed: boolean; first_try_passed: boolean; unverified: string[] };
  /** The rug check behind the answer, or null when the agent ran something else (a copy-trade backtest). */
  check: Check | null;
  copy_trade?: CopyTrade | null;
  /** The model that wrote the text, or null when Meta is off and the text is the check's own findings. */
  explained_by?: string | null;
  /** This answer's id: sent back as `context_id` with a follow-up, so it's answered from these results. */
  run_id?: string;
};

/** Something the backend wants the person to know while it works (a slow source, a limit close by). */
export type NoticeEvent = { type: "notice"; message: string };

export type RunEvent = StepEvent | ProgressEvent | AnswerEvent | NoticeEvent;

export type Run = {
  id: string;
  /** Saved copy-trade backtests say so; rug checks don't. */
  kind?: "copy_trade";
  /** A copy-trade backtest's wallet. */
  wallet?: string;
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

/** The saved copy-trade backtests. A build without any has no copy-index.json. */
export async function loadCopyRuns(): Promise<CopySummary[]> {
  const res = await fetch(`${BASE}copy-index.json`);
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) return [];
  return res.json();
}

const cache = new Map<string, Promise<Run>>();

export function loadRun(id: string): Promise<Run> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${BASE}${id}.json`).then((res) => {
      if (!res.ok) throw new Error(`Couldn't load the run (${res.status})`);
      // A saved copy-trade backtest has no token: give it a rug check's empty fields.
      return res.json().then((run: Partial<Run>) => ({ mint: "", age_s: 0, about: "", clip: null, message: "", events: [], ...run, id }));
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

/** A signed change: "+1.9%", "−57.9%". */
export const signedPct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;
export const signedSol = (v: number, digits = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)} SOL`;

/** A delay or a holding time: "8 s", "5 min", "1 min 30 s", "2 h". */
export function duration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function hoursAfter(seconds: number) {
  return seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} h`;
}

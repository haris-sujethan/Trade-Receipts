import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { TOUR_DONE_KEY } from "../config";
import { projectFiles, rsiOutput, rsiProblems, runs, type Problem, type ProjectFile } from "../data/examples";
import {
  answerOf,
  duration,
  loadCopyRuns,
  loadRun,
  loadRuns,
  shortAddr,
  type CopyRequest,
  type CopySummary,
  type CopyTrade,
  type Run,
  type RunEvent,
  type RunSummary,
} from "../demo/runs";
import { streamAgent, streamCopyTrade, type Streamed } from "./live";

/** The rug check, and the copy-trade backtest. Strategy backtests (files, results) are unplugged for now. */
export type WorkTab = "Analyze" | "Copy trade";

/**
 * A tab is a rug check ("check:<key>") or a copy-trade backtest ("copy:<key>"). The unplugged strategy backtests used
 * file ids ("rsi") and their results ("results:rsi").
 * Run keys: "saved:<runId>" opens a saved run finished; "replay:<n>" replays one in the thread; "live:<n>" is a
 * run the backend is doing now.
 */
export type TabId = string;

/** A screenshot or clip sent with a message, as a data URL. */
export type Attachment = { kind: "image" | "video"; dataUrl: string; name: string };
/** One earlier message in the thread, sent with a follow-up so the agent has the context. */
export type Turn = { role: "user" | "assistant"; text: string };

/**
 * A run the IDE knows about: a rug check or a copy-trade backtest, saved (replayed or finished) or live. Live runs go
 * through the agent, or straight to the copy-trade backtest from its form.
 */
export type CheckRun = {
  key: string;
  run: Run;
  mode: "replay" | "live";
  via?: "agent" | "copytrade";
  /** A copy-trade backtest run from its form: what was asked, and the result once it's in. */
  request?: CopyRequest;
  copy?: CopyTrade;
  /** Live checks: the thread before this message, and what was attached. */
  history?: Turn[];
  attachment?: Attachment;
  /** performance.now() when a replay started; -Infinity shows it finished. */
  startedAt: number;
  status: "waiting" | "running" | "done" | "error";
  error?: string;
};

export type ThreadItem = { kind: "user"; text: string; attached?: string } | { kind: "agent"; text: string } | { kind: "check"; key: string };
export type UserThread = { id: number; title: string; items: ThreadItem[] };
/** The two example threads (the replayed rug check and copy-trade backtest), then threads started in this session. */
export type ThreadRef = "rug" | "copy" | number;

/** The example threads' runs. */
export const HERO_KEY = "replay:hero";
export const COPY_HERO_KEY = "replay:copyhero";

type State = {
  workTab: WorkTab;
  openTabs: TabId[];
  active: TabId | null;
  split: boolean;
  bottomTab: "problems" | "output";
  /** Backtest example runs that have finished in this session. */
  ranRuns: string[];
  running: string | null;
  /** The saved checks, lead first. */
  saved: RunSummary[];
  /** The saved copy-trade backtests. */
  savedCopies: CopySummary[];
  checks: Record<string, CheckRun>;
  /** A view picked by hand in a check's tab; otherwise the tab follows the check. */
  checkViews: Record<string, "overview" | "chart" | "holders" | "signals">;
  tourOpen: boolean;
  /** Goes up each time the tour starts, so the tour starts from step one. */
  tourRun: number;
  /** Goes up each time the visitor opens something, so narrow screens can show it. */
  openSeq: number;
  draft: string;
  threads: UserThread[];
  thread: ThreadRef;
  /** Numbers new replays and live checks. */
  seq: number;
};

type Action =
  | { type: "open"; id: TabId }
  | { type: "close"; id: TabId }
  | { type: "workTab"; tab: WorkTab }
  | { type: "split" }
  | { type: "bottomTab"; tab: State["bottomTab"] }
  | { type: "runStart"; runId: string }
  | { type: "runDone"; runId: string }
  | { type: "saved"; saved: RunSummary[]; hero: Run | null }
  | { type: "savedCopies"; copies: CopySummary[]; hero: Run | null }
  | { type: "openSavedCopy"; key: string; run: Run }
  | { type: "copyStart"; request: CopyRequest }
  | { type: "startHero" }
  | { type: "finishCheck"; key: string }
  | { type: "openSaved"; key: string; run: Run }
  | { type: "checkView"; key: string; view: State["checkViews"][string] }
  | { type: "liveEvent"; key: string; event: Streamed }
  | { type: "liveEnd"; key: string }
  | { type: "closeTour" }
  | { type: "restartTour" }
  | { type: "draft"; text: string }
  | { type: "send"; reply: Reply }
  | { type: "newThread" }
  | { type: "selectThread"; thread: ThreadRef };

/** What the IDE does with a sent message, decided before it reaches the reducer (see `replyFor`). */
export type Reply = { kind: "replay"; run: Run } | { kind: "live"; attachment?: Attachment } | { kind: "text"; text: string };

export const LIVE_SOON =
  "Live checks are coming soon. This preview replays six saved checks: paste one of their pump.fun links, tickers or addresses, or open one from the checks folder.";

export function copySoon(saved: CopySummary[]) {
  const one = saved[0];
  return one
    ? `Live copy-trade backtests are coming soon. This preview replays a saved one: paste its wallet, ${one.wallet}, or open it from the copy trades folder.`
    : "Live copy-trade backtests are coming soon.";
}

function readDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function demoState(): State {
  return {
    workTab: "Analyze",
    openTabs: [],
    active: null,
    split: false,
    bottomTab: "problems",
    ranRuns: [],
    running: null,
    saved: [],
    savedCopies: [],
    checks: {},
    checkViews: {},
    tourOpen: true,
    tourRun: 0,
    openSeq: 0,
    draft: "",
    threads: [],
    thread: "rug",
    seq: 0,
  };
}

function initialState(): State {
  return { ...demoState(), tourOpen: !readDone() };
}

/** The mode that matches what a tab shows. */
function modeOf(id: TabId): WorkTab | null {
  if (id.startsWith("check:")) return "Analyze";
  if (id.startsWith("copy:")) return "Copy trade";
  return null;
}

function withTab(s: State, id: TabId): State {
  const openTabs = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
  return { ...s, openTabs, active: id, workTab: modeOf(id) ?? s.workTab };
}

function titleFrom(text: string) {
  return text.length > 44 ? `${text.slice(0, 43).trimEnd()}…` : text;
}

const savedCheck = (run: Run, key: string): CheckRun => ({ key, run, mode: "replay", startedAt: Number.NEGATIVE_INFINITY, status: "done" });

/** The tab a run opens in. */
export const tabOf = (c: CheckRun) => `${isCopyRun(c) ? "copy" : "check"}:${c.key}`;

/** Starts an example replay that hasn't played yet, and opens it. */
function startReplay(s: State, key: string): State {
  const c = s.checks[key];
  if (!c || c.status !== "waiting") return s;
  const checks = { ...s.checks, [key]: { ...c, startedAt: performance.now(), status: "running" as const } };
  return { ...withTab({ ...s, checks }, tabOf(c)), openSeq: s.openSeq + 1 };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "open":
      return { ...withTab(s, a.id), openSeq: s.openSeq + 1 };
    case "close": {
      const openTabs = s.openTabs.filter((t) => t !== a.id);
      const active = s.active === a.id ? (openTabs[openTabs.length - 1] ?? null) : s.active;
      return { ...s, openTabs, active, workTab: (active && modeOf(active)) || s.workTab };
    }
    case "workTab": {
      if (a.tab === s.workTab) return s;
      // The example threads follow the mode; threads of your own stay put.
      s = typeof s.thread === "number" ? s : { ...s, thread: a.tab === "Copy trade" ? "copy" : "rug" };
      const fits = (id: TabId) => modeOf(id) === a.tab;
      if (s.active && fits(s.active)) return { ...s, workTab: a.tab };
      // Show the most recent tab of that kind, or the matching example (the copy-trade one plays the first time).
      const recent = [...s.openTabs].reverse().find(fits);
      if (!recent && a.tab === "Copy trade" && s.checks[COPY_HERO_KEY]?.status === "waiting") return startReplay({ ...s, workTab: a.tab }, COPY_HERO_KEY);
      const example = a.tab === "Analyze" ? HERO_KEY : COPY_HERO_KEY;
      const target = recent ?? (s.checks[example] ? tabOf(s.checks[example]) : null);
      return target ? { ...withTab(s, target), openSeq: s.openSeq + 1 } : { ...s, workTab: a.tab };
    }
    case "split":
      return { ...s, split: !s.split };
    case "bottomTab":
      return { ...s, bottomTab: a.tab };
    case "runStart":
      return { ...s, running: a.runId };
    case "runDone": {
      const ranRuns = s.ranRuns.includes(a.runId) ? s.ranRuns : [...s.ranRuns, a.runId];
      return { ...withTab({ ...s, running: null, ranRuns }, `results:${a.runId}`), openSeq: s.openSeq + 1 };
    }
    case "saved": {
      const checks = { ...s.checks };
      if (a.hero && !checks[HERO_KEY]) {
        // Without the tour, the example thread arrives finished, its check open.
        checks[HERO_KEY] = s.tourOpen
          ? { key: HERO_KEY, run: a.hero, mode: "replay", startedAt: Number.NEGATIVE_INFINITY, status: "waiting" }
          : savedCheck(a.hero, HERO_KEY);
      }
      const next = { ...s, saved: a.saved, checks };
      return a.hero && !s.tourOpen && !s.active ? withTab(next, `check:${HERO_KEY}`) : next;
    }
    case "savedCopies": {
      // The copy-trade example waits until the mode is first opened, then plays.
      const checks =
        a.hero && !s.checks[COPY_HERO_KEY]
          ? { ...s.checks, [COPY_HERO_KEY]: { key: COPY_HERO_KEY, run: a.hero, mode: "replay" as const, startedAt: Number.NEGATIVE_INFINITY, status: "waiting" as const } }
          : s.checks;
      return { ...s, savedCopies: a.copies, checks };
    }
    case "openSavedCopy": {
      const checks = s.checks[a.key] ? s.checks : { ...s.checks, [a.key]: savedCheck(a.run, a.key) };
      return { ...withTab({ ...s, checks }, `copy:${a.key}`), openSeq: s.openSeq + 1 };
    }
    case "copyStart": {
      const seq = s.seq + 1;
      const key = `live:${seq}`;
      const run: Run = { id: key, mint: "", age_s: 0, about: "", message: "", clip: null, events: [], kind: "copy_trade", wallet: a.request.wallet };
      const c: CheckRun = { key, run, mode: "live", via: "copytrade", request: a.request, startedAt: performance.now(), status: "running" };
      return { ...withTab({ ...s, seq, checks: { ...s.checks, [key]: c } }, `copy:${key}`), openSeq: s.openSeq + 1 };
    }
    case "startHero": {
      const hero = s.checks[HERO_KEY];
      if (!hero || hero.status === "running") return s;
      const checks = { ...s.checks, [HERO_KEY]: { ...hero, startedAt: performance.now(), status: "running" as const } };
      return { ...withTab({ ...s, checks, thread: "rug", checkViews: omit(s.checkViews, HERO_KEY) }, `check:${HERO_KEY}`), openSeq: s.openSeq + 1 };
    }
    case "openSaved": {
      const checks = s.checks[a.key] ? s.checks : { ...s.checks, [a.key]: savedCheck(a.run, a.key) };
      return { ...withTab({ ...s, checks }, `check:${a.key}`), openSeq: s.openSeq + 1 };
    }
    case "finishCheck": {
      const c = s.checks[a.key];
      if (!c || c.mode !== "replay" || c.status === "done") return s;
      return { ...s, checks: { ...s.checks, [a.key]: { ...c, startedAt: Number.NEGATIVE_INFINITY, status: "done" } } };
    }
    case "checkView":
      return { ...s, checkViews: { ...s.checkViews, [a.key]: a.view } };
    case "liveEvent": {
      const c = s.checks[a.key];
      if (!c) return s;
      const e = a.event;
      if (e.type === "error") return { ...s, checks: { ...s.checks, [a.key]: { ...c, status: "error", error: e.message } } };
      if (e.type === "result") return { ...s, checks: { ...s.checks, [a.key]: { ...c, copy: e.copy_trade } } };
      // The backtest's own progress events don't name their tool; the agent's do.
      const event: RunEvent = e.type === "progress" && !e.tool ? { ...e, tool: "copy_trade" } : e;
      const run = { ...c.run, events: [...c.run.events, event] };
      const next = { ...s, checks: { ...s.checks, [a.key]: { ...c, run } } };
      // The run's tab opens as soon as the agent starts on the token, or on the wallet.
      const kind = event.type === "step" && event.status === "running" ? ({ check_token: "check", copy_trade: "copy" } as Record<string, string>)[event.tool] : undefined;
      const tab = kind && `${kind}:${a.key}`;
      return tab && !s.openTabs.includes(tab) ? { ...withTab(next, tab), openSeq: s.openSeq + 1 } : next;
    }
    case "liveEnd": {
      const c = s.checks[a.key];
      if (!c || c.status === "error") return s;
      return { ...s, checks: { ...s.checks, [a.key]: { ...c, status: "done" } } };
    }
    case "closeTour": {
      // Closing the tour, at any step, leaves the example finished on its check.
      const hero = s.checks[HERO_KEY];
      const checks = hero ? { ...s.checks, [HERO_KEY]: { ...hero, startedAt: Number.NEGATIVE_INFINITY, status: "done" as const } } : s.checks;
      const next = { ...s, checks, tourOpen: false };
      return hero ? withTab(next, `check:${HERO_KEY}`) : next;
    }
    case "restartTour": {
      const hero = s.checks[HERO_KEY];
      const checks = hero ? { ...s.checks, [HERO_KEY]: { ...hero, startedAt: Number.NEGATIVE_INFINITY, status: "waiting" as const } } : s.checks;
      return {
        ...demoState(),
        saved: s.saved,
        checks,
        threads: s.threads,
        draft: s.draft,
        seq: s.seq,
        tourRun: s.tourRun + 1,
      };
    }
    case "draft":
      return { ...s, draft: a.text };
    case "send": {
      const attachment = a.reply.kind === "live" ? a.reply.attachment : undefined;
      const text = s.draft.trim() || (attachment ? `Check the token in this ${attachment.kind === "video" ? "clip" : "screenshot"}.` : "");
      if (!text) return s;
      let threads = s.threads;
      let thread = s.thread;
      // The example threads are replays, so a new message starts a thread of your own.
      if (typeof thread !== "number") {
        thread = threads.length + 1;
        threads = [...threads, { id: thread, title: "", items: [] }];
      }
      const seq = s.seq + 1;
      let checks = s.checks;
      let added: ThreadItem;
      let open: string | null = null;
      if (a.reply.kind === "text") added = { kind: "agent", text: a.reply.text };
      else {
        const key = a.reply.kind === "replay" ? `replay:${seq}` : `live:${seq}`;
        // A replayed copy-trade backtest keeps its own message: its timing is the one it was saved with.
        const run: Run =
          a.reply.kind === "replay"
            ? { ...a.reply.run, message: a.reply.run.kind === "copy_trade" ? a.reply.run.message : text }
            : { id: key, mint: "", age_s: 0, about: "", message: text, clip: null, events: [] };
        const prior = threads.find((t) => t.id === thread)?.items ?? [];
        const history: Turn[] = prior.flatMap((m): Turn[] => {
          if (m.kind === "user") return [{ role: "user", text: m.text }];
          if (m.kind === "agent") return [{ role: "assistant", text: m.text }];
          const said = checks[m.key] && answerOf(checks[m.key].run)?.text;
          return said ? [{ role: "assistant", text: said }] : [];
        });
        checks = { ...checks, [key]: { key, run, mode: a.reply.kind, via: "agent", startedAt: performance.now(), status: "running", history, attachment } };
        added = { kind: "check", key };
        if (a.reply.kind === "replay") open = tabOf(checks[key]);
      }
      threads = threads.map((t) =>
        t.id === thread ? { ...t, title: t.title || titleFrom(text), items: [...t.items, { kind: "user", text, attached: attachment?.name }, added] } : t,
      );
      const next = { ...s, threads, thread, draft: "", checks, seq };
      return open ? { ...withTab(next, open), openSeq: s.openSeq + 1 } : next;
    }
    case "newThread": {
      const current = s.threads.find((t) => t.id === s.thread);
      if (current && current.items.length === 0) return s;
      const id = s.threads.length + 1;
      return { ...s, threads: [...s.threads, { id, title: "", items: [] }], thread: id };
    }
    case "selectThread":
      // The copy-trade example plays the first time it's picked.
      return a.thread === "copy" ? startReplay({ ...s, thread: a.thread }, COPY_HERO_KEY) : { ...s, thread: a.thread };
  }
}

function omit<T>(o: Record<string, T>, key: string) {
  const { [key]: _drop, ...rest } = o;
  void _drop;
  return rest;
}

/* ---------- Derived data ---------- */

export function fileById(id: string | null): ProjectFile | undefined {
  return projectFiles.find((f) => f.id === id);
}

/** The file a tab belongs to: a results tab belongs to the file that ran. */
export function fileOf(id: TabId | null): string | null {
  if (!id) return null;
  return id.startsWith("results:") ? id.slice(8) : id;
}

export function checkOf(state: State, id: TabId | null): CheckRun | undefined {
  if (!id?.startsWith("check:")) return undefined;
  const key = id.slice(6);
  if (state.checks[key]) return state.checks[key];
  return undefined;
}

/** The copy-trade backtest a "copy:<key>" tab shows. */
export function copyRunOf(state: State, id: TabId | null): CheckRun | undefined {
  return id?.startsWith("copy:") ? state.checks[id.slice(5)] : undefined;
}

/** Whether a run is a copy-trade backtest: saved as one, run from its form, or the agent called the backtest. */
export function isCopyRun(c: CheckRun): boolean {
  return c.via === "copytrade" || c.run.kind === "copy_trade" || c.run.events.some((e) => e.type === "step" && e.tool === "copy_trade");
}

/** A copy-trade backtest's result, once it's in (a replay carries it from the start). */
export function copyResultOf(c: CheckRun): CopyTrade | undefined {
  return c.copy ?? answerOf(c.run)?.copy_trade ?? undefined;
}

/** The result of a backtest that has finished: a replay only once it has played to the end. */
export function finishedCopyOf(c: CheckRun): CopyTrade | undefined {
  return c.copy ?? (c.status === "done" ? copyResultOf(c) : undefined);
}

/** What a copy-trade backtest was asked: from its form, the agent's call, or the result. */
export function copyRequestOf(c: CheckRun): CopyRequest | undefined {
  if (c.request) return c.request;
  const r = copyResultOf(c);
  if (r) return { wallet: r.wallet, buy_after_s: r.buy_after_s, sell_after_s: r.sell_after_s, size_sol: r.size_sol, positions: r.positions_wanted ?? r.positions };
  const step = c.run.events.find((e) => e.type === "step" && e.tool === "copy_trade" && e.status === "running");
  const args = step?.type === "step" ? step.args : undefined;
  if (!args) return undefined;
  return {
    wallet: String(args.wallet ?? ""),
    buy_after_s: Number(args.buy_after_seconds ?? 0),
    sell_after_s: Number(args.sell_after_seconds ?? 0),
    size_sol: 1,
    positions: Number(args.positions ?? COPY_POSITIONS),
  };
}

/** How many closed positions a backtest copies unless asked otherwise (receipts/crypto/copytrade.py, POSITIONS). */
export const COPY_POSITIONS = 50;

/** A short name for a copy-trade backtest: the wallet and the timing, "GeUn…UX1W, 5 min / 10 min", and the number of
 * positions when it isn't the usual 50. */
export function copyTitle(c: CheckRun): string {
  const q = copyRequestOf(c);
  if (!q?.wallet) return "New backtest";
  const n = q.positions !== COPY_POSITIONS ? `, ${q.positions} positions` : "";
  return `${shortAddr(q.wallet)}, ${duration(q.buy_after_s)} / ${duration(q.sell_after_s)}${n}`;
}

/** The check the panels describe: the one in the active tab, or the last one opened. */
export function focusCheck(state: State): CheckRun | undefined {
  const fromActive = checkOf(state, state.active);
  if (fromActive) return fromActive;
  const last = [...state.openTabs].reverse().find((t) => t.startsWith("check:"));
  return checkOf(state, last ?? null);
}

/** A check's flags, from the agent's own answer: the signals it listed as mattering, each a warning. */
export function checkProblems(c: CheckRun | undefined): Problem[] {
  if (!c || c.status !== "done") return [];
  const answer = answerOf(c.run);
  if (!answer) return [];
  const label = answer.check?.symbol ?? "Check";
  const lines = answer.text
    .split("\n")
    .filter((l) => /^[-*] /.test(l))
    .map((l) => l.replace(/^[-*] /, ""));
  const verdict: Problem[] = answer.check
    ? [
        {
          severity: answer.check.verdict === "Likely rug" ? "error" : answer.check.verdict === "Possible rug" ? "warning" : "info",
          file: label,
          message: `${answer.check.verdict}, ${Math.round(answer.check.trees_rug_chance * 100)}% rug chance`,
        },
      ]
    : [];
  return [...verdict, ...lines.map((message) => ({ severity: "warning" as const, file: label, message }))];
}

/** A copy-trade backtest's caveats: what it left out and what it doesn't model. Facts, not flags. */
export function copyProblems(c: CheckRun | undefined): Problem[] {
  const r = c && finishedCopyOf(c);
  if (!c || !r) return [];
  const file = shortAddr(r.wallet);
  const left: [number, string][] = [
    [r.skipped.not_sol_priced, "priced in something other than SOL"],
    [r.skipped.still_open, "still open"],
    [r.skipped.bought_before_history, "opened before the history read"],
    [r.skipped.no_prices, "with no trades to price them"],
  ];
  return [
    ...left.filter(([n]) => n > 0).map(([n, why]) => ({ severity: "info" as const, file, message: `Left out: ${n} ${n === 1 ? "token" : "tokens"} ${why}` })),
    ...r.notes.map((message) => ({ severity: "info" as const, file, message })),
  ];
}

/** A check's tool log, from its events. */
export function checkOutput(c: CheckRun | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  let last: Record<string, string> = {};
  for (const e of c.run.events) {
    if (e.type === "step") out.push(`${e.status === "running" ? "start" : e.status}  ${e.tool}${e.summary ? `  ${e.summary}` : ""}${e.ms != null ? `  ${e.ms} ms` : ""}`);
    if (e.type === "progress") {
      const line = {
        token: `${e.transactions} transactions read`,
        wallets: `${e.scanned} of ${e.of} wallets traced`,
        busy: `${e.checked} of ${e.of} busy wallets checked`,
        funders: `${e.scanned} of ${e.of} funders traced`,
        snipes: `${e.lookups} early buyers checked, ${e.sniper_bots} sniper bots`,
        wallet: `${e.transactions} of the wallet's transactions read${e.positions != null ? `, ${e.positions} closed positions found` : ""}`,
        positions: `${e.done} of ${e.of} positions priced`,
      }[e.step];
      last = { ...last, [e.step]: line };
      // One line per kind of progress: keep the latest count.
      const at = out.findIndex((l) => l.startsWith(`  ${e.step}`));
      const row = `  ${e.step.padEnd(8)}${line}`;
      if (at >= 0) out[at] = row;
      else out.push(row);
    }
    if (e.type === "answer") out.push(`answer  ${e.audit.numbers} numbers checked against the data${e.audit.passed ? "" : " (some failed)"}`);
  }
  if (c.copy) out.push(`result  ${c.copy.positions} closed positions copied`);
  if (c.status === "error" && c.error) out.push(`error  ${c.error}`);
  return out;
}

/** The panels describe what's in front: the open check or backtest, or else the last check. */
export function problemsFor(state: State): Problem[] {
  const active = checkOf(state, state.active);
  if (active) return checkProblems(active);
  const copy = copyRunOf(state, state.active);
  if (copy) return copyProblems(copy);
  const runs = state.ranRuns.flatMap((id) => (id === "rsi" ? rsiProblems : []));
  return runs.length ? runs : checkProblems(focusCheck(state));
}

export function outputFor(state: State): string[] {
  const active = checkOf(state, state.active) ?? copyRunOf(state, state.active);
  if (active) return checkOutput(active);
  const runs = state.ranRuns.flatMap((id) => (id === "rsi" ? rsiOutput : []));
  return runs.length ? runs : checkOutput(focusCheck(state));
}

export function hasRun(fileId: string): boolean {
  return fileId in runs;
}

export const exampleThreadTitle: Record<"rug" | "copy", string> = {
  rug: "Is this a rug?",
  copy: "What if I copied this wallet?",
};

export function threadTitle(state: State): string {
  if (typeof state.thread !== "number") return exampleThreadTitle[state.thread];
  return state.threads.find((t) => t.id === state.thread)?.title || "New thread";
}

/** Finds a saved check that a message names: its pump.fun link or address, or its ticker as a word. */
export function savedMatch(text: string, saved: RunSummary[]): RunSummary | undefined {
  const lower = text.toLowerCase();
  return (
    saved.find((r) => r.mint && text.includes(r.mint)) ??
    saved.find((r) => r.symbol && new RegExp(`(^|[^a-z0-9$])\\$?${r.symbol.toLowerCase()}([^a-z0-9]|$)`).test(lower))
  );
}

/** Finds a saved copy-trade backtest whose wallet a message names (its pump.fun profile link or address). */
export function savedCopyMatch(text: string, saved: CopySummary[]): CopySummary | undefined {
  return saved.find((r) => r.wallet && text.includes(r.wallet));
}

/* ---------- Context ---------- */

type Ctx = { state: State; dispatch: (a: Action) => void };
const IdeContext = createContext<Ctx | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // The saved checks, and the lead one in full for the example thread.
  useEffect(() => {
    let live = true;
    loadRuns()
      .then(async (saved) => {
        const hero = saved[0] ? await loadRun(saved[0].id) : null;
        if (live) dispatch({ type: "saved", saved, hero });
      })
      .catch(() => live && dispatch({ type: "saved", saved: [], hero: null }));
    loadCopyRuns()
      .then(async (copies) => {
        const hero = copies[0] ? await loadRun(copies[0].id) : null;
        if (live) dispatch({ type: "savedCopies", copies, hero });
      })
      .catch(() => live && dispatch({ type: "savedCopies", copies: [], hero: null }));
    return () => {
      live = false;
    };
  }, []);

  // Live checks: each streams from the backend once, its events landing on the check as they come.
  const started = useRef(new Set<string>());
  useEffect(() => {
    for (const c of Object.values(state.checks)) {
      if (c.mode !== "live" || c.status !== "running" || started.current.has(c.key)) continue;
      started.current.add(c.key);
      const onEvent = (event: Streamed) => dispatch({ type: "liveEvent", key: c.key, event });
      const streamed =
        c.via === "copytrade" && c.request ? streamCopyTrade(c.request, onEvent) : streamAgent(c.run.message, onEvent, { history: c.history, attachment: c.attachment });
      streamed.then(
        () => dispatch({ type: "liveEnd", key: c.key }),
        (err: Error) => dispatch({ type: "liveEvent", key: c.key, event: { type: "error", message: `Couldn't reach the backend: ${err.message}` } }),
      );
    }
  }, [state.checks]);

  // Replaying an example backtest run.
  useEffect(() => {
    if (!state.running) return;
    const runId = state.running;
    const t = window.setTimeout(() => dispatch({ type: "runDone", runId }), 1400);
    return () => window.clearTimeout(t);
  }, [state.running]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const ctx = useContext(IdeContext);
  if (!ctx) throw new Error("useIde must be used inside IdeProvider");
  return ctx;
}

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    // Without storage the tour simply shows again next visit.
  }
}

export function clearTourDone() {
  try {
    localStorage.removeItem(TOUR_DONE_KEY);
  } catch {
    // Nothing to clear.
  }
}

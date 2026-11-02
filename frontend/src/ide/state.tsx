import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { TOUR_DONE_KEY } from "../config";
import { projectFiles, rsiOutput, rsiProblems, runs, type Problem, type ProjectFile } from "../data/examples";
import { answerOf, loadRun, loadRuns, type Run, type RunEvent, type RunSummary } from "../demo/runs";
import { streamAgent } from "./live";

export type WorkTab = "Backtest" | "Analyze";

/**
 * A tab is a file id ("rsi"), a backtest's results ("results:rsi"), or a rug check ("check:<key>").
 * Check keys: "saved:<runId>" opens a saved check finished; "replay:<n>" replays one in the thread; "live:<n>" is a
 * check the backend is running now.
 */
export type TabId = string;

/** A rug check the IDE knows about: a saved run (replayed or finished), or a live one streaming in. */
export type CheckRun = {
  key: string;
  run: Run;
  mode: "replay" | "live";
  /** performance.now() when a replay started; -Infinity shows it finished. */
  startedAt: number;
  status: "waiting" | "running" | "done" | "error";
  error?: string;
};

export type ThreadItem = { kind: "user"; text: string } | { kind: "agent"; text: string } | { kind: "check"; key: string };
export type UserThread = { id: number; title: string; items: ThreadItem[] };
/** The two example threads (the replayed rug check and the finished backtest), then threads started in this session. */
export type ThreadRef = "rug" | "backtest" | number;

/** The example thread's check. */
export const HERO_KEY = "replay:hero";

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
  | { type: "startHero" }
  | { type: "finishCheck"; key: string }
  | { type: "openSaved"; key: string; run: Run }
  | { type: "checkView"; key: string; view: State["checkViews"][string] }
  | { type: "liveEvent"; key: string; event: RunEvent | { type: "error"; message: string } }
  | { type: "liveEnd"; key: string }
  | { type: "closeTour" }
  | { type: "restartTour" }
  | { type: "draft"; text: string }
  | { type: "send"; reply: Reply }
  | { type: "newThread" }
  | { type: "selectThread"; thread: ThreadRef };

/** What the IDE does with a sent message, decided before it reaches the reducer (see `replyFor`). */
export type Reply = { kind: "replay"; run: Run } | { kind: "live" } | { kind: "text"; text: string };

export const BACKTEST_SOON =
  "Running new strategies is coming soon. Open a file in strategies to see a finished example, with its results.";

export const LIVE_SOON =
  "Live checks are coming soon. This preview replays six saved checks: paste one of their pump.fun links, tickers or addresses, or open one from the checks folder.";

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

/** The mode that matches what a tab shows; clips fit either. */
function modeOf(id: TabId): WorkTab | null {
  if (id.startsWith("check:")) return "Analyze";
  const file = fileById(fileOf(id));
  if (!file || file.kind === "clip") return null;
  return file.kind === "token" || file.kind === "markdown" ? "Analyze" : "Backtest";
}

function withTab(s: State, id: TabId): State {
  const openTabs = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
  return { ...s, openTabs, active: id, workTab: modeOf(id) ?? s.workTab };
}

function titleFrom(text: string) {
  return text.length > 44 ? `${text.slice(0, 43).trimEnd()}…` : text;
}

const savedCheck = (run: Run, key: string): CheckRun => ({ key, run, mode: "replay", startedAt: Number.NEGATIVE_INFINITY, status: "done" });

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
      s = typeof s.thread === "number" ? s : { ...s, thread: a.tab === "Backtest" ? "backtest" : "rug" };
      const fits = (id: TabId) => modeOf(id) === a.tab;
      if (s.active && fits(s.active)) return { ...s, workTab: a.tab };
      // Show the most recent tab of that kind, or the matching example.
      const recent = [...s.openTabs].reverse().find(fits);
      const fallback = a.tab === "Analyze" ? (s.checks[HERO_KEY] ? `check:${HERO_KEY}` : null) : s.ranRuns.includes("rsi") ? "results:rsi" : "rsi";
      const target = recent ?? fallback;
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
      if (a.event.type === "error") return { ...s, checks: { ...s.checks, [a.key]: { ...c, status: "error", error: a.event.message } } };
      const run = { ...c.run, events: [...c.run.events, a.event as RunEvent] };
      const next = { ...s, checks: { ...s.checks, [a.key]: { ...c, run } } };
      // The check's tab opens as soon as the agent starts on the token.
      const tab = `check:${a.key}`;
      return a.event.type === "step" && a.event.tool === "check_token" && !s.openTabs.includes(tab) ? { ...withTab(next, tab), openSeq: s.openSeq + 1 } : next;
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
      const text = s.draft.trim();
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
        const run: Run =
          a.reply.kind === "replay" ? { ...a.reply.run, message: text } : { id: key, mint: "", age_s: 0, about: "", message: text, clip: null, events: [] };
        checks = { ...checks, [key]: { key, run, mode: a.reply.kind, startedAt: performance.now(), status: "running" } };
        added = { kind: "check", key };
        if (a.reply.kind === "replay") open = `check:${key}`;
      }
      threads = threads.map((t) =>
        t.id === thread ? { ...t, title: t.title || titleFrom(text), items: [...t.items, { kind: "user", text }, added] } : t,
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
      return { ...s, thread: a.thread };
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

/** A check's tool log, from its events. */
export function checkOutput(c: CheckRun | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  let last: Record<string, string> = {};
  for (const e of c.run.events) {
    if (e.type === "step") out.push(`${e.status === "running" ? "start" : e.status}  ${e.tool}${e.summary ? `  ${e.summary}` : ""}${e.ms != null ? `  ${e.ms} ms` : ""}`);
    if (e.type === "progress") {
      const line =
        e.step === "token"
          ? `${e.transactions} transactions read`
          : e.step === "wallets"
            ? `${e.scanned} of ${e.of} wallets traced`
            : e.step === "busy"
              ? `${e.checked} of ${e.of} busy wallets checked`
              : e.step === "funders"
                ? `${e.scanned} of ${e.of} funders traced`
                : `${e.lookups} early buyers checked, ${e.sniper_bots} sniper bots`;
      last = { ...last, [e.step]: line };
      // One line per kind of progress: keep the latest count.
      const at = out.findIndex((l) => l.startsWith(`  ${e.step}`));
      const row = `  ${e.step.padEnd(8)}${line}`;
      if (at >= 0) out[at] = row;
      else out.push(row);
    }
    if (e.type === "answer") out.push(`answer  ${e.audit.numbers} numbers checked against the data${e.audit.passed ? "" : " (some failed)"}`);
  }
  if (c.status === "error" && c.error) out.push(`error  ${c.error}`);
  return out;
}

/** The panels describe what's in front: the open check, or else the backtests that ran (or the last check). */
export function problemsFor(state: State): Problem[] {
  const active = checkOf(state, state.active);
  if (active) return checkProblems(active);
  const runs = state.ranRuns.flatMap((id) => (id === "rsi" ? rsiProblems : []));
  return runs.length || state.workTab === "Backtest" ? runs : checkProblems(focusCheck(state));
}

export function outputFor(state: State): string[] {
  const active = checkOf(state, state.active);
  if (active) return checkOutput(active);
  const runs = state.ranRuns.flatMap((id) => (id === "rsi" ? rsiOutput : []));
  return runs.length || state.workTab === "Backtest" ? runs : checkOutput(focusCheck(state));
}

export function hasRun(fileId: string): boolean {
  return fileId in runs;
}

export const exampleThreadTitle: Record<"rug" | "backtest", string> = {
  rug: "Is this a rug?",
  backtest: "Code the strategy in this clip",
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
      streamAgent(c.run.message, (event) => dispatch({ type: "liveEvent", key: c.key, event })).then(
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

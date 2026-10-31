import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { TOUR_DONE_KEY } from "../config";
import {
  projectFiles,
  rsiOutput,
  rsiProblems,
  rsiThread,
  runs,
  type Problem,
  type ProjectFile,
} from "../data/examples";

export type WorkTab = "Backtest" | "Analyze";

/** A tab is either a file id ("rsi") or a run's results ("results:rsi"). */
export type TabId = string;

export type Message = { kind: "user" | "agent"; text: string };
export type UserThread = { id: number; title: string; messages: Message[] };
/** "example" is the replayed demo thread; numbers are threads started in this session. */
export type ThreadRef = "example" | number;

type State = {
  workTab: WorkTab;
  openTabs: TabId[];
  active: TabId | null;
  split: boolean;
  bottomTab: "problems" | "output";
  /** How many thread steps the replay has revealed. */
  revealed: number;
  replaying: boolean;
  replayed: boolean;
  /** With auto-accept off, the replay waits here for Accept or Reject. */
  awaitingEdit: boolean;
  edit: "accepted" | "rejected" | null;
  autoAccept: boolean;
  /** Runs that have finished in this session. */
  ranRuns: string[];
  running: string | null;
  tourOpen: boolean;
  /** Goes up each time the tour starts, so the tour starts from step one. */
  tourRun: number;
  /** Goes up each time the visitor opens something, so narrow screens can show it. */
  openSeq: number;
  draft: string;
  threads: UserThread[];
  thread: ThreadRef;
};

type Action =
  | { type: "open"; id: TabId }
  | { type: "close"; id: TabId }
  | { type: "workTab"; tab: WorkTab }
  | { type: "split" }
  | { type: "bottomTab"; tab: State["bottomTab"] }
  | { type: "startReplay" }
  | { type: "revealStep" }
  | { type: "finishReplay" }
  | { type: "acceptEdit" }
  | { type: "rejectEdit" }
  | { type: "autoAccept"; on: boolean }
  | { type: "runStart"; runId: string }
  | { type: "runDone"; runId: string }
  | { type: "closeTour" }
  | { type: "restartTour" }
  | { type: "draft"; text: string }
  | { type: "send" }
  | { type: "newThread" }
  | { type: "selectThread"; thread: ThreadRef };

const STEP_COUNT = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : [])).length;
/** The step where the agent writes rsi_dip.pine. */
export const WRITE_STEP = 5;

export const PREVIEW_REPLY =
  "This preview runs on example data, so I can't run new strategies or research new tickers yet. Open a file in strategies or research to see a finished example.";

function readDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function demoState(): State {
  return {
    workTab: "Backtest",
    openTabs: [],
    active: null,
    split: false,
    bottomTab: "problems",
    revealed: 0,
    replaying: false,
    replayed: false,
    awaitingEdit: false,
    edit: null,
    autoAccept: true,
    ranRuns: [],
    running: null,
    tourOpen: true,
    tourRun: 0,
    openSeq: 0,
    draft: "",
    threads: [],
    thread: "example",
  };
}

function initialState(): State {
  const fresh = demoState();
  return readDone() ? { ...finishReplay(fresh), tourOpen: false } : fresh;
}

/** The mode that matches what a tab shows; clips fit either. */
function modeOf(id: TabId): WorkTab | null {
  const file = fileById(fileOf(id));
  if (!file || file.kind === "clip") return null;
  return file.kind === "markdown" ? "Analyze" : "Backtest";
}

function withTab(s: State, id: TabId): State {
  const openTabs = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
  return { ...s, openTabs, active: id, workTab: modeOf(id) ?? s.workTab };
}

function finishReplay(s: State): State {
  const ranRuns = s.ranRuns.includes("rsi") ? s.ranRuns : [...s.ranRuns, "rsi"];
  const next: State = {
    ...s,
    revealed: STEP_COUNT,
    replaying: false,
    replayed: true,
    awaitingEdit: false,
    edit: "accepted",
    ranRuns,
  };
  return withTab(withTab(next, "rsi"), "results:rsi");
}

function titleFrom(text: string) {
  return text.length > 44 ? `${text.slice(0, 43).trimEnd()}…` : text;
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
      const fits = (id: TabId) => modeOf(id) === a.tab;
      if (s.active && fits(s.active)) return { ...s, workTab: a.tab };
      // Show the most recent tab of that kind, or the matching example.
      const recent = [...s.openTabs].reverse().find(fits);
      const fallback = a.tab === "Analyze" ? "acme" : s.ranRuns.includes("rsi") ? "results:rsi" : "rsi";
      return { ...withTab(s, recent ?? fallback), openSeq: s.openSeq + 1 };
    }
    case "split":
      return { ...s, split: !s.split };
    case "bottomTab":
      return { ...s, bottomTab: a.tab };
    case "startReplay":
      return {
        ...s,
        revealed: 0,
        replaying: true,
        replayed: false,
        awaitingEdit: false,
        edit: null,
        openTabs: [],
        active: null,
        ranRuns: [],
        thread: "example",
      };
    case "revealStep": {
      const revealed = Math.min(STEP_COUNT, s.revealed + 1);
      if (revealed !== WRITE_STEP) return { ...s, revealed };
      const written = withTab({ ...s, revealed }, "rsi");
      return s.autoAccept ? { ...written, edit: "accepted" } : { ...written, awaitingEdit: true };
    }
    case "finishReplay":
      return finishReplay(s);
    case "acceptEdit":
      return { ...s, awaitingEdit: false, edit: "accepted" };
    case "rejectEdit": {
      // The agent stops: no file, no run.
      const openTabs = s.openTabs.filter((t) => t !== "rsi");
      return { ...s, awaitingEdit: false, edit: "rejected", replaying: false, openTabs, active: openTabs.at(-1) ?? null };
    }
    case "autoAccept":
      return { ...s, autoAccept: a.on };
    case "runStart":
      return { ...s, running: a.runId };
    case "runDone": {
      const ranRuns = s.ranRuns.includes(a.runId) ? s.ranRuns : [...s.ranRuns, a.runId];
      return { ...withTab({ ...s, running: null, ranRuns }, `results:${a.runId}`), openSeq: s.openSeq + 1 };
    }
    case "closeTour": {
      // Closing the tour, at any step, leaves the finished example open on its results.
      const done = s.replayed || s.edit === "rejected" ? s : finishReplay(s);
      return { ...done, tourOpen: false };
    }
    case "restartTour":
      return { ...demoState(), autoAccept: s.autoAccept, threads: s.threads, draft: s.draft, tourRun: s.tourRun + 1 };
    case "draft":
      return { ...s, draft: a.text };
    case "send": {
      const text = s.draft.trim();
      if (!text) return s;
      let threads = s.threads;
      let thread = s.thread;
      // The example thread is a replay, so a new message starts a thread of your own.
      if (thread === "example") {
        thread = threads.length + 1;
        threads = [...threads, { id: thread, title: "", messages: [] }];
      }
      threads = threads.map((t) =>
        t.id === thread
          ? {
              ...t,
              title: t.title || titleFrom(text),
              messages: [...t.messages, { kind: "user", text }, { kind: "agent", text: PREVIEW_REPLY }],
            }
          : t,
      );
      return { ...s, threads, thread, draft: "" };
    }
    case "newThread": {
      const current = s.threads.find((t) => t.id === s.thread);
      if (current && current.messages.length === 0) return s;
      const id = s.threads.length + 1;
      return { ...s, threads: [...s.threads, { id, title: "", messages: [] }], thread: id };
    }
    case "selectThread":
      return { ...s, thread: a.thread };
  }
}

/* ---------- Derived data ---------- */

export const STEPS_TOTAL = STEP_COUNT;

export function fileById(id: string | null): ProjectFile | undefined {
  return projectFiles.find((f) => f.id === id);
}

/** The file a tab belongs to: a results tab belongs to the file that ran. */
export function fileOf(id: TabId | null): string | null {
  if (!id) return null;
  return id.startsWith("results:") ? id.slice(8) : id;
}

const extraProblems: Record<string, Problem[]> = {
  cashflow: [
    { severity: "warning", file: "Results", message: "Prices for 31 delisted companies were missing and are flagged in the data audit." },
    {
      severity: "info",
      file: "cashflow_top20.py",
      line: 39,
      message: "“Six-month return” could skip the latest month or not. Both readings were tested; see Results.",
    },
  ],
};

export function problemsFor(ranRuns: string[]): Problem[] {
  return ranRuns.flatMap((id) => (id === "rsi" ? rsiProblems : (extraProblems[id] ?? [])));
}

export function outputFor(ranRuns: string[]): string[] {
  return ranRuns.flatMap((id) =>
    id === "rsi"
      ? rsiOutput
      : [
          `09:52:10  lint        ${fileById(id)?.name ?? id}  0 errors, 0 warnings`,
          "09:52:11  engine      S&P 500 members as of each date  2010-01 → 2026-10  202 rebalances",
          "09:52:14  red team    8 checks  0 fails  2 cautions",
        ],
  );
}

export function hasRun(fileId: string): boolean {
  return fileId in runs;
}

export function threadTitle(state: State): string {
  if (state.thread === "example") return "Code the strategy in this clip";
  return state.threads.find((t) => t.id === state.thread)?.title || "New thread";
}

/* ---------- Context ---------- */

type Ctx = { state: State; dispatch: (a: Action) => void };
const IdeContext = createContext<Ctx | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // The replay: reveal one agent step at a time, and wait whenever an edit needs approval.
  useEffect(() => {
    if (!state.replaying || state.awaitingEdit) return;
    if (state.revealed >= STEP_COUNT) {
      const t = window.setTimeout(() => dispatch({ type: "finishReplay" }), 600);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => dispatch({ type: "revealStep" }), state.revealed === 0 ? 300 : 520);
    return () => window.clearTimeout(t);
  }, [state.replaying, state.revealed, state.awaitingEdit]);

  // Replaying an example run.
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

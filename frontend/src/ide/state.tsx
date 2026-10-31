import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { PENDING_PROMPT_KEY, TOUR_DONE_KEY } from "../config";
import {
  projectFiles,
  rsiOutput,
  rsiProblems,
  rsiThread,
  runs,
  type Problem,
  type ProjectFile,
} from "../data/examples";

export type Mode = "demo" | "personal";
export type WorkTab = "Backtest" | "Analyze";

/** A tab is either a file id ("rsi") or a run's results ("results:rsi"). */
export type TabId = string;

type State = {
  mode: Mode;
  workTab: WorkTab;
  openTabs: TabId[];
  active: TabId | null;
  split: boolean;
  bottomTab: "problems" | "output";
  /** How many thread steps have been revealed by the replay. */
  revealed: number;
  replaying: boolean;
  replayed: boolean;
  /** Runs that have finished in this session. */
  ranRuns: string[];
  running: string | null;
  tourOpen: boolean;
  draft: string;
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
  | { type: "runStart"; runId: string }
  | { type: "runDone"; runId: string }
  | { type: "tour"; open: boolean }
  | { type: "personal" }
  | { type: "restartDemo" }
  | { type: "draft"; text: string };

const STEP_COUNT = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : [])).length;
const WRITE_STEP = 5;

function readDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function takePendingPrompt(): string {
  try {
    const text = sessionStorage.getItem(PENDING_PROMPT_KEY) ?? "";
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
    return text;
  } catch {
    return "";
  }
}

function demoState(draft = ""): State {
  return {
    mode: "demo",
    workTab: "Backtest",
    openTabs: [],
    active: null,
    split: false,
    bottomTab: "problems",
    revealed: 0,
    replaying: false,
    replayed: false,
    ranRuns: [],
    running: null,
    tourOpen: true,
    draft,
  };
}

function personalState(draft = ""): State {
  return { ...demoState(draft), mode: "personal", tourOpen: false };
}

function withTab(s: State, id: TabId): State {
  const openTabs = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
  return { ...s, openTabs, active: id };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "open":
      return withTab(s, a.id);
    case "close": {
      const openTabs = s.openTabs.filter((t) => t !== a.id);
      const active = s.active === a.id ? (openTabs[openTabs.length - 1] ?? null) : s.active;
      return { ...s, openTabs, active };
    }
    case "workTab":
      return { ...s, workTab: a.tab };
    case "split":
      return { ...s, split: !s.split };
    case "bottomTab":
      return { ...s, bottomTab: a.tab };
    case "startReplay":
      return { ...s, revealed: 0, replaying: true, replayed: false, openTabs: [], active: null, ranRuns: [] };
    case "revealStep": {
      const revealed = Math.min(STEP_COUNT, s.revealed + 1);
      const next = { ...s, revealed };
      return revealed === WRITE_STEP ? withTab(next, "rsi") : next;
    }
    case "finishReplay": {
      const next = { ...s, revealed: STEP_COUNT, replaying: false, replayed: true, ranRuns: ["rsi"] };
      return withTab(withTab(next, "rsi"), "results:rsi");
    }
    case "runStart":
      return { ...s, running: a.runId };
    case "runDone": {
      const ranRuns = s.ranRuns.includes(a.runId) ? s.ranRuns : [...s.ranRuns, a.runId];
      return withTab({ ...s, running: null, ranRuns }, `results:${a.runId}`);
    }
    case "tour":
      return { ...s, tourOpen: a.open };
    case "personal":
      return personalState(s.draft);
    case "restartDemo":
      return demoState(s.draft);
    case "draft":
      return { ...s, draft: a.text };
  }
}

/* ---------- Derived data ---------- */

export const STEPS_TOTAL = STEP_COUNT;

export function fileById(id: string): ProjectFile | undefined {
  return projectFiles.find((f) => f.id === id);
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

/* ---------- Context ---------- */

type Ctx = { state: State; dispatch: (a: Action) => void };
const IdeContext = createContext<Ctx | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const draft = takePendingPrompt();
    return readDone() ? personalState(draft) : demoState(draft);
  });

  // The tour's replay: reveal one agent step at a time.
  useEffect(() => {
    if (!state.replaying) return;
    if (state.revealed >= STEP_COUNT) {
      const t = window.setTimeout(() => dispatch({ type: "finishReplay" }), 600);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => dispatch({ type: "revealStep" }), state.revealed === 0 ? 300 : 520);
    return () => window.clearTimeout(t);
  }, [state.replaying, state.revealed]);

  // Simulated runs for example files.
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

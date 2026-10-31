import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { markTourDone, useIde } from "./state";

type Step = {
  target?: string;
  title: string;
  body: string;
  /** Prepare the IDE so the target exists and shows the right thing. */
  enter?: (dispatch: ReturnType<typeof useIde>["dispatch"], state: ReturnType<typeof useIde>["state"]) => void;
};

const steps: Step[] = [
  {
    target: "explorer",
    title: "Your files live here",
    body: "Strategies, research, and clips sit in folders, like in a code editor. This demo project is already filled in.",
  },
  {
    target: "composer",
    title: "Type an idea or drop a clip",
    body: "Describe a strategy in plain English, or add a chart screenshot or a short video. Here, someone dropped in a clip.",
  },
  {
    target: "thread",
    title: "Watch an idea become code",
    body: "The agent reads the clip, finds the rules, picks Pine Script, writes the file, and fixes its own errors. Every step shows up here.",
    enter: (dispatch, state) => {
      if (!state.replaying && !state.replayed) dispatch({ type: "startReplay" });
    },
  },
  {
    target: "problems",
    title: "Problems it caught",
    body: "Compile errors and honesty issues show up here and as underlines in the code, the way an editor shows errors.",
    enter: (dispatch, state) => {
      if (!state.replayed) dispatch({ type: "finishReplay" });
      dispatch({ type: "bottomTab", tab: "problems" });
    },
  },
  {
    target: "results",
    title: "An honest result",
    body: "The verdict, the equity curve against holding BTC and the S&P 500, and the Strategy Facts label. A claimed number gets struck through when the test disagrees.",
    enter: (dispatch, state) => {
      if (!state.replayed) dispatch({ type: "finishReplay" });
      dispatch({ type: "open", id: "results:rsi" });
    },
  },
  {
    target: "settings",
    title: "Change what you test",
    body: "Pick the symbol, timeframe, dates, and starting money, then run it again.",
    enter: (dispatch) => dispatch({ type: "open", id: "results:rsi" }),
  },
  {
    target: "export",
    title: "Take it to TradingView",
    body: "Copy the Pine code or download the file. Paste it into TradingView and it runs there too. The code is yours.",
    enter: (dispatch) => dispatch({ type: "open", id: "rsi" }),
  },
  {
    target: "worktabs",
    title: "Research a stock",
    body: "Switch to Analyze to check a company against its SEC filings. Each claim gets a verdict: supported, contradicted, or can't check.",
    enter: (dispatch) => {
      dispatch({ type: "workTab", tab: "Analyze" });
      dispatch({ type: "open", id: "acme" });
    },
  },
  {
    title: "That's the tour",
    body: "Your own project starts empty. The finished examples stay in the Examples folder whenever you want them.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const CARD_W = 340;

function measure(target?: string): Rect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

function place(rect: Rect | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { top: vh / 2 - cardH / 2, left: vw / 2 - CARD_W / 2 };
  const gap = 16;
  const clampTop = (t: number) => Math.max(16, Math.min(vh - cardH - 16, t));
  if (rect.left + rect.width + gap + CARD_W < vw - 16) return { top: clampTop(rect.top), left: rect.left + rect.width + gap };
  if (rect.left - gap - CARD_W > 16) return { top: clampTop(rect.top), left: rect.left - gap - CARD_W };
  const left = Math.max(16, Math.min(vw - CARD_W - 16, rect.left + rect.width / 2 - CARD_W / 2));
  if (rect.top + rect.height + gap + cardH < vh - 16) return { top: rect.top + rect.height + gap, left };
  return { top: clampTop(rect.top - gap - cardH), left };
}

export function Tour() {
  const { state, dispatch } = useIde();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const open = state.mode === "demo" && state.tourOpen;
  const step = steps[index];

  // Restarting the demo from the help menu starts the tour over.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    step.enter?.(dispatch, state);
    // Run only when the step changes, not on every state update.
  }, [index, open]);

  const remeasure = useCallback(() => setRect(measure(step.target)), [step.target]);

  useLayoutEffect(() => {
    if (!open) return;
    remeasure();
    // Layout can shift while panels mount; measure again shortly after.
    const t1 = window.setTimeout(remeasure, 120);
    const t2 = window.setTimeout(remeasure, 450);
    window.addEventListener("resize", remeasure);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", remeasure);
    };
  }, [open, remeasure, state.openTabs, state.active, state.workTab]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.focus();
  }, [index, open]);

  const finish = useCallback(() => {
    markTourDone();
    dispatch({ type: "personal" });
  }, [dispatch]);

  const next = useCallback(() => {
    if (index === steps.length - 1) finish();
    else setIndex((i) => i + 1);
  }, [index, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, next, back]);

  if (!open) return null;

  const pos = place(rect, cardH);
  const last = index === steps.length - 1;

  return (
    <div className="tour" aria-live="polite">
      <div className="tour__block" />
      <div
        className={`tour__spot ${rect ? "" : "is-none"}`}
        style={rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : undefined}
        aria-hidden
      />
      <div
        ref={cardRef}
        className="tour__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={{ top: pos.top, left: pos.left, width: CARD_W }}
      >
        <p className="tour__count">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="tour__title">
          {step.title}
        </h2>
        <p id="tour-body" className="tour__body">
          {step.body}
        </p>
        <div className="tour__actions">
          {!last && (
            <button className="tour__link" onClick={finish}>
              Skip tour
            </button>
          )}
          <span className="tour__spacer" />
          {index > 0 && (
            <button className="tour__link" onClick={back}>
              Back
            </button>
          )}
          <button className="tour__next" onClick={next}>
            {last ? "Get started" : "Next"}
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

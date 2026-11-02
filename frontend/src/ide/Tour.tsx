import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import { HERO_KEY, markTourDone, useIde } from "./state";

type Ide = ReturnType<typeof useIde>;

type Step = {
  target: string;
  title: string;
  body: string;
  /** Prepare the IDE so the target exists and shows the right thing. */
  enter?: (dispatch: Ide["dispatch"], state: Ide["state"]) => void;
};

function startHero(dispatch: Ide["dispatch"], state: Ide["state"]) {
  if (state.checks[HERO_KEY]?.status === "waiting") dispatch({ type: "startHero" });
}

/** Jump the example check to its end, so its answer and flags are there to point at. */
function finishHero(dispatch: Ide["dispatch"], state: Ide["state"]) {
  startHero(dispatch, state);
  dispatch({ type: "finishCheck", key: HERO_KEY });
}

const steps: Step[] = [
  {
    target: "ask",
    title: "Start with a token",
    body: "Paste a pump.fun link, a ticker or a token’s address. This one is a saved check of a token 15 minutes after it launched.",
  },
  {
    target: "thread",
    title: "The agent traces every wallet",
    body: "It reads every trade since launch, traces who funded each wallet, and splits the team, the snipers and the bots from independent buyers.",
    enter: startHero,
  },
  {
    target: "holders",
    title: "Who really holds it",
    body: "Wallets tied by funding gather around the wallets that paid for them. The team is blue; snipers, bots and everyone else sit apart.",
    enter: (dispatch, state) => {
      startHero(dispatch, state);
      dispatch({ type: "open", id: `check:${HERO_KEY}` });
      dispatch({ type: "checkView", key: HERO_KEY, view: "holders" });
    },
  },
  {
    target: "problems",
    title: "Flags, like errors in code",
    body: "The verdict and the signals the agent called out show up here, the way an editor lists problems.",
    enter: (dispatch, state) => {
      finishHero(dispatch, state);
      dispatch({ type: "bottomTab", tab: "problems" });
    },
  },
  {
    target: "results",
    title: "The verdict, with a second opinion",
    body: "The rug chance comes from a model trained on thousands of past pump.fun tokens, with Muse Glimmer’s second opinion and how similar launches ended. Switch to Backtest at the top to test a strategy.",
    enter: (dispatch, state) => {
      finishHero(dispatch, state);
      dispatch({ type: "open", id: `check:${HERO_KEY}` });
      dispatch({ type: "checkView", key: HERO_KEY, view: "overview" });
    },
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const CARD_W = 340;
const FOCUSABLE = "button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";

function measure(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  // Light only the part that's actually on screen: clip to every scrolling pane the target sits in.
  const r = el.getBoundingClientRect();
  let { top, bottom, left, right } = r;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if (overflow === "visible") continue;
    const pr = p.getBoundingClientRect();
    top = Math.max(top, pr.top);
    bottom = Math.min(bottom, pr.bottom);
    left = Math.max(left, pr.left);
    right = Math.min(right, pr.right);
  }
  const vh = window.innerHeight;
  top = Math.min(vh - PAD, Math.max(PAD, top - PAD));
  bottom = Math.max(top, Math.min(vh - PAD, bottom + PAD));
  return { top, left: left - PAD, width: Math.max(0, right - left + PAD * 2), height: bottom - top };
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
  if (rect.top - gap - cardH > 16) return { top: rect.top - gap - cardH, left };
  // Nothing fits beside the target: pin the card to the roomier edge of the screen, over a neighboring pane.
  const roomRight = vw - (rect.left + rect.width);
  return { top: clampTop(rect.top), left: roomRight >= rect.left ? vw - CARD_W - 16 : 16 };
}

export function Tour() {
  const { state } = useIde();
  if (!state.tourOpen) return null;
  // A new key on every start, so a replayed tour begins at step one with fresh state.
  return <TourCard key={state.tourRun} />;
}

function TourCard() {
  const { state, dispatch } = useIde();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    step.enter?.(dispatch, state);
    // Run only when the step changes, not on every state update.
  }, [index]);

  const remeasure = useCallback(() => setRect(measure(step.target)), [step.target]);

  useLayoutEffect(() => {
    remeasure();
    // Layout shifts while panels mount and reports scroll; measure again shortly after.
    const timers = [120, 450, 800].map((ms) => window.setTimeout(remeasure, ms));
    // Follow the target while any pane scrolls, such as the report scrolling to the receipt.
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(remeasure);
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [remeasure, state.openTabs, state.active, state.workTab, state.checkViews, state.checks]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.focus();
  }, [index]);

  const close = useCallback(() => {
    markTourDone();
    dispatch({ type: "closeTour" });
    // Hand focus to the report the tour ends on.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-tour="results"]')?.focus());
  }, [dispatch]);

  const next = useCallback(() => (last ? close() : setIndex((i) => i + 1)), [last, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowRight" || (e.key === "Enter" && e.target === cardRef.current)) {
      next();
    } else if (e.key === "ArrowLeft") {
      back();
    } else if (e.key === "Tab") {
      // Keep focus inside the card; the IDE behind it is inert.
      const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const end = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === cardRef.current)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && at === end) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const pos = place(rect, cardH);

  return (
    <div className="tour">
      <div className="tour__block" onClick={() => cardRef.current?.focus()} />
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
        onKeyDown={onKeyDown}
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
            <button className="tour__link" onClick={close}>
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import { COPY_HERO_KEY, HERO_KEY, markTourDone, useIde } from "./state";

type Ide = ReturnType<typeof useIde>;

type Step = {
  target: string;
  title: string;
  body: string;
  /** Prepare the IDE so the target exists and shows the right thing. */
  enter?: (dispatch: Ide["dispatch"], state: Ide["state"]) => void;
};

function startHero(dispatch: Ide["dispatch"], state: Ide["state"]) {
  dispatch({ type: "tourShow", show: "rug" });
  if (state.checks[HERO_KEY]?.status === "waiting") dispatch({ type: "startHero" });
}

/** Jump the example check to its end, so its answer and flags are there to point at. */
function finishHero(dispatch: Ide["dispatch"], state: Ide["state"]) {
  startHero(dispatch, state);
  dispatch({ type: "finishCheck", key: HERO_KEY });
}

/** Show one of the example check's views. */
const heroView = (view: "overview" | "chart" | "holders" | "signals", finish = false) => (dispatch: Ide["dispatch"], state: Ide["state"]) => {
  (finish ? finishHero : startHero)(dispatch, state);
  dispatch({ type: "open", id: `check:${HERO_KEY}` });
  dispatch({ type: "checkView", key: HERO_KEY, view });
};

const steps: Step[] = [
  {
    target: "none",
    title: "Welcome to Trade Receipts",
    body: "Two tools in one IDE. Analyze checks a pump.fun token for a rug. Copy trade backtests copying a wallet a little late. This tour plays a saved example of each; click through at your own pace.",
    enter: (dispatch) => dispatch({ type: "tourShow", show: "rug" }),
  },
  {
    target: "worktabs",
    title: "Two modes",
    body: "Analyze and Copy trade live up here. Switching mode starts a new chat and a new tab, so results never mix.",
    enter: (dispatch) => dispatch({ type: "tourShow", show: "rug" }),
  },
  {
    target: "examples",
    title: "Your files",
    body: "The examples folder holds saved rug checks and a saved copy-trade backtest. Anything you run shows up above it, in this session.",
  },
  {
    target: "ask",
    title: "Analyze: start with a token",
    body: "Paste a pump.fun link, a ticker or a token’s address into the chat. This one is a saved check of a token 15 minutes after it launched.",
    enter: (dispatch) => dispatch({ type: "tourShow", show: "rug" }),
  },
  {
    target: "thread",
    title: "The agent reads the chain",
    body: "Each step shows as it runs: it reads every trade since launch, traces who funded each wallet, and splits the team, snipers and bots from independent buyers.",
    enter: startHero,
  },
  {
    target: "chart",
    title: "The real chart",
    body: "Every trade since launch, as candles, with the team’s and the snipers’ trades marked on it.",
    enter: heroView("chart"),
  },
  {
    target: "holders",
    title: "Who really holds it",
    body: "Wallets tied by funding gather around the wallets that paid for them. The team is blue; snipers, bots and everyone else sit apart.",
    enter: heroView("holders"),
  },
  {
    target: "signals",
    title: "Every signal",
    body: "Each card is one family of signals, from the launch block to the team’s selling, with this token’s own values.",
    enter: heroView("signals", true),
  },
  {
    target: "results",
    title: "The rug chance",
    body: "A model trained on thousands of past pump.fun launches scores the token, with a second opinion and how the most similar launches ended. A low score never means safe.",
    enter: heroView("overview", true),
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
    target: "composer",
    title: "Ask follow-ups",
    body: "Ask about a result in plain English: the agent answers from the data it already pulled. Another token or wallet opens a new chat.",
    enter: (dispatch, state) => finishHero(dispatch, state),
  },
  {
    target: "thread",
    title: "Copy trade: pick a wallet",
    body: "Paste a pump.fun wallet and say how late you’d copy it. This saved backtest copies a wallet from pump.fun’s leaderboard a few minutes after each of its trades.",
    enter: (dispatch) => dispatch({ type: "tourShow", show: "copy" }),
  },
  {
    target: "copy-result",
    title: "Their result next to yours",
    body: "The wallet’s P&L beside yours copying it late, then every position: their trades, yours, and what the price did while you waited.",
    enter: (dispatch) => {
      dispatch({ type: "tourShow", show: "copy" });
      dispatch({ type: "finishCheck", key: COPY_HERO_KEY });
    },
  },
  {
    target: "copy-form",
    title: "Run your own",
    body: "Set the wallet, how long after they buy and sell you’d copy, and how many positions. Nothing runs until you press Run backtest. Its chat stays closed until you ask about the result.",
    enter: (dispatch) => dispatch({ type: "tourShow", show: "form" }),
  },
  {
    target: "none",
    title: "You’re set",
    body: "The IDE starts blank: ask about a token in the chat, or switch to Copy trade. The examples stay in the examples folder. Replay this tour from the question mark at the top.",
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
    // Once the step's view has opened, bring a target that sits low in a scrolling pane up to its top.
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      const r = el?.getBoundingClientRect();
      if (el && r && r.top > window.innerHeight * 0.45) el.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 350);
    return () => window.clearTimeout(t);
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
  }, [remeasure, state.openTabs, state.active, state.workTab, state.checkViews, state.checks, state.panes, state.thread]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.focus();
  }, [index]);

  const close = useCallback(() => {
    markTourDone();
    dispatch({ type: "closeTour" });
    // The IDE starts blank: hand focus to the chat.
    requestAnimationFrame(() => document.querySelector<HTMLElement>("#composer-input")?.focus());
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

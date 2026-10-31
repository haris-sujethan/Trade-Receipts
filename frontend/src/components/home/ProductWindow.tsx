import { useEffect, useRef, useState } from "react";
import { Check, FileCode2, FileText, Pause, Paperclip, Play, RotateCcw } from "lucide-react";
import { APP_NAME } from "../../config";
import { acmeResearch, cashflowPython, moonResearch, rsiPine, rsiThread, type ThreadStep } from "../../data/examples";
import { ResultsView, resultParts } from "../../ide/ResultsView";
import { RESEARCH_PARTS, ResearchSheet } from "../../ide/report/ResearchSheet";
import { onTablistKeyDown } from "../../lib/tabs";
import "./window.css";

type Replay = {
  id: string;
  tab: string;
  mode: "Backtest" | "Analyze";
  ask: string;
  clip?: string;
  steps: ThreadStep[];
  file: string;
  code: string;
  /** Step index at which the file starts being written. */
  writesAt: number;
  result: { kind: "backtest"; runId: string } | { kind: "research"; which: "acme" | "moon" };
};

const rsiSteps = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : []));

const replays: Replay[] = [
  {
    id: "clip",
    tab: "Backtest · BTC",
    mode: "Backtest",
    ask: "Code the strategy in this clip and test it.",
    clip: "guru_clip.mp4 · 0:48",
    steps: rsiSteps,
    file: "rsi_dip.pine",
    code: rsiPine,
    writesAt: 4,
    result: { kind: "backtest", runId: "rsi" },
  },
  {
    id: "english",
    tab: "Backtest · S&P 500",
    mode: "Backtest",
    ask: "S&P 500 stocks with positive cash flow, top 20 by 6-month return. Move to Treasuries when unemployment is above its one-year average.",
    steps: [
      { id: "e1", text: "Found 4 rules and 2 ambiguous phrases", detail: "“Positive cash flow” and “six-month return”" },
      { id: "e2", text: "Chose Python", detail: "Needs many stocks, company financials, and unemployment data" },
      { id: "e3", text: "Wrote strategies/cashflow_top20.py", meta: "Muse Wonder" },
      { id: "e4", text: "Round 1: clean", detail: "0 errors, 0 warnings" },
      { id: "e5", text: "Ran the honest and naive versions", detail: "Jan 2010 – Oct 2026, monthly" },
      { id: "e6", text: "Red team: 8 checks", detail: "0 fails, 2 cautions" },
    ],
    file: "cashflow_top20.py",
    code: cashflowPython,
    writesAt: 2,
    result: { kind: "backtest", runId: "cashflow" },
  },
  {
    id: "research",
    tab: "Stock research · ACME",
    mode: "Analyze",
    ask: "Is this pitch true?",
    clip: "acme_pitch.mp4 · 0:36",
    steps: [
      { id: "r1", text: "Transcribed the audio", meta: "Muse Voice Transcribe" },
      {
        id: "r2",
        text: "Found the ticker and 3 claims",
        rules: [
          { text: "“Revenue is exploding”", at: "0:14" },
          { text: "“They print cash”", at: "0:22" },
          { text: "“No dilution”", at: "0:31" },
        ],
      },
      { id: "r3", text: "Pulled 12 quarterly reports", detail: "2023 – 2026" },
      { id: "r4", text: "Wrote research/ACME.md" },
      { id: "r5", text: "3 of 3 claims contradicted by the reports" },
    ],
    file: "ACME.md",
    code: acmeResearch,
    writesAt: 3,
    result: { kind: "research", which: "acme" },
  },
  {
    id: "crypto",
    tab: "Crypto research · MOON",
    mode: "Analyze",
    ask: "Is this coin legit?",
    clip: "moon_pitch.mp4 · 0:52",
    steps: [
      { id: "c1", text: "Watched the clip", meta: "Muse Spark 1.3" },
      { id: "c2", text: "Read the token address off the screen", detail: "Shown at 0:21. Three other tokens use the same name" },
      { id: "c3", text: "Checked what the creator can still do", detail: "Can mint more tokens; can't freeze wallets" },
      { id: "c4", text: "Traced the top 20 holders", detail: "14 wallets were funded by one address and hold 23%" },
      { id: "c5", text: "Compared with 1,240 similar past launches", detail: "84% were rugged within 30 days" },
      { id: "c6", text: "Wrote research/MOON.md" },
      { id: "c7", text: "3 of 3 claims contradicted on-chain" },
    ],
    file: "MOON.md",
    code: moonResearch,
    writesAt: 5,
    result: { kind: "research", which: "moon" },
  },
];

/** Total time for the agent's steps, spread evenly, within these per-step bounds. */
const WORK_MS = 5200;
const STEP_MIN_MS = 480;
const STEP_MAX_MS = 800;
/** Pause between the last step and the results opening. */
const OPEN_DELAY_MS = 500;
/** Each part of the results prints in this far apart. */
const PART_MS = 750;
/** Then the finished results stay up this long before the next example. */
const HOLD_MS = 7000;
const CLOCK_MS = 100;
/** The replay starts once this share of the window, or of the screen, shows it. */
const SEEN = 0.6;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function timeline(r: Replay) {
  const total = r.steps.length;
  const stepMs = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, WORK_MS / total));
  const workEnd = total * stepMs;
  const openAt = workEnd + OPEN_DELAY_MS;
  const parts = r.result.kind === "backtest" ? resultParts(r.result.runId) : RESEARCH_PARTS;
  const printedAt = openAt + (parts - 1) * PART_MS;
  return { total, stepMs, workEnd, openAt, parts, printedAt };
}

const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);

export function ProductWindow() {
  const [active, setActive] = useState(0);
  const replay = replays[active];
  const t = timeline(replay);
  const [elapsed, setElapsed] = useState(() => (prefersReducedMotion() ? Infinity : 0));
  const [userView, setUserView] = useState<"code" | "results" | null>(null);
  const [visible, setVisible] = useState(false);
  /** The visitor pressed Pause. Stops everything. */
  const [paused, setPaused] = useState(false);
  /** Pointer over the window, or focus inside it. Keeps finished results up. */
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /** The visitor scrolled, tapped or clicked inside. Stops following along and keeps this example up. */
  const [engaged, setEngaged] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // Start once the window is mostly on screen, and pause when it isn't. On a short screen, "mostly" means most of
  // the screen rather than most of the window.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const screen = entry.rootBounds?.height ?? window.innerHeight;
        const shown = entry.intersectionRect.height;
        setVisible(entry.intersectionRatio >= SEEN || shown >= screen * SEEN);
      },
      { threshold: thresholds },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const finite = Number.isFinite(elapsed);
  const printing = finite && elapsed < t.printedAt;

  // The clock runs only while the agent works and the results print.
  useEffect(() => {
    if (!visible || paused || !printing) return;
    const id = window.setInterval(() => setElapsed((v) => Math.min(t.printedAt, v + CLOCK_MS)), CLOCK_MS);
    return () => window.clearInterval(id);
  }, [visible, paused, printing, t.printedAt]);

  // Then the finished results hold, and the next example starts, unless the visitor is reading.
  const held = paused || hover || focusWithin || engaged || !visible;
  useEffect(() => {
    if (!finite || printing || held) return;
    const id = window.setTimeout(() => choose((active + 1) % replays.length), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [finite, printing, held, active]);

  const shownSteps = Math.min(t.total, Math.floor(elapsed / t.stepMs));
  const done = shownSteps >= t.total;
  const opened = elapsed >= t.openAt;
  const reveal = opened ? Math.min(t.parts, Math.floor((elapsed - t.openAt) / PART_MS) + 1) : 0;
  const view = userView ?? (opened ? "results" : "code");

  // Keep the newest step in view while the agent works.
  useEffect(() => {
    const el = threadRef.current;
    if (el && !done && !engaged) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shownSteps, done, engaged]);

  // Follow each part of the results as it prints, until the visitor scrolls on their own.
  useEffect(() => {
    if (view !== "results" || engaged || reveal < 2) return;
    const desk = viewRef.current?.querySelector<HTMLElement>(".report-desk");
    const parts = desk?.querySelectorAll<HTMLElement>(".report__part");
    const last = parts?.[parts.length - 1];
    if (desk && last) desk.scrollTo({ top: Math.max(0, last.offsetTop - 12), behavior: "smooth" });
  }, [reveal, view, engaged]);

  function choose(i: number) {
    setActive(i);
    setUserView(null);
    setElapsed(prefersReducedMotion() ? Infinity : 0);
    setEngaged(false);
    if (threadRef.current) threadRef.current.scrollTop = 0;
  }

  const lines = replay.code.split("\n");
  const writeStart = replay.writesAt * t.stepMs;
  const writeProgress = Math.min(1, Math.max(0, (elapsed - writeStart) / Math.max(1, t.workEnd - writeStart)));
  const shownLines = Math.round(lines.length * writeProgress);
  const FileIcon = replay.result.kind === "research" ? FileText : FileCode2;
  const engage = () => setEngaged(true);

  return (
    <div className="pw">
      <div className="pw__tabs" role="tablist" aria-label="Example sessions" onKeyDown={onTablistKeyDown}>
        {replays.map((r, i) => (
          <button
            key={r.id}
            id={`pw-tab-${r.id}`}
            role="tab"
            aria-selected={i === active}
            aria-controls="pw-panel"
            tabIndex={i === active ? 0 : -1}
            className={i === active ? "is-on" : ""}
            onClick={() => choose(i)}
          >
            {r.tab}
          </button>
        ))}
      </div>

      <div
        ref={frameRef}
        id="pw-panel"
        className="pw__frame"
        role="tabpanel"
        aria-labelledby={`pw-tab-${replay.id}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
        }}
      >
        <div className="pw__top">
          <span className="pw__mark">{APP_NAME}</span>
          <span className="pw__modes" aria-hidden>
            <span className={replay.mode === "Backtest" ? "is-on" : ""}>Backtest</span>
            <span className={replay.mode === "Analyze" ? "is-on" : ""}>Analyze</span>
          </span>
          <span className="pw__controls">
            {finite && (
              <button
                className="pw__btn"
                onClick={() => setPaused((v) => !v)}
                aria-label={paused ? "Play the replay" : "Pause the replay"}
              >
                {paused ? <Play size={13} aria-hidden fill="currentColor" /> : <Pause size={13} aria-hidden fill="currentColor" />}
                {paused ? "Play" : "Pause"}
              </button>
            )}
            <button className="pw__btn" onClick={() => choose(active)} aria-label="Replay this example">
              <RotateCcw size={13} aria-hidden />
              Replay
            </button>
          </span>
        </div>

        <div className="pw__body">
          <aside className="pw__thread" ref={threadRef} aria-label="Agent steps" onWheel={engage} onTouchMove={engage}>
            <div className="pw__ask">
              {replay.clip && (
                <span className="pw__clip">
                  <Paperclip size={13} aria-hidden />
                  {replay.clip}
                </span>
              )}
              <p>{replay.ask}</p>
            </div>
            <ol className="pw__steps">
              {replay.steps.slice(0, shownSteps).map((s) => (
                <li key={s.id}>
                  <Check size={14} strokeWidth={3} aria-hidden className="pw__tick" />
                  <div>
                    <p>{s.text}</p>
                    {s.detail && <p className="pw__detail">{s.detail}</p>}
                    {s.rules && (
                      <ul className="pw__rules">
                        {s.rules.map((r) => (
                          <li key={r.text}>
                            <span>{r.text}</span>
                            <span className="pw__at">{r.at}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
              {!done && <li className="pw__working">Working…</li>}
            </ol>
            {opened && (
              <button
                className="pw__open"
                onClick={() => {
                  setUserView("results");
                  engage();
                }}
              >
                Open the results
              </button>
            )}
          </aside>

          <div className="pw__main">
            <div className="pw__filetabs" role="tablist" aria-label="Open files" onKeyDown={onTablistKeyDown}>
              <button
                id="pw-file-code"
                role="tab"
                aria-selected={view === "code"}
                aria-controls="pw-view"
                tabIndex={view === "code" ? 0 : -1}
                className={view === "code" ? "is-on" : ""}
                onClick={() => {
                  setUserView("code");
                  engage();
                }}
              >
                <FileIcon size={13} aria-hidden />
                {replay.file}
              </button>
              <button
                id="pw-file-results"
                role="tab"
                aria-selected={view === "results"}
                aria-controls="pw-view"
                tabIndex={view === "results" ? 0 : -1}
                className={view === "results" ? "is-on" : ""}
                onClick={() => {
                  setUserView("results");
                  engage();
                }}
                disabled={!opened}
                title={opened ? undefined : "Results appear after a clean run"}
              >
                <Check size={13} aria-hidden />
                Results
              </button>
            </div>

            <div
              id="pw-view"
              className="pw__view"
              ref={viewRef}
              role="tabpanel"
              aria-labelledby={view === "code" ? "pw-file-code" : "pw-file-results"}
              onWheel={engage}
              onTouchMove={engage}
              onPointerDown={engage}
            >
              {view === "code" ? (
                <pre className="pw__code" tabIndex={0} aria-label={`${replay.file} contents`}>
                  {lines.slice(0, done ? lines.length : shownLines).map((line, i) => (
                    <span key={i} className={/^\s*(\/\/|#|"""|\|)/.test(line) ? "is-quiet" : ""}>
                      <span className="pw__ln">{i + 1}</span>
                      {line || " "}
                      {"\n"}
                    </span>
                  ))}
                  {!done && shownLines > 0 && <span className="pw__caret" aria-hidden />}
                </pre>
              ) : replay.result.kind === "backtest" ? (
                <ResultsView key={replay.id} runId={replay.result.runId} reveal={reveal || t.parts} />
              ) : (
                <ResearchSheet key={replay.id} which={replay.result.which} reveal={reveal || t.parts} />
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="pw__note">
        Replays of example sessions with example values. Scroll the results, turn the 3D chart, or switch tabs. The
        replay stops on whatever you touch.
      </p>
    </div>
  );
}

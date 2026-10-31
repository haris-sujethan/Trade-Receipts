import { useEffect, useRef, useState } from "react";
import { Check, FileCode2, FileText, Paperclip, RotateCcw } from "lucide-react";
import { APP_NAME } from "../../config";
import { acmeResearch, cashflowPython, moonResearch, rsiPine, rsiThread, type ThreadStep } from "../../data/examples";
import { ResultsView } from "../../ide/ResultsView";
import { ResearchSheet } from "./ResearchSheet";
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

/** The working part of each replay takes this long, however many steps it has. */
const WORK_MS = 2400;
/** Then the results stay up this long before the next example. */
const HOLD_MS = 9000;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ProductWindow() {
  const [active, setActive] = useState(0);
  const replay = replays[active];
  const total = replay.steps.length;
  const [tick, setTick] = useState(() => (prefersReducedMotion() ? total : 0));
  const [view, setView] = useState<"code" | "results">("code");
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLElement>(null);
  const done = tick >= total;

  // Only play while the window is on screen.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reveal the steps quickly, flip to the results, hold, then move on.
  useEffect(() => {
    if (!visible || prefersReducedMotion()) return;
    if (!done) {
      const t = window.setTimeout(() => setTick((v) => v + 1), WORK_MS / total);
      return () => window.clearTimeout(t);
    }
    if (paused) return;
    const t = window.setTimeout(() => choose((active + 1) % replays.length), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [tick, total, done, visible, paused, active]);

  useEffect(() => {
    if (done) setView("results");
  }, [done]);

  // Keep the newest step in view while the agent works.
  useEffect(() => {
    const el = threadRef.current;
    if (el && !done) el.scrollTop = el.scrollHeight;
  }, [tick, done]);

  function choose(i: number) {
    setActive(i);
    setView("code");
    setTick(prefersReducedMotion() ? replays[i].steps.length : 0);
    if (threadRef.current) threadRef.current.scrollTop = 0;
  }

  const shownSteps = Math.min(tick, total);
  const lines = replay.code.split("\n");
  const writeProgress =
    tick <= replay.writesAt ? 0 : Math.min(1, (tick - replay.writesAt) / Math.max(1, total - replay.writesAt));
  const shownLines = Math.round(lines.length * writeProgress);
  const FileIcon = replay.result.kind === "research" ? FileText : FileCode2;

  return (
    <div className="pw">
      <div className="pw__tabs" role="tablist" aria-label="Example sessions">
        {replays.map((r, i) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={i === active}
            className={i === active ? "is-on" : ""}
            onClick={() => choose(i)}
          >
            {r.tab}
          </button>
        ))}
      </div>

      <div
        ref={frameRef}
        className="pw__frame"
        role="tabpanel"
        aria-label={`${replay.tab}, replayed`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="pw__top">
          <span className="pw__mark">{APP_NAME}</span>
          <span className="pw__modes" aria-hidden>
            <span className={replay.mode === "Backtest" ? "is-on" : ""}>Backtest</span>
            <span className={replay.mode === "Analyze" ? "is-on" : ""}>Analyze</span>
          </span>
          <button className="pw__replay" onClick={() => choose(active)} aria-label="Replay this example">
            <RotateCcw size={14} aria-hidden />
            Replay
          </button>
        </div>

        <div className="pw__body">
          <aside className="pw__thread" ref={threadRef} aria-label="Agent steps">
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
            {done && (
              <button className="pw__open" onClick={() => setView("results")}>
                Open the results
              </button>
            )}
          </aside>

          <div className="pw__main">
            <div className="pw__filetabs" role="tablist" aria-label="Open files">
              <button
                role="tab"
                aria-selected={view === "code"}
                className={view === "code" ? "is-on" : ""}
                onClick={() => setView("code")}
              >
                <FileIcon size={13} aria-hidden />
                {replay.file}
              </button>
              <button
                role="tab"
                aria-selected={view === "results"}
                className={view === "results" ? "is-on" : ""}
                onClick={() => setView("results")}
                disabled={!done}
                title={done ? undefined : "Results appear after a clean run"}
              >
                <Check size={13} aria-hidden />
                Results
              </button>
            </div>

            <div className="pw__view">
              {view === "code" ? (
                <pre className="pw__code" aria-label={`${replay.file} contents`}>
                  {lines.slice(0, done ? lines.length : shownLines).map((line, i) => (
                    <span key={i} className={/^\s*(\/\/|#|"""|\|)/.test(line) ? "is-quiet" : ""}>
                      <span className="pw__ln">{i + 1}</span>
                      {line || " "}
                      {"\n"}
                    </span>
                  ))}
                </pre>
              ) : replay.result.kind === "backtest" ? (
                <ResultsView key={replay.id} runId={replay.result.runId} />
              ) : (
                <ResearchSheet key={replay.id} which={replay.result.which} />
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="pw__note">
        Replays of example sessions with example values. Scroll the results, turn the 3D chart, or switch tabs.
      </p>
    </div>
  );
}

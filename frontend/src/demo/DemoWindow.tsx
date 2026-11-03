import { useEffect, useRef } from "react";
import { ChartView, Composer, HoldersView, RunSteps } from "./CheckViews";
import { ResultPanel } from "./ResultPanel";
import type { Run } from "./runs";
import type { Frame, Plan, View } from "./timeline";

type Props = {
  run: Run;
  plan: Plan;
  frame: Frame;
  view: View | null;
  onView: (v: View) => void;
};

export function DemoWindow({ run, plan, frame, view, onView }: Props) {
  const answer = plan.answer;
  const check = answer?.check;
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the newest line of the thread in view as the agent works.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [frame.steps.length, frame.answerChars, frame.counters, frame.audited]);

  const tabs: { id: View; label: string; ready: boolean }[] = [
    { id: "chart", label: "Chart", ready: frame.kindsStarted.includes("token") },
    { id: "holders", label: "Holders", ready: frame.kindsStarted.includes("wallets") },
    { id: "result", label: "Result", ready: frame.answerChars > 0 },
  ];

  return (
    <div className="win">
      <div className="win__bar">
        <span className="win__lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="win__title">Trade Receipts</span>
        <span className="win__mode" aria-hidden>
          <span className="is-on">Analyze</span>
          <span>Copy trade</span>
        </span>
      </div>

      <div className="win__body">
        <section className="ws" aria-label="Workspace">
          <div className="ws__tabs" role="tablist" aria-label="Workspace views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={view === tab.id}
                disabled={!tab.ready}
                className={view === tab.id ? "is-on" : ""}
                onClick={() => onView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ws__view">
            {!view && (
              <div className="ws__start">
                <p className="ws__start-h">Check a token</p>
                <Composer text={run.message.slice(0, frame.typed)} typing={frame.typed > 0} wide />
              </div>
            )}
            {view === "chart" && check && <ChartView check={check} frame={frame} />}
            {view === "holders" && check && <HoldersView check={check} frame={frame} />}
            {view === "result" && check && (
              <ResultPanel check={check} about={run.about} claim={null} reveal={frame.finished ? 1 : Math.min(1, frame.answerChars / Math.max(1, plan.words.length * 0.8))} />
            )}
          </div>
        </section>

        <aside className="thread" aria-label="Agent chat">
          <div className="thread__head">
            <span>Is this token a rug?</span>
          </div>
          <div className="thread__body" ref={threadRef}>
            {frame.sent && (
              <div className="msg-user">
                <p>{run.message}</p>
              </div>
            )}
            <RunSteps frame={frame} words={plan.words} answer={answer} />
          </div>
          <Composer text="" />
        </aside>
      </div>
    </div>
  );
}

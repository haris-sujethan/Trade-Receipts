import { useEffect, useRef } from "react";
import { ChartView, Composer, HoldersView, RunSteps } from "./CheckViews";
import { CopySummary } from "./CopyViews";
import { MarkKey, PositionChart } from "./PositionChart";
import { ResultPanel } from "./ResultPanel";
import { whole, type Run } from "./runs";
import type { Frame, Plan, View } from "./timeline";

type Props = {
  run: Run;
  plan: Plan;
  frame: Frame;
  view: View | null;
  onView: (v: View) => void;
};

/** The app window on the home page's desktop: a rug check (chart, holders, result) or a copy-trade backtest. */
export function DemoWindow({ run, plan, frame, view, onView }: Props) {
  const answer = plan.answer;
  const check = answer?.check;
  const copy = run.kind === "copy_trade" ? answer?.copy_trade : null;
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the newest line of the thread in view as the agent works.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [frame.steps.length, frame.answerChars, frame.counters, frame.audited]);

  // A backtest's workspace: its latest position's chart while the positions are priced, then the result.
  const priced = frame.kindsStarted.includes("positions");
  const copyView: View | null = !copy ? null : view === "result" ? "result" : view && priced ? "chart" : null;
  const shown = copy ? copyView : view;
  const tabs: { id: View; label: string; ready: boolean }[] = copy
    ? [
        { id: "chart", label: "Latest position", ready: priced },
        { id: "result", label: "Result", ready: frame.answerChars > 0 },
      ]
    : [
        { id: "chart", label: "Chart", ready: frame.kindsStarted.includes("token") },
        { id: "holders", label: "Holders", ready: frame.kindsStarted.includes("wallets") },
        { id: "result", label: "Result", ready: frame.answerChars > 0 },
      ];
  const latest = copy?.rows[0];
  const c = frame.counters;

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
          <span className={copy ? "" : "is-on"}>Analyze</span>
          <span className={copy ? "is-on" : ""}>Copy trade</span>
        </span>
      </div>

      <div className="win__body">
        <section className="ws" aria-label="Workspace">
          <div className="ws__tabs" role="tablist" aria-label="Workspace views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={shown === tab.id}
                disabled={!tab.ready}
                className={shown === tab.id ? "is-on" : ""}
                onClick={() => onView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ws__view">
            {!shown && !(copy && frame.sent) && (
              <div className="ws__start">
                <p className="ws__start-h">{copy ? "Copy a wallet" : "Check a token"}</p>
                <Composer text={run.message.slice(0, frame.typed)} typing={frame.typed > 0} wide />
              </div>
            )}
            {copy && !shown && frame.sent && (
              <div className="ws__head">
                <p className="ws__h">Reading the wallet’s trades</p>
                <p className="ws__sub">
                  {c.walletTx != null ? `${whole(c.walletTx)} transactions read${c.found != null ? `, ${c.found} closed positions found` : ""}` : "Starting"}
                </p>
              </div>
            )}
            {copy && shown === "chart" && latest && (
              <div className="copyd">
                <div className="ws__head">
                  <p className="ws__h">{latest.symbol || latest.mint.slice(0, 6)}, its latest position: held {latest.held_s} s</p>
                  <p className="ws__sub">{c.positions ? `${c.positions[0]} of ${c.positions[1]} positions priced` : `${copy.positions} positions priced`}</p>
                </div>
                <PositionChart p={latest} buyAfter={copy.buy_after_s} sellAfter={copy.sell_after_s} width={640} height={230} />
                <ul className="pchart__legend">
                  <li>
                    <MarkKey who="wallet" />
                    Its buys and sells
                  </li>
                  <li>
                    <MarkKey who="you" />
                    Yours, copied late
                  </li>
                  <li>
                    <i className="pchart__legend-wait" />
                    The move while you wait
                  </li>
                </ul>
              </div>
            )}
            {copy && shown === "result" && (
              <div className="copyr copyd">
                <CopySummary r={copy} />
              </div>
            )}
            {!copy && view === "chart" && check && <ChartView check={check} frame={frame} />}
            {!copy && view === "holders" && check && <HoldersView check={check} frame={frame} />}
            {!copy && view === "result" && check && (
              <ResultPanel check={check} about={run.about} claim={null} reveal={frame.finished ? 1 : Math.min(1, frame.answerChars / Math.max(1, plan.words.length * 0.8))} />
            )}
          </div>
        </section>

        <aside className="thread" aria-label="Agent chat">
          <div className="thread__head">
            <span>{copy ? "What if I copied this wallet?" : "Is this token a rug?"}</span>
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

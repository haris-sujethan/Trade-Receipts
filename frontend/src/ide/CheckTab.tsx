import { AlertTriangle, LoaderCircle } from "lucide-react";
import { Answer, ChartView, HoldersView } from "../demo/CheckViews";
import { CheckCards } from "../demo/Checks";
import { ResultPanel } from "../demo/ResultPanel";
import { shortAddr } from "../demo/runs";
import { onTablistKeyDown } from "../lib/tabs";
import { useBackend, useCheckFrame } from "./live";
import { useIde, type CheckRun } from "./state";
import "../demo/demo.css";

type View = "overview" | "chart" | "holders" | "signals";

/** What a check that ended without a score says (the backend's statuses, receipts/crypto/live.py). */
const UNSCORED: Record<string, string> = {
  below_floor: "Too little activity to score yet",
  rugged: "Already rugged",
  too_old: "Older than a day: the model covers a token's first day",
  not_sol_quoted: "Priced in another token, not SOL: the model covers SOL-priced tokens",
};

/** A rug check in the editor area: what it covered, then its overview, chart, holders and signals. */
export function CheckTab({ check }: { check: CheckRun }) {
  const { state, dispatch } = useIde();
  const backend = useBackend();
  const cf = useCheckFrame(check, () => dispatch({ type: "finishCheck", key: check.key }));
  if (!cf) return null;
  const { frame, words, answer } = cf;
  const data = answer?.check;
  // A check that ended without a score (too little activity, already rugged) has no chart or holders to show.
  const scored = !!data?.chart;
  const fromRun = check.run.events.find((e) => e.type === "step" && e.tool === "check_token" && e.status === "running");
  const auto: View | null = frame.view === "result" ? "overview" : frame.view;
  const picked = state.checkViews[check.key];
  const view: View | null = picked ?? auto;
  const ready: Record<View, boolean> = {
    overview: !!data && frame.answerChars > 0,
    chart: scored && frame.kindsStarted.includes("token"),
    holders: scored && frame.kindsStarted.includes("wallets"),
    signals: scored && frame.finished,
  };
  const tabs: { id: View; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "chart", label: "Chart" },
    { id: "holders", label: "Holders" },
    { id: "signals", label: "Signals" },
  ];
  const mint = data?.mint ?? (fromRun && fromRun.type === "step" ? String(fromRun.args?.mint ?? "") : "");
  const saved = check.mode === "replay";

  return (
    <div className="check">
      <div className="runbar">
        <dl className="runbar__settings" aria-label="What this check covered">
          <div>
            <dt>Token</dt>
            <dd>{data ? data.symbol : "Reading"}</dd>
          </div>
          <div>
            <dt>Mint</dt>
            <dd className="mono">{mint ? shortAddr(mint) : "Not yet"}</dd>
          </div>
          <div>
            <dt>Checked at</dt>
            <dd>{data?.age_s != null ? `${Math.round(data.age_s / 60)} min after launch` : "Now"}</dd>
          </div>
        </dl>
        <p className="runbar__note">
          {saved
            ? backend === "online"
              ? "Saved check, replayed. Ask in the thread to check another token live."
              : "Saved check, replayed. Live checks are coming soon."
            : check.status === "running"
              ? "Live check, running"
              : check.status === "error"
                ? "Live check, stopped"
                : "Live check"}
        </p>
      </div>

      <div className="check__tabs" role="tablist" aria-label="Check views" onKeyDown={onTablistKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            aria-controls={`check-${check.key}`}
            tabIndex={view === t.id ? 0 : -1}
            disabled={!ready[t.id]}
            className={view === t.id ? "is-on" : ""}
            onClick={() => dispatch({ type: "checkView", key: check.key, view: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`check-${check.key}`} className="check__body" role="tabpanel">
        {check.status === "error" && (
          <div className="check__state check__state--error" role="alert">
            <AlertTriangle size={18} aria-hidden />
            <div>
              <p className="check__state-title">The check stopped</p>
              <p>{check.error}</p>
            </div>
          </div>
        )}
        {check.status !== "error" && !data && (
          <div className="check__state">
            <LoaderCircle size={18} className="spin" aria-hidden />
            <div>
              <p className="check__state-title">{frame.steps.length ? "The agent is working" : "Waiting for the agent"}</p>
              <p>{saved ? "The chart and holders fill in here as the token is read." : "A live check takes about a minute. The chart, holders and signals open here when it’s done."}</p>
            </div>
          </div>
        )}
        {data && !scored && (
          <div className="check__state">
            <AlertTriangle size={18} aria-hidden />
            <div>
              <p className="check__state-title">{UNSCORED[data.status ?? ""] ?? "No rug chance for this token"}</p>
              <Answer text={words.slice(0, frame.answerChars || words.length).join("")} />
            </div>
          </div>
        )}
        {data && scored && view === "overview" && (
          <div data-tour="results">
            <ResultPanel
              check={data}
              about={saved ? check.run.about : ""}
              claim={null}
              reveal={frame.finished ? 1 : Math.min(1, frame.answerChars / Math.max(1, words.length * 0.8))}
              explanation={
                <>
                  {answer?.explained_by === null && <p className="result__small">Written from the check’s own findings; the agent is off.</p>}
                  <Answer text={words.slice(0, frame.answerChars).join("")} />
                </>
              }
            />
          </div>
        )}
        {data && scored && view === "chart" && (
          <div data-tour="chart">
            <ChartView check={data} frame={frame} width={900} height={380} />
          </div>
        )}
        {data && scored && view === "holders" && (
          <div data-tour="holders">
            <HoldersView check={data} frame={frame} mapWidth={560} mapHeight={380} rows={12} />
          </div>
        )}
        {data && scored && view === "signals" && (
          <div className="check__signals" data-tour="signals">
            <CheckCards run={check.run} check={data} />
            <p className="checks__note">
              Each card is one family of signals, with {data.symbol}’s values {Math.round(data.age_s / 60)} minutes after launch. The model card’s picture is an
              illustration. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

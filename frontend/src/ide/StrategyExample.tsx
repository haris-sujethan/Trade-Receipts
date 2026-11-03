import { Check, Paperclip } from "lucide-react";
import { projectFiles, rsiThread, type ThreadStep } from "../data/examples";
import { useIde } from "./state";

/**
 * Unplugged Nov 3: the strategy backtest's example thread (a clip coded as Pine and tested). The site's second feature
 * is now the copy-trade backtest; this stays for when strategy backtests return, like the stock code.
 */

/** The example backtest: a strategy from a clip, coded and tested. It's already finished. */
export function BacktestExample() {
  const { dispatch } = useIde();
  const steps = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : []));
  const user = rsiThread.find((m) => m.kind === "user");
  const agent = rsiThread.find((m) => m.kind === "agent");
  return (
    <>
      {user && user.kind === "user" && (
        <div className="msg msg--user">
          {user.clip && (
            <button className="clip-chip" onClick={() => dispatch({ type: "open", id: "clip" })}>
              <Paperclip size={13} aria-hidden />
              <span className="mono">
                {user.clip.name}, {user.clip.length}
              </span>
            </button>
          )}
          <p>{user.text}</p>
        </div>
      )}
      <ol className="steps-ex" aria-label="Agent steps">
        {steps.map((s) => (
          <Step key={s.id} step={s} />
        ))}
      </ol>
      {agent && agent.kind === "agent" && (
        <div className="msg msg--agent">
          <p>{agent.text}</p>
          {agent.audited && (
            <p className="msg__audit">
              <Check size={13} aria-hidden /> Numbers checked against the run
            </p>
          )}
          <button className="tool-btn" onClick={() => dispatch({ type: "open", id: "results:rsi" })}>
            Open the results
          </button>
        </div>
      )}
    </>
  );
}

/** One step of the example backtest. */
function Step({ step }: { step: ThreadStep }) {
  const { dispatch } = useIde();
  const wrote = step.text.startsWith("Wrote");
  const writtenName = wrote ? step.text.split("/").pop()! : "";
  const written = projectFiles.find((f) => f.name === writtenName);
  const lines = written ? written.content.split("\n").length : 0;

  return (
    <li className="step">
      <Check size={14} strokeWidth={3} className="step__tick" aria-hidden />
      <div className="step__body">
        <p className="step__text">
          {step.text}
          {step.meta && <span className="step__meta">{step.meta}</span>}
        </p>
        {step.detail && <p className="step__detail">{step.detail}</p>}
        {step.rules && (
          <ul className="step__rules">
            {step.rules.map((r) => (
              <li key={r.text}>
                <span>{r.text}</span>
                <button className="at" title="Open the clip at this moment" aria-label={`Open the clip at ${r.at}`} onClick={() => dispatch({ type: "open", id: "clip" })}>
                  {r.at}
                </button>
              </li>
            ))}
          </ul>
        )}
        {step.diff && (
          <pre className="diff" aria-label="Changes">
            {step.diff.minus.map((l) => (
              <span key={`-${l}`} className="diff__minus">
                - {l}
                {"\n"}
              </span>
            ))}
            {step.diff.plus.map((l) => (
              <span key={`+${l}`} className="diff__plus">
                + {l}
                {"\n"}
              </span>
            ))}
          </pre>
        )}
        {wrote && (
          <div className="edit-card">
            <span className="mono">{writtenName}</span>
            <span className="edit-card__count">+{lines} lines</span>
            <span className="edit-card__state">Accepted</span>
          </div>
        )}
      </div>
    </li>
  );
}

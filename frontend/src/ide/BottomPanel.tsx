import { AlertTriangle, Info, XCircle } from "lucide-react";
import { projectFiles } from "../data/examples";
import { answerOf } from "../demo/runs";
import { onTablistKeyDown } from "../lib/tabs";
import { focusCheck, outputFor, problemsFor, useIde } from "./state";

const icons = {
  error: <XCircle size={14} aria-hidden className="sev sev--error" />,
  warning: <AlertTriangle size={14} aria-hidden className="sev sev--warning" />,
  info: <Info size={14} aria-hidden className="sev sev--info" />,
};

export function BottomPanel() {
  const { state, dispatch } = useIde();
  const problems = problemsFor(state);
  const output = outputFor(state);
  const check = focusCheck(state);

  function jump(file: string) {
    // A check's flags open its overview.
    if (check && file === answerOf(check.run)?.check?.symbol) {
      dispatch({ type: "open", id: `check:${check.key}` });
      dispatch({ type: "checkView", key: check.key, view: "overview" });
      return;
    }
    if (file === "Results") {
      const last = state.ranRuns[state.ranRuns.length - 1];
      if (last) dispatch({ type: "open", id: `results:${last}` });
      return;
    }
    const f = projectFiles.find((p) => p.name === file);
    if (f) dispatch({ type: "open", id: f.id });
  }

  return (
    <section className="bottom" aria-label="Problems and output" data-tour="problems">
      <div className="bottom__tabs" role="tablist" aria-label="Problems and output" onKeyDown={onTablistKeyDown}>
        {(["problems", "output"] as const).map((tab) => (
          <button
            key={tab}
            id={`bottom-tab-${tab}`}
            role="tab"
            aria-selected={state.bottomTab === tab}
            aria-controls="bottom-panel"
            tabIndex={state.bottomTab === tab ? 0 : -1}
            className={state.bottomTab === tab ? "is-on" : ""}
            onClick={() => dispatch({ type: "bottomTab", tab })}
          >
            {tab === "problems" ? "Problems" : "Output"}
            {tab === "problems" && problems.length > 0 && <span className="count">{problems.length}</span>}
          </button>
        ))}
      </div>

      <div id="bottom-panel" className="bottom__body" role="tabpanel" aria-labelledby={`bottom-tab-${state.bottomTab}`} tabIndex={0}>
        {state.bottomTab === "problems" &&
          (problems.length === 0 ? (
            <p className="bottom__empty">No problems yet. A check’s flags and a backtest’s honesty issues show up here.</p>
          ) : (
            <ul className="problems">
              {problems.map((p, i) => (
                <li key={i}>
                  <button onClick={() => jump(p.file)}>
                    {icons[p.severity]}
                    <span className="sr-only">{p.severity}: </span>
                    <span className="problems__msg">{p.message}</span>
                    <span className="problems__where mono">
                      {p.file}
                      {p.line ? `:${p.line}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {state.bottomTab === "output" &&
          (output.length === 0 ? (
            <p className="bottom__empty">Run logs show up here.</p>
          ) : (
            <pre className="output">{output.join("\n")}</pre>
          ))}
      </div>
    </section>
  );
}

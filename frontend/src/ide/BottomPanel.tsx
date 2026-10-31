import { AlertTriangle, Info, XCircle } from "lucide-react";
import { projectFiles } from "../data/examples";
import { outputFor, problemsFor, useIde } from "./state";

const icons = {
  error: <XCircle size={14} aria-hidden className="sev sev--error" />,
  warning: <AlertTriangle size={14} aria-hidden className="sev sev--warning" />,
  info: <Info size={14} aria-hidden className="sev sev--info" />,
};

export function BottomPanel() {
  const { state, dispatch } = useIde();
  const problems = problemsFor(state.ranRuns);
  const output = outputFor(state.ranRuns);

  function jump(file: string) {
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
      <div className="bottom__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={state.bottomTab === "problems"}
          className={state.bottomTab === "problems" ? "is-on" : ""}
          onClick={() => dispatch({ type: "bottomTab", tab: "problems" })}
        >
          Problems
          {problems.length > 0 && <span className="count">{problems.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={state.bottomTab === "output"}
          className={state.bottomTab === "output" ? "is-on" : ""}
          onClick={() => dispatch({ type: "bottomTab", tab: "output" })}
        >
          Output
        </button>
      </div>

      <div className="bottom__body" role="tabpanel">
        {state.bottomTab === "problems" &&
          (problems.length === 0 ? (
            <p className="bottom__empty">No problems yet. Compile errors and honesty issues show up here after a run.</p>
          ) : (
            <ul className="problems">
              {problems.map((p, i) => (
                <li key={i}>
                  <button onClick={() => jump(p.file)}>
                    {icons[p.severity]}
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

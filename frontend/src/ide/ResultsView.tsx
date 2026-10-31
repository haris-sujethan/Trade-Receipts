import type { ReactElement } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { FactsLabel } from "../components/FactsLabel";
import { runs, type CheckStatus } from "../data/examples";
import { EquityChart } from "./EquityChart";

const statusIcon: Record<CheckStatus, ReactElement> = {
  pass: <CheckCircle2 size={15} aria-hidden />,
  caution: <AlertTriangle size={15} aria-hidden />,
  fail: <XCircle size={15} aria-hidden />,
};

const statusWord: Record<CheckStatus, string> = { pass: "Pass", caution: "Caution", fail: "Fail" };

export function ResultsView({ runId }: { runId: string }) {
  const run = runs[runId];
  if (!run) {
    return (
      <div className="empty">
        <p className="empty__title">No results yet.</p>
        <p className="empty__body">Press Run to test this strategy.</p>
      </div>
    );
  }

  return (
    <div className="results" data-tour="results">
      <div className="results__main">
        <p className="results__verdict">{run.verdict}</p>
        {run.claim && <p className="results__claim">{run.claim}</p>}
        <p className="results__audit">
          <CheckCircle2 size={13} aria-hidden /> Every number above matches the run. Example values.
        </p>

        <EquityChart series={run.series} drawdown={run.drawdown} />

        <section className="checks" aria-labelledby={`checks-${runId}`}>
          <h3 id={`checks-${runId}`}>Honesty checks</h3>
          <ul>
            {run.checks.map((c) => (
              <li key={c.name} className={`check check--${c.status}`}>
                <span className="check__status">
                  {statusIcon[c.status]}
                  {statusWord[c.status]}
                </span>
                <span className="check__name">{c.name}</span>
                <span className="check__note">{c.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="results__side" aria-label="Strategy Facts label">
        <FactsLabel facts={run.facts} size="compact" />
        {run.readings && (
          <section className="readings" aria-labelledby={`readings-${runId}`}>
            <h3 id={`readings-${runId}`}>{run.readings.rule} was ambiguous</h3>
            <p>Both readings were tested.</p>
            <table>
              <tbody>
                {run.readings.options.map((o) => (
                  <tr key={o.reading} className={o.chosen ? "is-chosen" : ""}>
                    <th scope="row">
                      {o.reading}
                      {o.chosen && <span className="readings__tag">used in the label</span>}
                    </th>
                    <td>{o.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </aside>
    </div>
  );
}

import { FileSearch } from "lucide-react";
import { FactsLabel } from "../components/FactsLabel";
import { acme, acmeFacts } from "../data/examples";

function Bars({ title, unit, values, labels }: { title: string; unit: string; values: number[]; labels: string[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.9;
  return (
    <figure className="bars">
      <figcaption>{title}</figcaption>
      <div className="bars__plot">
        {values.map((v, i) => (
          <div key={labels[i]} className="bars__col">
            <span className="bars__value">
              {v}
              {unit}
            </span>
            <span className="bars__bar" style={{ height: `${((v - min) / (max - min)) * 100}%` }} />
            <span className="bars__label">{labels[i]}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

const quarters = ["Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"];

export function ResearchView() {
  return (
    <div className="research">
      <div className="research__main">
        <header className="research__head">
          <h2>
            {acme.name} <span className="research__ticker">{acme.ticker}</span>
          </h2>
          <p>
            {acme.filing}. ACME is a made-up company; all values are examples.
          </p>
        </header>

        <p className="results__verdict">{acme.answer}</p>

        <section className="claims" aria-labelledby="claims-title">
          <h3 id="claims-title">Claims vs. filings</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Claim</th>
                <th scope="col">Said at</th>
                <th scope="col">Filings say</th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {acme.claims.map((c) => (
                <tr key={c.claim}>
                  <td>{c.claim}</td>
                  <td className="mono">{c.at}</td>
                  <td>{c.facts}</td>
                  <td className="is-bad">{c.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="research__trends">
          <Bars title="Revenue by quarter ($M)" unit="" values={acme.revenue} labels={quarters} />
          <Bars title="Diluted shares by quarter (M)" unit="" values={acme.shares} labels={quarters} />
        </div>

        <button className="tool-btn tool-btn--wide" disabled title="Needs the backend, which isn't connected yet">
          <FileSearch size={14} aria-hidden />
          Backtest companies like this
        </button>
      </div>

      <aside className="results__side" aria-label="Company Facts label">
        <FactsLabel facts={acmeFacts} title="Company Facts" size="compact" />
      </aside>
    </div>
  );
}

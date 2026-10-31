import type { ReactElement, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { FactsLabel } from "../components/FactsLabel";
import { runs, type CheckStatus } from "../data/examples";
import { REGIME_COLORS, REGIMES, reportFor, type Tile } from "../data/report";
import { EquityPlot, MonthlyPlot, RegimePlot, ReturnsHistogram, TradesPlot3D } from "./report/charts";
import "./report/report.css";

const statusIcon: Record<CheckStatus, ReactElement> = {
  pass: <CheckCircle2 size={15} aria-hidden />,
  caution: <AlertTriangle size={15} aria-hidden />,
  fail: <XCircle size={15} aria-hidden />,
};

const statusWord: Record<CheckStatus, string> = { pass: "Pass", caution: "Caution", fail: "Fail" };

function money(v: number) {
  return `${v < 0 ? "−" : "+"}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

function Tiles({ tiles, cols = 3 }: { tiles: Tile[]; cols?: number }) {
  return (
    <dl className="tiles" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {tiles.map((t) => (
        <div key={t.label} className="tile">
          <dt>{t.label}</dt>
          <dd className={t.bad ? "is-bad" : ""}>{t.value}</dd>
          {t.note && <p className="tile__note">{t.note}</p>}
        </div>
      ))}
    </dl>
  );
}

type Props = {
  runId: string;
  /** How many report parts to show, for the home page replay. Shows everything when omitted. */
  reveal?: number;
};

/** The report, in print order. The home page replay prints it one part at a time. */
function reportParts(runId: string): ReactNode[] | null {
  const run = runs[runId];
  const report = reportFor(runId);
  if (!run || !report) return null;

  const start = run.series.find((s) => s.focus)!.data[0].value;

  return [
    (
      <header className="report__head">
          <h2>{report.title}</h2>
          <p className="report__meta">{report.meta}</p>
          <p className="report__verdict">{run.verdict}</p>
          {run.claim && <p className="report__claim">{run.claim}</p>}
          <p className="report__audit">
            <CheckCircle2 size={13} aria-hidden /> Every number here comes from the run, not from the model.
          </p>
        </header>
    ),
    (
      <Tiles tiles={report.tiles} />
    ),
    (
      <section className="report__section" aria-labelledby={`eq-${runId}`}>
          <h3 id={`eq-${runId}`}>Equity</h3>
          <p className="report__sub">
            Growth of the starting money against {report.compareText}, with the drawdown from each peak underneath.
          </p>
          <EquityPlot series={run.series} dd={run.drawdown} start={start} />
        </section>
    ),
    (
      <section className="report__section" aria-labelledby={`rg-${runId}`}>
          <h3 id={`rg-${runId}`}>P&amp;L by market regime</h3>
          <p className="report__sub">Cumulative profit and loss, colored by the market regime on each entry day.</p>
          <Tiles tiles={report.regimeTiles} />
          <ul className="legend" aria-label="Market regimes">
            {REGIMES.map((g) => (
              <li key={g}>
                <i style={{ background: REGIME_COLORS[g] }} aria-hidden />
                {g} <b className={report.regimeTotals[g] < 0 ? "is-bad" : ""}>{money(report.regimeTotals[g])}</b>
              </li>
            ))}
          </ul>
          <RegimePlot report={report} />
          <p className="report__insight">{report.regimeInsight}</p>
        </section>
    ),
    (
      <section className="report__section" aria-labelledby={`tr-${runId}`}>
          <h3 id={`tr-${runId}`}>Every trade</h3>
          <p className="report__sub">
            {report.featureLabel}, {report.heldLabel.toLowerCase()}, and each trade's return. Drag to turn it.
          </p>
          <ul className="legend" aria-label="Trade outcomes">
            <li>
              <i className="dot dot--gain" aria-hidden /> Winners
            </li>
            <li>
              <i className="dot dot--loss" aria-hidden /> Losers
            </li>
          </ul>
          <TradesPlot3D report={report} />
          <p className="report__insight">{report.scatterInsight}</p>
        </section>
    ),
    (
      <div className="report__pair">
          <section className="report__section" aria-labelledby={`mo-${runId}`}>
            <h3 id={`mo-${runId}`}>Monthly returns</h3>
            <p className="report__sub">Each cell is that month's return, in percent.</p>
            <MonthlyPlot report={report} />
          </section>
          <section className="report__section" aria-labelledby={`hi-${runId}`}>
            <h3 id={`hi-${runId}`}>Trade returns</h3>
            <p className="report__sub">How often trades won or lost by each amount.</p>
            <ReturnsHistogram report={report} />
          </section>
        </div>
    ),
    (
      <section className="report__section" aria-labelledby={`ck-${runId}`}>
          <h3 id={`ck-${runId}`}>Honesty checks</h3>
          <p className="report__sub">Each check tries to break the result.</p>
          <ul className="report-checks">
            {run.checks.map((c) => (
              <li key={c.name} className={`report-check report-check--${c.status}`}>
                <span className="report-check__status">
                  {statusIcon[c.status]}
                  {statusWord[c.status]}
                </span>
                <span className="report-check__name">{c.name}</span>
                <span className="report-check__note">{c.note}</span>
              </li>
            ))}
          </ul>
        </section>
    ),
    run.readings ? (
      <section className="report__section" aria-labelledby={`rd-${runId}`}>
            <h3 id={`rd-${runId}`}>{run.readings.rule} was ambiguous</h3>
            <p className="report__sub">Both readings were tested. The label uses the first.</p>
            <table className="report-table">
              <tbody>
                {run.readings.options.map((o) => (
                  <tr key={o.reading} className={o.chosen ? "is-chosen" : ""}>
                    <th scope="row">{o.reading}</th>
                    <td>{o.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
    ) : null,
    (
      <section className="report__receipt" aria-labelledby={`rc-${runId}`}>
          <h3 id={`rc-${runId}`}>The receipt</h3>
          <p className="report__sub">The whole test on one label. Claimed numbers are struck through when the test disagrees.</p>
          <div className="report__label" data-tour="receipt">
            <FactsLabel facts={run.facts} />
          </div>
        </section>
    ),
  ].filter(Boolean);
}

export function ResultsView({ runId, reveal }: Props) {
  const parts = reportParts(runId);
  if (!parts) {
    return (
      <div className="empty">
        <p className="empty__title">No results for this file.</p>
        <p className="empty__body">It wasn't run in this preview. Running new code comes with the backend.</p>
      </div>
    );
  }

  const report = reportFor(runId)!;
  const shown = reveal === undefined ? parts : parts.slice(0, reveal);

  return (
    <div className="report-desk" data-tour="results" tabIndex={0}>
      <article className="report" aria-label={`Backtest report: ${report.title}`}>
        {shown.map((part, i) => (
          <div key={i} className={reveal === undefined ? undefined : "report__part"}>
            {part}
          </div>
        ))}
      </article>
    </div>
  );
}

const partCounts = new Map<string, number>();

/** How many parts a run's report has, so the home page replay knows when it's finished. */
export function resultParts(runId: string): number {
  if (!partCounts.has(runId)) partCounts.set(runId, reportParts(runId)?.length ?? 0);
  return partCounts.get(runId)!;
}

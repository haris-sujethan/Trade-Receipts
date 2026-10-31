import type { ReactElement, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { FactsLabel } from "../../components/FactsLabel";
import { GROUP_COLOR, GROUP_LABEL, GROUPS, statusWord, tokenChecks, type SignalStatus, type TokenCheck } from "../../data/tokens";
import { BubbleMap, RealChart } from "./tokenCharts";
import "./report.css";

const statusIcon: Record<SignalStatus, ReactElement> = {
  red: <XCircle size={15} aria-hidden />,
  caution: <AlertTriangle size={15} aria-hidden />,
  pass: <CheckCircle2 size={15} aria-hidden />,
  unknown: <CircleHelp size={15} aria-hidden />,
};

/** The rug check report, in print order. The home page replay prints it one part at a time. */
function tokenParts(t: TokenCheck): ReactNode[] {
  const id = t.id;
  return [
    <header className="report__head token__head">
      <p className="token__meta">
        {t.name} · pump.fun · <span className="mono">{t.mintShort}</span> · checked {t.age} after launch ·{" "}
        {t.stage.toLowerCase()} · from {t.checkedFrom}
      </p>
      <h2 className={`token__verdict ${t.verdict === "Likely rug" ? "is-likely" : ""}`}>{t.verdict}</h2>
      <p className="token__chance">
        <b>{t.rugChance}%</b> rug chance
      </p>
      <p className="token__basis">
        From a model trained on thousands of past pump.fun tokens. Example values for a made-up token.
      </p>
    </header>,
    <section className="report__section" aria-labelledby={`why-${id}`}>
      <h3 id={`why-${id}`}>Why</h3>
      <div className="token__why">
        {t.explanation.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <details className="token__model">
        <summary>How the model saw it</summary>
        <p className="mono">{t.modelView}</p>
      </details>
    </section>,
    <section className="report__section" aria-labelledby={`chart-${id}`}>
      <h3 id={`chart-${id}`}>The real chart</h3>
      <p className="report__sub">
        Market cap, with each candle's volume split by who traded. Hollow candles closed up, solid ones down. Team sells
        are marked.
      </p>
      <dl className="token__stats">
        <div>
          <dt>Buying from independent buyers</dt>
          <dd className={t.verdict === "Likely rug" ? "is-bad" : ""}>{t.independentShare}</dd>
        </div>
        <div>
          <dt>What the team could sell into now</dt>
          <dd>{t.teamCanSellInto}</dd>
        </div>
      </dl>
      <ul className="legend" aria-label="Chart key">
        {t.teamSells.length > 0 && (
          <li>
            <i className="key-tri" aria-hidden /> Team sell
          </li>
        )}
        {GROUPS.map((g) => (
          <li key={g}>
            <i className={`key-sw ${g === "likelyTeam" ? "key-sw--hatch" : ""}`} style={{ background: GROUP_COLOR[g] }} aria-hidden />
            {GROUP_LABEL[g]}
          </li>
        ))}
      </ul>
      <RealChart token={t} />
    </section>,
    <section className="report__section" aria-labelledby={`map-${id}`}>
      <h3 id={`map-${id}`}>Who holds it</h3>
      <p className="report__sub">
        The top 50 holders and the first 50 buyers, sized by share of supply. Solid lines link wallets with the same
        funder, transfers between them, or buys in the creator's bundle. Dotted lines link wallets funded from the same
        exchange with the same amount within minutes.
      </p>
      <ul className="legend" aria-label="Map key">
        <li>
          <i className="key-dot" style={{ background: GROUP_COLOR.team }} aria-hidden /> {GROUP_LABEL.team}
        </li>
        <li>
          <i className="key-dot" style={{ background: GROUP_COLOR.likelyTeam }} aria-hidden /> {GROUP_LABEL.likelyTeam}
        </li>
        <li>
          <i className="key-dot" style={{ background: GROUP_COLOR.sniper }} aria-hidden /> {GROUP_LABEL.sniper}
        </li>
        <li>
          <i className="key-dot" style={{ background: GROUP_COLOR.independent }} aria-hidden /> Everyone else
        </li>
        <li>
          <i className="key-dot key-dot--ring" aria-hidden /> Under a day old
        </li>
        {t.wallets.some((w) => w.role === "funder") && (
          <li>
            <i className="key-diamond" aria-hidden /> Funder
          </li>
        )}
        <li>
          <i className="key-line" style={{ borderColor: GROUP_COLOR.team }} aria-hidden /> Team link
        </li>
        <li>
          <i className="key-line key-line--dotted" style={{ borderColor: GROUP_COLOR.likelyTeam }} aria-hidden /> Likely-team
          link
        </li>
      </ul>
      <BubbleMap token={t} />
    </section>,
    <section className="report__section" aria-labelledby={`sig-${id}`}>
      <h3 id={`sig-${id}`}>Every signal</h3>
      <p className="report__sub">Each one as of the check. Live checks link every signal to its transactions.</p>
      <ul className="report-checks">
        {t.signals.map((s) => (
          <li key={s.name} className={`report-check report-check--${s.status === "red" ? "fail" : s.status === "caution" ? "caution" : "pass"}`}>
            <span className="report-check__status">
              {statusIcon[s.status]}
              {statusWord[s.status]}
            </span>
            <span className="report-check__name">{s.name}</span>
            <span className="report-check__note">{s.value}</span>
          </li>
        ))}
      </ul>
    </section>,
    t.claims ? (
      <section className="report__section" aria-labelledby={`cl-${id}`}>
        <h3 id={`cl-${id}`}>Claims vs. the chain</h3>
        <p className="report__sub">Each claim from the clip, checked against on-chain data.</p>
        <table className="report-table report-table--wide">
          <thead>
            <tr>
              <th scope="col">Claim</th>
              <th scope="col">Said at</th>
              <th scope="col">On-chain</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {t.claims.map((c) => (
              <tr key={c.claim}>
                <th scope="row">{c.claim}</th>
                <td>{c.at}</td>
                <td>{c.chain}</td>
                <td className={c.verdict === "Contradicted" ? "is-bad" : ""}>{c.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : null,
    <section className="report__section" aria-labelledby={`sim-${id}`}>
      <h3 id={`sim-${id}`}>Similar past tokens</h3>
      <p className="report__sub">The past launches that looked most like this one at the same age, and how each ended.</p>
      <table className="report-table report-table--wide">
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Similarity</th>
            <th scope="col">What happened</th>
          </tr>
        </thead>
        <tbody>
          {t.similar.map((s) => (
            <tr key={s.name}>
              <th scope="row">{s.name}</th>
              <td>{s.similarity}</td>
              <td className={s.outcome.startsWith("Rugged") ? "is-bad" : ""}>{s.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>,
    <section className="report__section token__receipt-note" aria-labelledby={`acc-${id}`}>
      <h3 id={`acc-${id}`}>How accurate is the model?</h3>
      <p>
        The model's receipt is published when training finishes. It will show how often each verdict actually rugged
        on newer tokens the model never saw, next to a plain checklist and a simpler model.
      </p>
    </section>,
    <section className="report__receipt" aria-labelledby={`rc-${id}`}>
      <h3 id={`rc-${id}`}>The receipt</h3>
      <p className="report__sub">The whole check on one label. A claim is struck through when the chain disagrees.</p>
      <div className="report__label" data-tour="receipt">
        <FactsLabel facts={t.facts} title="Token Facts" />
      </div>
    </section>,
  ].filter(Boolean);
}

const partCounts = new Map<string, number>();

/** How many parts a token's report has, so the home page replay knows when it's finished. */
export function tokenPartCount(id: TokenCheck["id"]): number {
  if (!partCounts.has(id)) partCounts.set(id, tokenParts(tokenChecks[id]).length);
  return partCounts.get(id)!;
}

type Props = {
  id: TokenCheck["id"];
  /** How many parts to show, for replays. Shows everything when omitted. */
  reveal?: number;
};

export function TokenReport({ id, reveal }: Props) {
  const t = tokenChecks[id];
  const parts = tokenParts(t);
  const shown = reveal === undefined ? parts : parts.slice(0, reveal);
  return (
    <div className="report-desk" data-tour="results" tabIndex={0}>
      <article className="report" aria-label={`Rug check: ${t.name}`}>
        {shown.map((part, i) => (
          <div key={i} className={reveal === undefined ? undefined : "report__part"}>
            {part}
          </div>
        ))}
      </article>
    </div>
  );
}

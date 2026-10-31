import { useMemo, type ReactNode } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { FactsLabel } from "../FactsLabel";
import { acme, acmeFacts, moonFacts } from "../../data/examples";
import { GAIN, LOSS } from "../../data/report";
import { axis, INK, INK_2, Plot } from "../../ide/report/Plot";
import "../../ide/report/report.css";

type Claim = { claim: string; at: string; facts: string; verdict: string };

const quarters = ["Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"];

const moonClaims: Claim[] = [
  { claim: "“Liquidity is locked”", at: "0:18", facts: "The creator can still withdraw the pool", verdict: "Contradicted" },
  { claim: "“Fair launch, no team tokens”", at: "0:27", facts: "23% sits in wallets with one funder", verdict: "Contradicted" },
  { claim: "“This can't rug”", at: "0:40", facts: "84% of similar launches did", verdict: "Contradicted" },
];

function ClaimsTable({ claims, factsHeader }: { claims: Claim[]; factsHeader: string }) {
  return (
    <table className="report-table report-table--wide">
      <thead>
        <tr>
          <th scope="col">Claim</th>
          <th scope="col">Said at</th>
          <th scope="col">{factsHeader}</th>
          <th scope="col">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {claims.map((c) => (
          <tr key={c.claim}>
            <th scope="row">{c.claim}</th>
            <td>{c.at}</td>
            <td>{c.facts}</td>
            <td className="is-bad">{c.verdict}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars({ x, y, label, unit, color, height = 220 }: { x: string[]; y: number[]; label: string; unit: string; color: string; height?: number }) {
  const { data, layout } = useMemo(() => {
    const data: Data[] = [
      {
        type: "bar",
        x,
        y,
        marker: { color, line: { width: 0 } },
        hovertemplate: `%{x}: %{y}${unit}<extra></extra>`,
      },
    ];
    const layout: Partial<Layout> = {
      bargap: 0.35,
      margin: { l: 8, r: 8, t: 8, b: 8 },
      xaxis: axis({ showgrid: false, tickfont: { size: 10, color: INK_2 } }),
      yaxis: axis({ ticksuffix: unit }),
    };
    return { data, layout };
  }, [x, y, unit, color]);
  return <Plot data={data} layout={layout} height={height} label={label} />;
}

function HBars({ rows, label }: { rows: { name: string; value: number; color: string }[]; label: string }) {
  const { data, layout } = useMemo(() => {
    const data: Data[] = [
      {
        type: "bar",
        orientation: "h",
        y: rows.map((r) => r.name),
        x: rows.map((r) => r.value),
        marker: { color: rows.map((r) => r.color) },
        text: rows.map((r) => `${r.value}%`),
        textposition: "outside",
        textfont: { size: 12, color: INK },
        cliponaxis: false,
        hovertemplate: "%{y}: %{x}%<extra></extra>",
      },
    ];
    const layout: Partial<Layout> = {
      bargap: 0.4,
      margin: { l: 8, r: 40, t: 8, b: 8 },
      xaxis: axis({ ticksuffix: "%", range: [0, Math.max(...rows.map((r) => r.value)) * 1.25] }),
      yaxis: axis({ autorange: "reversed", showgrid: false, tickfont: { size: 12, color: INK } }),
    };
    return { data, layout };
  }, [rows]);
  return <Plot data={data} layout={layout} height={40 + rows.length * 38} label={label} />;
}

function Sheet({ label, parts, reveal }: { label: string; parts: ReactNode[]; reveal?: number }) {
  const shown = reveal === undefined ? parts : parts.slice(0, reveal);
  return (
    <div className="report-desk">
      <article className="report" aria-label={label}>
        {shown.map((part, i) => (
          <div key={i} className={reveal === undefined ? undefined : "report__part"}>
            {part}
          </div>
        ))}
      </article>
    </div>
  );
}

/** Research sheets have four parts: header, claims, charts, receipt. */
export const RESEARCH_PARTS = 4;

export function ResearchSheet({ which, reveal }: { which: "acme" | "moon"; reveal?: number }) {
  if (which === "acme") {
    return (
      <Sheet
        label="Stock research report: ACME Robotics"
        reveal={reveal}
        parts={[
          <header className="report__head">
            <h2>ACME Robotics · ACME</h2>
            <p className="report__meta">Latest quarterly report · a made-up company · example values</p>
            <p className="report__verdict">{acme.answer}</p>
          </header>,
          <section className="report__section">
            <h3>Claims vs. facts</h3>
            <p className="report__sub">Each claim from the clip, checked against the company's reported numbers.</p>
            <ClaimsTable claims={acme.claims} factsHeader="Reported" />
          </section>,
          <div className="report__pair">
            <section className="report__section">
              <h3>Revenue by quarter</h3>
              <p className="report__sub">In millions of dollars. Growing, but slowly.</p>
              <Bars x={quarters} y={acme.revenue} label="Revenue by quarter" unit="M" color={INK} />
            </section>
            <section className="report__section">
              <h3>Shares outstanding</h3>
              <p className="report__sub">In millions. Up 9% in a year, so each share owns less.</p>
              <Bars x={quarters} y={acme.shares} label="Diluted shares by quarter" unit="M" color={LOSS} />
            </section>
          </div>,
          <section className="report__receipt">
            <h3>The receipt</h3>
            <div className="report__label">
              <FactsLabel facts={acmeFacts} title="Company Facts" />
            </div>
          </section>,
        ]}
      />
    );
  }

  return (
    <Sheet
      label="Crypto research report: MOON"
      reveal={reveal}
      parts={[
        <header className="report__head">
          <h2>MOON · Solana</h2>
          <p className="report__meta">Checked 9 days after launch · a made-up token · example values</p>
          <p className="report__verdict">
            The clip says liquidity is locked. On-chain, it isn't: the creator can still withdraw the pool. Fourteen
            wallets funded by one address hold 23% of the supply.
          </p>
        </header>,
        <section className="report__section">
          <h3>Claims vs. chain</h3>
          <p className="report__sub">Each claim from the clip, checked against on-chain data.</p>
          <ClaimsTable claims={moonClaims} factsHeader="On-chain" />
        </section>,
        <div className="report__pair">
          <section className="report__section">
            <h3>Who holds the supply</h3>
            <p className="report__sub">Share of all tokens.</p>
            <HBars
              label="Who holds the supply"
              rows={[
                { name: "Wallets with one funder", value: 23, color: LOSS },
                { name: "Other top 10", value: 38, color: "#7a7a80" },
                { name: "Trading pool", value: 18, color: "#b4b4b9" },
                { name: "Everyone else", value: 21, color: "#b4b4b9" },
              ]}
            />
          </section>
          <section className="report__section">
            <h3>1,240 similar launches</h3>
            <p className="report__sub">What happened within 30 days.</p>
            <HBars
              label="Outcomes of similar past launches"
              rows={[
                { name: "Soft rug", value: 53, color: LOSS },
                { name: "Hard rug", value: 31, color: LOSS },
                { name: "Faded", value: 9, color: "#7a7a80" },
                { name: "Survived", value: 7, color: GAIN },
              ]}
            />
          </section>
        </div>,
        <section className="report__receipt">
          <h3>The receipt</h3>
          <div className="report__label">
            <FactsLabel facts={moonFacts} title="Coin Facts" />
          </div>
        </section>,
      ]}
    />
  );
}

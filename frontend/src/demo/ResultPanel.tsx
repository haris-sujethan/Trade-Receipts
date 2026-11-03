import type { ReactNode } from "react";
import { clipTime, hoursAfter, pct, shortAddr, sol, whole, type Check, type Claim } from "./runs";

type Props = {
  check: Check;
  about: string;
  /** What the clip claimed, when the check started from one. */
  claim: Claim | null;
  /** 0–1: how much of the result has come in. */
  reveal: number;
  /** The agent's explanation, under the verdict (the IDE shows it; the home demo keeps it in the thread). */
  explanation?: ReactNode;
};

const num = (v: unknown) => (typeof v === "number" ? v : 0);

export function verdictTone(v: string) {
  return v === "Likely rug" ? "likely" : v === "Possible rug" ? "possible" : "unlikely";
}

/** The check's result: rug chance and verdict, what the clip said against the chain, the signals, and how similar launches ended. */
export function ResultPanel({ check, about, claim, reveal, explanation }: Props) {
  const s = check.signals;
  const chance = Math.round(check.trees_rug_chance * 100);
  const part = (i: number) => (reveal * 5 >= i ? " is-in" : "");
  const signals: [string, string][] = [
    ["Bought in the launch block", pct(num(s.supply_bought_slot0))],
    ["Team now, and at peak", `${pct(num(s.team_share))} / ${pct(num(s.team_peak_share))}`],
    ["Team’s share of selling", pct(num(s.team_sell_volume_share))],
    ["Top 10 holders", pct(num(s.top10_share))],
    ["Independent buyers’ share of buying", pct(check.chart.independent_buy_share)],
    ["Holders, and market cap", `${whole(num(s.holders))} / ${sol(num(s.mcap_sol))}`],
  ];

  return (
    <div className={`result${reveal < 1 ? " result--live" : ""}`}>
      <div className={`result__head rv${part(0)}`}>
        <div>
          <p className="result__token">
            {check.symbol} {check.name.toLowerCase() !== check.symbol.toLowerCase() && <span>{check.name}</span>}
          </p>
          <p className="result__meta">
            <span className="mono">{shortAddr(check.mint)}</span> checked {Math.round(check.age_s / 60)} minutes after launch
          </p>
          {about && (
            <div className={`result__after rv${part(4)}`}>
              <p className="result__k">What happened after the check</p>
              <p className="result__fact">{about.charAt(0).toUpperCase() + about.slice(1).split(";")[0]}.</p>
            </div>
          )}
        </div>
        <div className="result__score">
          <p className="result__chance">
            {chance}
            <span>%</span>
          </p>
          <p className="result__chance-label">rug chance</p>
          <p className={`verdict verdict--${verdictTone(check.verdict)}`}>{check.verdict}</p>
          <p className="result__small result__nfa">Not financial advice.</p>
        </div>
      </div>

      {explanation && <div className={`result__explain rv${part(1)}`}>{explanation}</div>}

      {claim && (
        <div className={`result__claim rv${part(1)}`}>
          <div>
            <p className="result__k">The clip says{claim.at_s != null ? ` at ${clipTime(claim.at_s)}` : ""}</p>
            <p className="result__quote">“{claim.quote.replace(/[.\s]+$/, "")}”</p>
          </div>
          <div>
            <p className="result__k">The chain shows</p>
            <p className="result__fact">
              {num(s.team_wallets)} team wallets hold {pct(num(s.team_share))}
            </p>
          </div>
        </div>
      )}

      <div className="result__cols">
        <dl className={`result__signals rv${part(2)}`}>
          {signals.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className={`result__side rv${part(3)}`}>
          {check.glimmer && (
            <div className="result__second">
              <p className="result__k">Second opinion, Muse Glimmer</p>
              <p className="result__fact">{Math.round(check.glimmer.rug_chance * 100)}% rug chance</p>
              <p className="result__small">Fine-tuned by us on May 11 to 14 launches</p>
            </div>
          )}
          <div>
            <p className="result__k">5 most similar past launches</p>
            <ul className="result__similar">
              {check.similar.slice(0, 5).map((m) => (
                <li key={m.mint}>
                  <span className={`ended ended--${m.ended}`}>{m.ended === "rugged" ? "Rugged" : m.ended === "faded" ? "Faded" : "Survived"}</span>
                  <span>{m.ended === "rugged" && m.rugged_after_s != null ? `after ${hoursAfter(m.rugged_after_s)}` : ""}</span>
                  <span className="result__small">team {pct(m.team_share, 0)}</span>
                </li>
              ))}
            </ul>
          </div>
          {(check.copycats?.total ?? 0) > 0 && (
            <p className="result__small">
              {whole(check.copycats?.total ?? 0)} other tokens used the same name or ticker in the week before.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

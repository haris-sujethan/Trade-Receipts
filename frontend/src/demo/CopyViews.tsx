import { useMemo } from "react";
import { duration, shortAddr, signedPct, signedSol, whole, type CopyTrade, type Totals } from "./runs";
import { MarkKey } from "./PositionChart";
import "./copy-views.css";

/**
 * A copy-trade backtest's result at a glance, shared by the IDE's Copy trade tab and the home demo: what it copied and
 * what that's based on, the wallet's result beside yours, the price after its trades, and the notes. Numbers only.
 */

export function median(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const change = (v: number | null) => (v == null ? "No price" : signedPct(v));

/** A stretch of trading, roughly: "about 40 minutes", "about 17 hours", "about 3 days". */
function span(hours: number) {
  if (hours < 1) return `about ${Math.max(1, Math.round(hours * 60))} minutes`;
  if (hours < 48) return `about ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
  return `about ${Math.round(hours / 24)} days`;
}

/** What a run is based on: its positions, one per token, and how much of the wallet's history they came from. */
function basedOn(r: CopyTrade) {
  const n = `${r.positions} closed ${r.positions === 1 ? "position" : "positions"} (one per token)`;
  const h = r.history;
  if (!h) return `Based on their latest ${n}, newest first.`;
  const from = `${h.complete ? "their whole history, " : "their last "}${whole(h.transactions)} transactions${h.hours != null ? `, ${span(h.hours)} of trading` : ""}`;
  const based = r.positions_wanted != null && r.positions < r.positions_wanted ? `Only ${n} in ${from}.` : `Based on their latest ${n}, from ${from}.`;
  return r.reused_data ? `${based} Reused the data already pulled for this wallet.` : based;
}

function Total({ who, t, n, mark }: { who: string; t: Totals; n: number; mark: "wallet" | "you" }) {
  return (
    <section className="total" aria-label={who}>
      <p className="total__who">
        <MarkKey who={mark} />
        {who}
      </p>
      <p className="total__pnl">{t.pnl_pct != null ? signedPct(t.pnl_pct) : signedSol(t.pnl_sol)}</p>
      <p className="total__pct">{t.pnl_pct != null ? `${signedSol(t.pnl_sol)} on ${t.spent_sol.toFixed(2)} SOL spent` : "Nothing spent"}</p>
      <p className="total__won">
        {t.won} of {n} {n === 1 ? "position" : "positions"} made money
      </p>
    </section>
  );
}

export function CopySummary({ r }: { r: CopyTrade }) {
  const moves = useMemo(() => ({ buy: median(r.rows.map((p) => p.after_buy.change)), sell: median(r.rows.map((p) => p.after_sell.change)) }), [r]);
  const left: [number, string][] = [
    [r.skipped.not_sol_priced, "priced in something other than SOL"],
    [r.skipped.still_open, "still open"],
    [r.skipped.bought_before_history, "opened before the history read"],
    [r.skipped.no_prices, "with no trades to price them"],
  ];
  return (
    <>
      <header className="copyr__head">
        <div>
          <h2 className="copyr__title">
            Copying <span className="mono">{shortAddr(r.wallet)}</span>
          </h2>
          <p className="copyr__sub">
            {duration(r.buy_after_s)} after they buy, {duration(r.sell_after_s)} after they sell, {r.size_sol} SOL a position.
          </p>
          <p className="copyr__sub">{basedOn(r)}</p>
        </div>
        <a className="copyr__link" href={`https://pump.fun/profile/${r.wallet}`} target="_blank" rel="noreferrer">
          Their pump.fun profile
        </a>
      </header>

      <div className="copyr__totals">
        <Total who="The wallet" t={r.wallet_total} n={r.positions} mark="wallet" />
        <Total who="You, copying them" t={r.you_total} n={r.positions} mark="you" />
        <section className="total total--after" aria-label="The price after their trades">
          <p className="total__who">The price after their trades, median</p>
          <dl className="total__moves">
            <div>
              <dt>In the {duration(r.buy_after_s)} after they buy</dt>
              <dd>{change(moves.buy)}</dd>
            </div>
            <div>
              <dt>In the {duration(r.sell_after_s)} after they sell</dt>
              <dd>{change(moves.sell)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <ul className="copyr__notes">
        {left
          .filter(([n]) => n > 0)
          .map(([n, why]) => (
            <li key={why}>
              Left out: {n} {n === 1 ? "token" : "tokens"} {why}.
            </li>
          ))}
        {r.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>Not financial advice.</li>
      </ul>
    </>
  );
}

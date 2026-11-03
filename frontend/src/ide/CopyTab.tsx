import { Fragment, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, LoaderCircle, Play } from "lucide-react";
import { duration, pct, shortAddr, signedPct, signedSol, whole, type CopyRequest, type CopyTrade, type Fill, type Position, type Result, type Totals } from "../demo/runs";
import { useBackend, useCheckFrame } from "./live";
import { MarkKey, mcap, PositionChart, ResultBar } from "./PositionChart";
import { COPY_POSITIONS, copyRequestOf, copyResultOf, finishedCopyOf, isCopyRun, tabOf, useIde, type CheckRun } from "./state";
import "./copy.css";

/**
 * A copy-trade backtest in the editor area: what to copy and how late (live with the backend), then the wallet's result
 * beside yours and each position with its chart. Numbers only: the view never judges the wallet.
 */

const PRESETS = [2, 10, 30, 60, 300, 600];
const POSITION_PRESETS = [25, 50, 100];
/** How long a live run takes, by how many positions it copies. */
const eta = (n: number) => (n > 50 ? "about 50 seconds" : "about 15 seconds");
const MAX_DELAY = 86_400;
/** What the backend reads as a wallet (receipts/crypto/copytrade.py): a pump.fun profile link or an address. */
const WALLET = /(?:pump\.fun\/(?:profile|coin)\/)?([1-9A-HJ-NP-Za-km-z]{32,44})/;

export function CopyTab({ run }: { run: CheckRun }) {
  const { dispatch } = useIde();
  const cf = useCheckFrame(run, () => dispatch({ type: "finishCheck", key: run.key }));
  if (!cf) return null;
  const { frame } = cf;
  const saved = run.mode === "replay";
  // A replay shows its result once the agent starts answering; a live run as soon as the result arrives.
  const result = run.copy ?? (frame.view === "result" ? copyResultOf(run) : undefined);
  const c = frame.counters;
  const backtested = frame.steps.some((s) => s.tool === "copy_trade" && s.state === "done");
  const ended = run.status === "done" && !result && run.mode === "live";

  return (
    <div className="copy">
      <CopyForm runKey={run.key} request={copyRequestOf(run)} saved={saved} />
      <div className="copy__body">
        {run.status === "error" && (
          <div className="check__state check__state--error" role="alert">
            <AlertTriangle size={18} aria-hidden />
            <div>
              <p className="check__state-title">The backtest stopped</p>
              <p>{run.error}</p>
            </div>
          </div>
        )}
        {ended && (
          <div className="check__state">
            <AlertTriangle size={18} aria-hidden />
            <div>
              <p className="check__state-title">No backtest came back</p>
              <p>{run.via === "agent" ? "The agent answered in the thread without one." : "The backend closed the stream without a result."}</p>
            </div>
          </div>
        )}
        {run.status !== "error" && !ended && !result && (
          <div className="check__state" role="status">
            <LoaderCircle size={18} className="spin" aria-hidden />
            <div>
              <p className="check__state-title">
                {backtested ? "The agent is writing it up" : c.positions ? "Pricing each position" : c.walletTx != null ? "Reading the wallet’s trades" : "Starting the backtest"}
              </p>
              <ul className="copy__progress">
                {c.walletTx != null && <li>{whole(c.walletTx)} of the wallet’s latest transactions read</li>}
                {c.positions && (
                  <li>
                    {c.positions[0]} of {c.positions[1]} closed positions priced
                  </li>
                )}
              </ul>
              <p>{saved ? "Replaying the saved backtest." : `A backtest of ${copyRequestOf(run)?.positions ?? COPY_POSITIONS} positions takes ${eta(copyRequestOf(run)?.positions ?? COPY_POSITIONS)}.`}</p>
            </div>
          </div>
        )}
        {result && <CopyResult r={result} runKey={run.key} />}
      </div>
    </div>
  );
}

/* ---------- The form ---------- */

function CopyForm({ runKey, request, saved }: { runKey: string; request?: CopyRequest; saved: boolean }) {
  const { dispatch } = useIde();
  const backend = useBackend();
  const [wallet, setWallet] = useState(request?.wallet ?? "");
  const [buy, setBuy] = useState<number | null>(request?.buy_after_s ?? 300);
  const [sell, setSell] = useState<number | null>(request?.sell_after_s ?? 600);
  const [size, setSize] = useState(String(request?.size_sol ?? 1));
  const [positions, setPositions] = useState(request?.positions ?? COPY_POSITIONS);
  const positionOptions = [...new Set([...POSITION_PRESETS, positions])].sort((a, b) => a - b);
  const [tried, setTried] = useState(false);
  const live = backend === "online";
  const address = WALLET.exec(wallet.trim())?.[1];
  const sizeSol = Number(size);
  const problem = !address
    ? "Paste a pump.fun profile link or a wallet address."
    : buy == null || sell == null
      ? "Set each delay from 0 seconds to 24 hours."
      : !(sizeSol > 0 && sizeSol <= 1000)
        ? "SOL per position: more than 0, up to 1,000."
        : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (problem || !live || !address || buy == null || sell == null) return;
    dispatch({ type: "copyStart", request: { wallet: address, buy_after_s: buy, sell_after_s: sell, size_sol: sizeSol, positions } });
  }

  const note =
    backend === "checking"
      ? "Looking for the backend…"
      : !live
        ? "Live backtests are coming soon. This preview replays the saved one, so the timing is fixed."
        : saved
          ? "A saved backtest. Change the timing to run it live."
          : `A run of ${positions} positions takes ${eta(positions)} and opens in its own tab.`;

  return (
    <form className="copyf" onSubmit={submit} aria-label="What to copy" noValidate>
      <fieldset className="copyf__set" disabled={!live}>
        <div className="copyf__row">
          <label className="copyf__field copyf__field--wallet">
            <span>Wallet</span>
            <input
              className="mono"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="pump.fun/profile/… or an address"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={tried && !address}
            />
          </label>
          <label className="copyf__field copyf__field--size">
            <span>SOL per position</span>
            <input type="number" inputMode="decimal" min={0} max={1000} step="any" value={size} onChange={(e) => setSize(e.target.value)} />
          </label>
        </div>
        <fieldset className="delay">
          <legend>Positions</legend>
          <div className="seg">
            {positionOptions.map((n) => (
              <label key={n} className="seg__opt">
                <input type="radio" name={`positions-${runKey}`} checked={positions === n} onChange={() => setPositions(n)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <DelayField legend="Buy after its buys" name={`buy-${runKey}`} value={buy} onChange={setBuy} />
        <DelayField legend="Sell after its sells" name={`sell-${runKey}`} value={sell} onChange={setSell} />
      </fieldset>
      <div className="copyf__foot">
        <p className="copyf__note" id={`copy-why-${runKey}`}>
          {tried && problem && live ? (
            <span className="copyf__error" role="alert">
              {problem}
            </span>
          ) : (
            note
          )}
        </p>
        <button className="run-btn" type="submit" disabled={!live} aria-describedby={`copy-why-${runKey}`}>
          <Play size={13} aria-hidden fill="currentColor" />
          Run backtest
        </button>
      </div>
    </form>
  );
}

/** How long after the wallet to copy: a preset, or a custom time in seconds or minutes. */
function DelayField({ legend, name, value, onChange }: { legend: string; name: string; value: number | null; onChange: (s: number | null) => void }) {
  const preset = value != null && PRESETS.includes(value);
  const [custom, setCustom] = useState(!preset);
  const [unit, setUnit] = useState<"s" | "min">(value != null && value >= 60 && value % 60 === 0 ? "min" : "s");
  const [text, setText] = useState(preset || value == null ? "" : String(unit === "min" ? value / 60 : value));

  function read(t: string, u: "s" | "min") {
    const n = Number(t);
    if (!t.trim() || !Number.isFinite(n) || n < 0) return null;
    const s = Math.round(n * (u === "min" ? 60 : 1));
    return s <= MAX_DELAY ? s : null;
  }

  return (
    <fieldset className="delay">
      <legend>{legend}</legend>
      <div className="seg">
        {PRESETS.map((p) => (
          <label key={p} className="seg__opt">
            <input
              type="radio"
              name={name}
              checked={!custom && value === p}
              onChange={() => {
                setCustom(false);
                onChange(p);
              }}
            />
            <span>{duration(p)}</span>
          </label>
        ))}
        <label className="seg__opt">
          <input
            type="radio"
            name={name}
            checked={custom}
            onChange={() => {
              setCustom(true);
              onChange(read(text, unit));
            }}
          />
          <span>Custom</span>
        </label>
      </div>
      {custom && (
        <span className="delay__custom">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            aria-label={`${legend}, custom time`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(read(e.target.value, unit));
            }}
          />
          <select
            aria-label={`${legend}, unit`}
            value={unit}
            onChange={(e) => {
              const u = e.target.value as "s" | "min";
              setUnit(u);
              onChange(read(text, u));
            }}
          >
            <option value="s">seconds</option>
            <option value="min">minutes</option>
          </select>
        </span>
      )}
    </fieldset>
  );
}

/* ---------- The result ---------- */

function median(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const change = (v: number | null) => (v == null ? "No price" : signedPct(v));

function CopyResult({ r, runKey }: { r: CopyTrade; runKey: string }) {
  const { state, dispatch } = useIde();
  const [open, setOpen] = useState<number | null>(0);
  const moves = useMemo(() => ({ buy: median(r.rows.map((p) => p.after_buy.change)), sell: median(r.rows.map((p) => p.after_sell.change)) }), [r]);
  // One scale for every row's drawing: zero, and the widest result either side of it.
  const [lo, hi] = useMemo(() => {
    const v = r.rows.flatMap((p) => [p.wallet.pnl_pct, p.you.pnl_pct]).filter((x): x is number => x != null);
    return [Math.min(0, ...v), Math.max(0, ...v)];
  }, [r]);
  // Other runs on the same wallet in this session, to compare timings.
  const others = Object.values(state.checks).filter((c) => isCopyRun(c) && finishedCopyOf(c)?.wallet === r.wallet);
  const left: [number, string][] = [
    [r.skipped.not_sol_priced, "priced in something other than SOL"],
    [r.skipped.still_open, "still open"],
    [r.skipped.bought_before_history, "opened before the history read"],
    [r.skipped.no_prices, "with no trades to price them"],
  ];

  return (
    <div className="copyr">
      <header className="copyr__head">
        <div>
          <h2 className="copyr__title">
            Copying <span className="mono">{shortAddr(r.wallet)}</span>
          </h2>
          <p className="copyr__sub">
            {duration(r.buy_after_s)} after its buys, {duration(r.sell_after_s)} after its sells, {r.size_sol} SOL a position.
          </p>
          <p className="copyr__sub">{basedOn(r)}</p>
        </div>
        <a className="copyr__link" href={`https://pump.fun/profile/${r.wallet}`} target="_blank" rel="noreferrer">
          Its pump.fun profile
        </a>
      </header>

      <div className="copyr__totals">
        <Total who="The wallet" t={r.wallet_total} n={r.positions} mark="wallet" />
        <Total who="You, copying it" t={r.you_total} n={r.positions} mark="you" />
        <section className="total total--after" aria-label="The price after its trades">
          <p className="total__who">The price after its trades, median</p>
          <dl className="total__moves">
            <div>
              <dt>In the {duration(r.buy_after_s)} after its buys</dt>
              <dd>{change(moves.buy)}</dd>
            </div>
            <div>
              <dt>In the {duration(r.sell_after_s)} after its sells</dt>
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

      {others.length > 1 && (
        <section className="copyr__runs" aria-labelledby={`runs-${runKey}`}>
          <h3 id={`runs-${runKey}`} className="copyr__h">
            Your timings on this wallet
          </h3>
          <ul>
            {others.map((c) => {
              const o = finishedCopyOf(c)!;
              const here = c.key === runKey;
              return (
                <li key={c.key}>
                  <button className={here ? "is-on" : ""} aria-current={here ? "true" : undefined} onClick={() => dispatch({ type: "open", id: tabOf(c) })}>
                    <span>
                      {duration(o.buy_after_s)} / {duration(o.sell_after_s)}
                    </span>
                    <span className="num">{signedSol(o.you_total.pnl_sol)}</span>
                    <span className="num">{o.you_total.pnl_pct != null ? signedPct(o.you_total.pnl_pct) : ""}</span>
                    <span className="copyr__runs-won">
                      {o.you_total.won} of {o.positions} made money
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {r.rows.length === 0 ? (
        <p className="copyr__empty">No closed positions to copy in the wallet’s latest transactions.</p>
      ) : (
        <div className="pos__wrap">
          <table className="pos">
            <caption className="copyr__h">Each position</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  Token
                </th>
                <th scope="col" rowSpan={2} className="pos__when">
                  Bought
                </th>
                <th scope="col" rowSpan={2} className="num">
                  Held
                </th>
                <th scope="colgroup" colSpan={2} className="pos__group">
                  Result
                </th>
                <th scope="col" rowSpan={2} className="pos__bar">
                  <span className="sr-only">The wallet’s result and yours, drawn</span>
                </th>
                <th scope="colgroup" colSpan={2} className="pos__group">
                  Price move
                </th>
              </tr>
              <tr>
                <th scope="col" className="num">
                  Wallet
                </th>
                <th scope="col" className="num">
                  You
                </th>
                <th scope="col" className="num">
                  {duration(r.buy_after_s)} after its buy
                </th>
                <th scope="col" className="num">
                  {duration(r.sell_after_s)} after its sell
                </th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((p, i) => {
                const isOpen = open === i;
                const id = `pos-${runKey}-${i}`;
                return (
                  <Fragment key={i}>
                    <tr className={isOpen ? "is-open" : ""} onClick={() => setOpen(isOpen ? null : i)}>
                      <th scope="row">
                        <button
                          className="pos__token"
                          aria-expanded={isOpen}
                          aria-controls={id}
                          onClick={(e) => {
                            // The row toggles too; this is its keyboard way in.
                            e.stopPropagation();
                            setOpen(isOpen ? null : i);
                          }}
                        >
                          {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                          <span className="pos__sym">{p.symbol || p.mint.slice(0, 6)}</span>
                          {p.name && p.name !== p.symbol && <span className="pos__name">{p.name}</span>}
                        </button>
                      </th>
                      <td className="pos__when">{when(p.first_buy_ts)}</td>
                      <td className="num">{duration(p.held_s)}</td>
                      <td className="num">{p.wallet.pnl_pct != null ? signedPct(p.wallet.pnl_pct) : ""}</td>
                      <td className="num">{p.you.pnl_pct != null ? signedPct(p.you.pnl_pct) : ""}</td>
                      <td className="pos__bar">
                        <ResultBar wallet={p.wallet.pnl_pct} you={p.you.pnl_pct} lo={lo} hi={hi} />
                      </td>
                      <td className="num">{change(p.after_buy.change)}</td>
                      <td className="num">{change(p.after_sell.change)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="pos__detail">
                        <td colSpan={8} id={id}>
                          <PositionDetail p={p} r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

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
  if (!h) return `Based on its latest ${n}, newest first.`;
  const from = `${h.complete ? "its whole history, " : "its last "}${whole(h.transactions)} transactions${h.hours != null ? `, ${span(h.hours)} of trading` : ""}`;
  return r.positions_wanted != null && r.positions < r.positions_wanted ? `Only ${n} in ${from}.` : `Based on its latest ${n}, from ${from}.`;
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

/** One position opened up: what the price did while you waited, its chart, and every fill. */
function PositionDetail({ p, r }: { p: Position; r: CopyTrade }) {
  const t0 = p.first_buy_ts;
  const at = (f: Fill) => (f.t === t0 ? "at its first buy" : `${duration(f.t - t0)} after its first buy`);
  const line = (f: Fill, who: "It" | "You") =>
    `${f.side === "buy" ? `${who === "It" ? "Bought" : "Buy"} ${f.sol.toFixed(2)} SOL` : `${who === "It" ? "Sold" : `Sell${f.rest ? " the rest" : ""}`} for ${f.sol.toFixed(2)} SOL`} at ${mcap(f.mcap_sol)}, ${at(f)}`;
  const result = (x: Result) =>
    `Spent ${x.spent_sol.toFixed(2)} SOL, got ${x.got_sol.toFixed(2)} SOL back: ${signedSol(x.pnl_sol)}${x.pnl_pct != null ? ` (${signedPct(x.pnl_pct)})` : ""}`;

  return (
    <div className="posd">
      <ul className="posd__moves">
        <li>
          In the {duration(r.buy_after_s)} after its buy, the price moved <strong>{change(p.after_buy.change)}</strong>
          {p.after_buy.mcap_after != null && ` (${mcap(p.after_buy.mcap_at_buy)} to ${mcap(p.after_buy.mcap_after)})`}.
        </li>
        <li>
          In the {duration(r.sell_after_s)} after its last sell, <strong>{change(p.after_sell.change)}</strong>
          {p.after_sell.mcap_after != null && ` (${mcap(p.after_sell.mcap_at_sell)} to ${mcap(p.after_sell.mcap_after)})`}.
        </li>
      </ul>
      <PositionChart p={p} buyAfter={r.buy_after_s} sellAfter={r.sell_after_s} />
      <ul className="pchart__legend">
        <li>
          <MarkKey who="wallet" />
          Its buys and sells
        </li>
        <li>
          <MarkKey who="you" />
          Yours, copied late
        </li>
        <li>
          <i className="pchart__legend-wait" />
          The price move while you wait
        </li>
        <li className="pchart__legend-note">Market cap in SOL; time since its first buy, on a log scale</li>
      </ul>
      <div className="posd__cols">
        <section>
          <h4 className="posd__h">Its trades</h4>
          <p className="posd__sum">{result(p.wallet)}</p>
          <ol className="posd__fills">
            {p.wallet_fills.map((f, i) => (
              <li key={i}>{line(f, "It")}</li>
            ))}
          </ol>
        </section>
        <section>
          <h4 className="posd__h">Yours</h4>
          <p className="posd__sum">
            {result(p.you)}. Fees {pct(p.you.fee_rate, 2)} a trade, what this token’s trades paid.
          </p>
          <ol className="posd__fills">
            {p.you.trades.map((f, i) => (
              <li key={i}>{line(f, "You")}</li>
            ))}
          </ol>
        </section>
      </div>
      <p className="posd__mint">
        {p.name || p.symbol || "Token"}, first bought {when(p.first_buy_ts)}: <span className="mono">{p.mint}</span>
      </p>
    </div>
  );
}

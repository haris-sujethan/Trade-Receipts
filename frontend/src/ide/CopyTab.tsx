import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, LoaderCircle, MessageSquare, Play, RotateCcw, SquareArrowOutUpRight } from "lucide-react";
import { duration, loadRun, pct, shortAddr, signedPct, signedSol, whole, type CopyRequest, type CopyTrade, type Fill, type Position, type Result } from "../demo/runs";
import { useBackend, useCheckFrame } from "./live";
import { change, CopySummary } from "../demo/CopyViews";
import { MarkKey, mcap, PositionChart, ResultBar } from "../demo/PositionChart";
import {
  COPY_FRESH_MS,
  COPY_POSITIONS,
  copyRequestOf,
  copyResultOf,
  finishedCopyOf,
  isCopyRun,
  latestCopy,
  tabOf,
  useIde,
  type CheckRun,
} from "./state";
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
  const { state, dispatch } = useIde();
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
      <CopyForm runKey={run.key} request={copyRequestOf(run)} />
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
                {backtested
                  ? "The agent is writing it up"
                  : c.reused != null
                    ? "Reusing the data already pulled for this wallet"
                    : c.positions
                      ? "Pricing each position"
                      : c.walletTx != null
                        ? "Reading the wallet’s trades"
                        : "Starting the backtest"}
              </p>
              <ul className="copy__progress">
                {c.reused != null && <li>{c.reused} positions and their prices, from a run in the last 30 minutes</li>}
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
        {result && (
          <div data-tour="copy-result">
            {!state.panes.thread && (
              <div className="copy__ask">
                <button className="tool-btn" onClick={() => dispatch({ type: "askAbout", key: run.key })}>
                  <MessageSquare size={14} aria-hidden />
                  Ask about this result
                </button>
              </div>
            )}
            <CopyResult r={result} runKey={run.key} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The blank form in Copy trade mode, with the saved backtest to open. Nothing runs until Run backtest is pressed. */
export function NewCopyTab() {
  const { state, dispatch } = useIde();
  const [loading, setLoading] = useState<string | null>(null);

  function open(id: string) {
    const key = `saved:${id}`;
    if (state.checks[key]) return dispatch({ type: "open", id: `copy:${key}` });
    setLoading(id);
    loadRun(id)
      .then((run) => dispatch({ type: "openSavedCopy", key, run }))
      .finally(() => setLoading(null));
  }

  return (
    <div className="copy">
      <CopyForm runKey="new" />
      <div className="copy__body">
        <section className="copyx" aria-labelledby="copyx-h">
          <h2 id="copyx-h" className="copyr__h">
            Saved backtest
          </h2>
          {state.savedCopies.length === 0 ? (
            <p className="copyx__note">None saved in this preview.</p>
          ) : (
            <ul>
              {state.savedCopies.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(r.id)}>
                    <span className="mono">{shortAddr(r.wallet)}</span>
                    <span>
                      {r.buy_after_s != null && r.sell_after_s != null ? `${duration(r.buy_after_s)} after they buy, ${duration(r.sell_after_s)} after they sell` : ""}
                      {r.positions != null ? `, ${r.positions} positions` : ""}
                    </span>
                    <span className="copyx__when">{loading === r.id ? "Opening" : `Saved ${ago(r.saved_at * 1000)}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="copyx__note">A wallet from pump.fun’s leaderboard. Opening it shows the saved result; nothing runs.</p>
        </section>
      </div>
    </div>
  );
}

/* ---------- The form ---------- */

/** How long ago something ran: "just now", "3 min ago", "2 h ago", "4 days ago". */
function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 48 * 3600) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

/** Re-renders every half minute, so "3 min ago" and the 30-minute refresh stay true. */
function useMinuteClock() {
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
}

type Draft = { wallet: string; buy: number | null; sell: number | null; size: string; positions: number };
/** Each tab's form as last left, so switching tabs and back keeps what was typed (for this visit). */
const drafts = new Map<string, Draft>();

function CopyForm({ runKey, request }: { runKey: string; request?: CopyRequest }) {
  const { state, dispatch } = useIde();
  const backend = useBackend();
  useMinuteClock();
  const [start] = useState<Draft>(
    () =>
      drafts.get(runKey) ?? {
        wallet: request?.wallet ?? "",
        buy: request?.buy_after_s ?? 30,
        sell: request?.sell_after_s ?? 30,
        size: String(request?.size_sol ?? 1),
        positions: request?.positions ?? COPY_POSITIONS,
      },
  );
  const [wallet, setWallet] = useState(start.wallet);
  const [buy, setBuy] = useState<number | null>(start.buy);
  const [sell, setSell] = useState<number | null>(start.sell);
  const [size, setSize] = useState(start.size);
  const [positions, setPositions] = useState(start.positions);
  useEffect(() => {
    drafts.set(runKey, { wallet, buy, sell, size, positions });
  }, [runKey, wallet, buy, sell, size, positions]);
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

  // The same values make the same run: point at it instead of running it again, unless its data is past 30 minutes.
  const values: CopyRequest | null = !problem && address && buy != null && sell != null ? { wallet: address, buy_after_s: buy, sell_after_s: sell, size_sol: sizeSol, positions } : null;
  const same = values ? latestCopy(state, values) : undefined;
  const here = same?.key === runKey;
  const fresh = !!same && same.status === "done" && Date.now() - (same.at ?? 0) < COPY_FRESH_MS;
  const action: "run" | "running" | "open" | "showing" | "again" =
    !same ? "run" : same.status === "running" ? (here ? "running" : "open") : fresh ? (here ? "showing" : "open") : "again";

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (problem || !live || !values) return;
    if (same && (action === "open" || action === "showing")) return dispatch({ type: "open", id: `copy:${same.key}` });
    if (action === "running") return;
    dispatch({ type: "copyStart", request: values });
  }

  const label = { run: "Run backtest", running: "Running…", open: "Open result", showing: "Showing this result", again: "Run again with newer trades" }[action];
  const when =
    same?.status === "running"
      ? "Running now"
      : same?.at
        ? `Ran ${ago(same.at)}${action === "showing" ? "; change a value to run another" : ""}`
        : null;

  const note =
    backend === "checking"
      ? "Looking for the backend…"
      : !live
        ? "Live backtests are coming soon. This preview replays the saved one, so the values are fixed."
        : `Nothing runs until you press Run backtest. ${positions} positions take ${eta(positions)}, in a new tab.`;
  // The values a run will use, stated beside the button so they're confirmed before it starts.
  const confirm =
    buy != null && sell != null
      ? `Buy ${duration(buy)} after they buy, sell ${duration(sell)} after they sell, ${positions} positions, ${sizeSol > 0 ? sizeSol : "?"} SOL each`
      : "Set both delays";

  return (
    <form className="copyf" onSubmit={submit} aria-label="What to copy" noValidate data-tour="copy-form">
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
        <DelayField legend="Buy after they buy" name={`buy-${runKey}`} value={buy} onChange={setBuy} />
        <DelayField legend="Sell after they sell" name={`sell-${runKey}`} value={sell} onChange={setSell} />
      </fieldset>
      <div className="copyf__foot">
        <div className="copyf__confirm" id={`copy-values-${runKey}`}>
          <p>{confirm}</p>
          {live && when && <p className="copyf__when">{when}</p>}
        </div>
        <button
          className="run-btn"
          type="submit"
          disabled={!live || action === "running" || action === "showing"}
          aria-describedby={`copy-values-${runKey} copy-why-${runKey}`}
        >
          {action === "open" ? (
            <SquareArrowOutUpRight size={13} aria-hidden />
          ) : action === "again" ? (
            <RotateCcw size={13} aria-hidden />
          ) : action === "running" ? (
            <LoaderCircle size={13} className="spin" aria-hidden />
          ) : (
            <Play size={13} aria-hidden fill="currentColor" />
          )}
          {label}
        </button>
        <p className="copyf__note" id={`copy-why-${runKey}`}>
          {tried && problem && live ? (
            <span className="copyf__error" role="alert">
              {problem}
            </span>
          ) : (
            note
          )}
        </p>
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

function CopyResult({ r, runKey }: { r: CopyTrade; runKey: string }) {
  const { state, dispatch } = useIde();
  const [open, setOpen] = useState<number | null>(0);
  // One scale for every row's drawing: zero, and the widest result either side of it.
  const [lo, hi] = useMemo(() => {
    const v = r.rows.flatMap((p) => [p.wallet.pnl_pct, p.you.pnl_pct]).filter((x): x is number => x != null);
    return [Math.min(0, ...v), Math.max(0, ...v)];
  }, [r]);
  // Other runs on the same wallet in this session, to compare timings.
  const others = Object.values(state.checks).filter((c) => isCopyRun(c) && finishedCopyOf(c)?.wallet === r.wallet);

  return (
    <div className="copyr">
      <CopySummary r={r} />

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
                      {duration(o.buy_after_s)} / {duration(o.sell_after_s)}, {o.positions_wanted ?? o.positions} positions
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
                  {duration(r.buy_after_s)} after they buy
                </th>
                <th scope="col" className="num">
                  {duration(r.sell_after_s)} after they sell
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

/** One position opened up: what the price did while you waited, its chart, and every fill. */
function PositionDetail({ p, r }: { p: Position; r: CopyTrade }) {
  const t0 = p.first_buy_ts;
  const at = (f: Fill) => (f.t === t0 ? "at their first buy" : `${duration(f.t - t0)} after their first buy`);
  const line = (f: Fill, who: "It" | "You") =>
    `${f.side === "buy" ? `${who === "It" ? "Bought" : "Buy"} ${f.sol.toFixed(2)} SOL` : `${who === "It" ? "Sold" : `Sell${f.rest ? " the rest" : ""}`} for ${f.sol.toFixed(2)} SOL`} at ${mcap(f.mcap_sol)}, ${at(f)}`;
  const result = (x: Result) =>
    `Spent ${x.spent_sol.toFixed(2)} SOL, got ${x.got_sol.toFixed(2)} SOL back: ${signedSol(x.pnl_sol)}${x.pnl_pct != null ? ` (${signedPct(x.pnl_pct)})` : ""}`;

  return (
    <div className="posd">
      <ul className="posd__moves">
        <li>
          In the {duration(r.buy_after_s)} after their buy, the price moved <strong>{change(p.after_buy.change)}</strong>
          {p.after_buy.mcap_after != null && ` (${mcap(p.after_buy.mcap_at_buy)} to ${mcap(p.after_buy.mcap_after)})`}.
        </li>
        <li>
          In the {duration(r.sell_after_s)} after their last sell, <strong>{change(p.after_sell.change)}</strong>
          {p.after_sell.mcap_after != null && ` (${mcap(p.after_sell.mcap_at_sell)} to ${mcap(p.after_sell.mcap_after)})`}.
        </li>
      </ul>
      <PositionChart p={p} buyAfter={r.buy_after_s} sellAfter={r.sell_after_s} />
      <ul className="pchart__legend">
        <li>
          <MarkKey who="wallet" />
          Their buys and sells
        </li>
        <li>
          <MarkKey who="you" />
          Yours, copied late
        </li>
        <li>
          <i className="pchart__legend-wait" />
          The price move while you wait
        </li>
        <li className="pchart__legend-note">Market cap in SOL; time since their first buy, on a log scale</li>
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

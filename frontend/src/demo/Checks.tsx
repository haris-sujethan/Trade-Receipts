import { useEffect, useMemo, useState, type ReactNode } from "react";
import { modelFacts } from "../data/model";
import { BubbleMap } from "./BubbleMap";
import { MiniChart } from "./MiniChart";
import { NODE_SWATCH, swatchVar } from "./groups";
import "./checks.css";
import { answerOf, hoursAfter, loadRun, loadRuns, pct, shortAddr, sol, whole, type Check, type Run, type StepEvent } from "./runs";

type Card = { title: string; sub: string; visual: ReactNode; rows: [ReactNode, ReactNode][] };

const num = (v: unknown) => (typeof v === "number" ? v : 0);
const W = 300;
const H = 108;

const minutes = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

/* ---------- Small visuals ---------- */

/**
 * The model card's picture: a stylized rug, not any one token. Candles climb, green and red, then one red candle
 * takes it all back. Hand-drawn shape, no values, so it carries no numbers.
 */
const RUG_CLOSES = [14, 19, 16, 22, 19, 26, 32, 28, 36, 44, 39, 49, 58, 52, 65, 76];
const RUG_WICKS = [2, 3, 2, 4, 2, 3, 5, 3, 4, 3, 5, 4, 3, 6, 4, 5];

function RugCandles() {
  const candles = RUG_CLOSES.map((close, i) => {
    const open = i ? RUG_CLOSES[i - 1] : 11;
    return { open, close, high: Math.max(open, close) + RUG_WICKS[i], low: Math.min(open, close) - RUG_WICKS[(i + 5) % RUG_WICKS.length] };
  });
  const top = RUG_CLOSES[RUG_CLOSES.length - 1];
  candles.push({ open: top, close: 4, high: top + 4, low: 2 });
  candles.push({ open: 4, close: 3, high: 5, low: 2 }, { open: 3, close: 4, high: 5, low: 2 });
  const pad = 8;
  const step = (W - pad * 2) / candles.length;
  const x = (i: number) => pad + step * i + step / 2;
  const y = (v: number) => 6 + (1 - v / 82) * (H - 12);
  const body = Math.max(3, step * 0.64);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Illustration: a token climbs in green and red candles, then one red candle takes it straight down">
      {candles.map((c, i) => {
        const up = c.close >= c.open;
        return (
          <g key={i} className={up ? "viz-candle viz-candle--up" : "viz-candle viz-candle--down"}>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} />
            <rect x={x(i) - body / 2} y={y(Math.max(c.open, c.close))} width={body} height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))} rx={1} />
          </g>
        );
      })}
      <text x={pad} y={12} className="viz-tick">
        Illustration
      </text>
    </svg>
  );
}

function ShareBars({ bars, label }: { bars: { label: string; v: number }[]; label: string }) {
  return (
    <div className="viz-bars" role="img" aria-label={label}>
      {bars.map((b) => (
        <div key={b.label} className="viz-bars__row">
          <span>{b.label}</span>
          <span className="viz-bars__track">
            <i className="viz-bars__fill viz-bars__fill--ink" style={{ width: `${Math.max(1.5, b.v * 100)}%` }} />
          </span>
          <span className="viz-bars__v">{pct(b.v)}</span>
        </div>
      ))}
    </div>
  );
}

function SameSizeBars({ sizes }: { sizes: { sol: number; count: number }[] }) {
  const shown = sizes.slice(0, 6);
  const max = Math.max(...shown.map((s) => s.count));
  return (
    <div role="img" aria-label="The most repeated exact buy sizes in SOL, and how many buys used each">
      <div className="viz-cols">
        {shown.map((s) => (
          <div key={s.sol} className="viz-cols__col">
            <span className="viz-cols__n">{s.count}</span>
            <span className="viz-cols__well">
              <i style={{ height: `${(s.count / max) * 100}%` }} />
            </span>
            {/* Dust buys round to 0 at 0.001 SOL; they are under it, not free. */}
            <span className="viz-cols__k">{s.sol === 0 ? "<0.001" : s.sol}</span>
          </div>
        ))}
      </div>
      <p className="viz-cols__unit">Buys at each exact size, in SOL</p>
    </div>
  );
}

/** Market cap as a line, with the team's selling in each 15 seconds as bars underneath: no mark sits on another. */
function TeamSells({ check }: { check: Check }) {
  const c = check.chart;
  const n = c.candles.length;
  const perCandle = new Array(n).fill(0);
  for (const s of c.team_sells) {
    const i = Math.min(n - 1, Math.floor(s.t / c.candle_s));
    perCandle[i] += s.sol;
  }
  const lineTop = 16;
  const lineBottom = 54;
  const barTop = 80;
  const barBottom = H - 4;
  const step = (W - 8) / n;
  const x = (i: number) => 4 + step * i + step / 2;
  const later = c.candles.slice(1);
  const lo = Math.min(...later.map((k) => k.low));
  const hi = Math.max(...later.map((k) => k.high));
  const y = (v: number) => lineTop + (1 - (Math.max(v, lo) - lo) / (hi - lo || 1)) * (lineBottom - lineTop);
  // One big sell can dwarf the rest; scale to the others and let that one bar run to the top.
  const sorted = [...perCandle].sort((a, b) => b - a);
  const sMax = Math.max(1e-9, sorted[1] > 0 ? Math.min(sorted[0], sorted[1] * 1.6) : sorted[0]);
  const bar = (v: number) => Math.min(1, v / sMax) * (barBottom - barTop);
  const line = c.candles.map((k, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(k.close).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label={`${check.symbol}'s market cap, with the team's selling in each 15 seconds below it`}>
      <text x={4} y={9} className="viz-tick">
        Market cap
      </text>
      <path d={line} className="viz-line" />
      <text x={4} y={barTop - 8} className="viz-tick">
        Team sells
      </text>
      {perCandle.map((v, i) =>
        v > 0 ? (
          <rect key={i} x={x(i) - Math.max(1, step * 0.3)} y={barBottom - Math.max(1.5, bar(v))} width={Math.max(2, step * 0.6)} height={Math.max(1.5, bar(v))} className="viz-team-bar" rx={1} />
        ) : null,
      )}
      <line x1={4} x2={W - 4} y1={barBottom} y2={barBottom} className="viz-axis" />
    </svg>
  );
}

/** Wallets that bought in the first 30 seconds, by second, stacked so no dot covers another. */
function SniperSwarm({ check }: { check: Check }) {
  const span = 30;
  const early = check.bubble_map.nodes.filter((n) => n.first_buy_s != null && n.first_buy_s <= span).sort((a, b) => (a.first_buy_s ?? 0) - (b.first_buy_s ?? 0));
  const top = 16;
  const bottom = H - 20;
  const mid = (top + bottom) / 2;
  const r = 3.2;
  const x = (s: number) => 8 + (s / span) * (W - 16);
  const placed: { x: number; y: number; color: string; key: string }[] = [];
  for (const n of early) {
    const px = x(n.first_buy_s ?? 0);
    for (let k = 0; k < 40; k++) {
      const py = mid + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 + 1);
      if (py < top + r || py > bottom - r) continue;
      if (placed.every((p) => Math.hypot(p.x - px, p.y - py) >= r * 2 + 1)) {
        placed.push({ x: px, y: py, color: swatchVar(NODE_SWATCH[n.group]), key: n.wallet });
        break;
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label={`Wallets on ${check.symbol}'s map that bought in the first 30 seconds, by second`}>
      <rect x={x(0)} y={top - 4} width={x(10) - x(0)} height={bottom - top + 8} className="viz-zone" />
      <text x={x(0) + 2} y={9} className="viz-tick">
        First 10 s
      </text>
      {placed.map((p) => (
        <circle key={p.key} cx={p.x} cy={p.y} r={r} style={{ fill: p.color }} className="viz-dot" />
      ))}
      <line x1={x(0)} x2={x(span)} y1={bottom + 4} y2={bottom + 4} className="viz-axis" />
      {[0, 10, 20, 30].map((s) => (
        <text key={s} x={x(s)} y={H - 4} className="viz-tick" textAnchor={s === 0 ? "start" : s === span ? "end" : "middle"}>
          {s} s
        </text>
      ))}
    </svg>
  );
}

function SupplyBar({ check }: { check: Check }) {
  const top = [...check.bubble_map.nodes].sort((a, b) => b.share - a.share).slice(0, 10);
  const rest = Math.max(0, 1 - top.reduce((s, n) => s + n.share, 0));
  return (
    <div className="viz-stack" role="img" aria-label="The 10 largest holders' shares of supply, colored by group">
      <div className="viz-stack__bar">
        {top.map((n) => (
          <i key={n.wallet} style={{ width: `${n.share * 100}%`, background: swatchVar(NODE_SWATCH[n.group]) }} />
        ))}
        <i className="viz-stack__rest" style={{ width: `${rest * 100}%` }} />
      </div>
      <div className="viz-stack__keys">
        <span>Top 10 holders</span>
        <span>Everyone else</span>
      </div>
    </div>
  );
}

function OutcomeLine({ check }: { check: Check }) {
  const ends = check.similar.slice(0, 5).map((m) => (m.ended === "rugged" && m.rugged_after_s != null ? m.rugged_after_s : null));
  // A log scale from 1 minute to a day, so rugs within the hour and rugs a day later both have room.
  const lo = 60;
  const hi = 24 * 3600;
  const x = (s: number) => 10 + (Math.log(Math.min(Math.max(s, lo), hi) / lo) / Math.log(hi / lo)) * (W - 20);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="When each of the 5 most similar past launches rugged, on a log scale up to a day">
      {check.similar.slice(0, 5).map((m, i) => {
        const at = ends[i] ?? hi;
        const y = 12 + i * 15;
        return (
          <g key={m.mint}>
            <line x1={x(lo)} x2={x(at)} y1={y} y2={y} className="viz-run" />
            {ends[i] != null ? <circle cx={x(at)} cy={y} r={4} className="viz-rug" /> : <circle cx={x(at)} cy={y} r={3.5} className="viz-alive" />}
          </g>
        );
      })}
      <line x1={x(lo)} x2={x(hi)} y1={H - 20} y2={H - 20} className="viz-axis" />
      {[
        [lo, "1 min"],
        [600, "10 min"],
        [3600, "1 h"],
        [6 * 3600, "6 h"],
        [hi, "1 day"],
      ].map(([s, label]) => (
        <text key={label} x={x(s as number)} y={H - 6} className="viz-tick" textAnchor={s === lo ? "start" : s === hi ? "end" : "middle"}>
          {label}
        </text>
      ))}
    </svg>
  );
}

function Copycats({ check }: { check: Check }) {
  const list = (check.copycats?.tokens ?? []).slice(0, 4);
  if (!list.length) return <p className="viz-empty">No other token used the name in the week before.</p>;
  return (
    <ul className="viz-copy" aria-label="Tokens that used the same name or ticker in the week before">
      {list.map((t) => (
        <li key={t.mint}>
          <span className="viz-copy__name">
            {t.symbol} <span>{t.name}</span>
          </span>
          <span className="viz-copy__age">{minutes(t.age_s)} older</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- The cards ---------- */

function security(run: Run) {
  const step = run.events.find((e): e is StepEvent => e.type === "step" && e.tool === "token_security" && e.status === "done");
  return (step?.result ?? {}) as Record<string, string>;
}

const yesNo = (v: string | undefined) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "Not checked");

function cards(run: Run, check: Check): Card[] {
  const s = check.signals;
  const auth = security(run);
  const funders = check.bubble_map.funders ?? [];
  return [
    {
      title: "The model",
      sub: `Trained on ${whole(modelFacts.trainTokens)} tokens`,
      visual: <RugCandles />,
      rows: [
        ["Launches studied", whole(modelFacts.launches)],
        ["Snapshots it learned from", whole(modelFacts.trainSnapshots)],
        ["Held-out test tokens", whole(modelFacts.testTokens)],
        ["Fair AUC on the test day (coin flip 0.50)", modelFacts.auc.trees.toFixed(2)],
      ],
    },
    {
      title: "Connected holders",
      sub: "Funding traced two hops back",
      visual: <BubbleMap nodes={check.bubble_map.nodes} links={check.bubble_map.links} funders={funders} width={W} height={120} compact label={`${check.symbol}'s bubble map`} />,
      rows: [
        ["Team wallets", num(s.team_wallets)],
        ["Held by the team, now and at peak", `${pct(num(s.team_share))} / ${pct(num(s.team_peak_share))}`],
        ["Wallets that funded 2 or more holders", funders.length],
        ["Likely team, same exchange and amount", num(s.likely_team_wallets)],
      ],
    },
    {
      title: "Launch",
      sub: "The first block and first minutes",
      visual: <MiniChart chart={check.chart} width={W} height={H} compact first={20} sells={false} label={`${check.symbol}'s first five minutes`} />,
      rows: [
        ["Bought in the launch block", pct(num(s.supply_bought_slot0))],
        ["Bundle wallets", `${num(s.bundle_wallets)}, buying ${pct(num(s.bundle_supply_share))}`],
        ["Creator’s own buy", pct(num(s.creator_buy_share))],
        ["Market cap at 1 and 5 minutes", `${whole(num(s.mcap_1m_sol))} / ${whole(num(s.mcap_5m_sol))} SOL`],
      ],
    },
    {
      title: "Repeat buy amounts",
      sub: "The same size, again and again",
      visual: check.same_size_buys?.length ? (
        <SameSizeBars sizes={check.same_size_buys} />
      ) : (
        <ShareBars
          label="Share of buys at a repeated exact size, and at a round size"
          bars={[
            { label: "Same exact size", v: num(s.same_size_buy_share) },
            { label: "Round size", v: num(s.round_size_buy_share) },
          ]}
        />
      ),
      rows: [
        ["Buys sharing an exact size", pct(num(s.same_size_buy_share))],
        ["Largest same-size group", `${num(s.top_same_size_buys)} buys`],
        ["Round-number buys", pct(num(s.round_size_buy_share))],
      ],
    },
    {
      title: "Team selling",
      sub: "Who sells, and into whom",
      visual: <TeamSells check={check} />,
      rows: [
        ["Share of peak sold", pct(num(s.team_sold_share))],
        ["Sells within 10 s of an outside buy", pct(num(s.team_sells_into_buys), 0)],
        ["Team’s share of selling", pct(num(s.team_sell_volume_share))],
        ["Team’s share of all volume", pct(num(s.team_volume_share))],
      ],
    },
    {
      title: "Snipers",
      sub: "Buyers in the first 10 seconds",
      visual: <SniperSwarm check={check} />,
      rows: [
        ["Snipers", num(s.snipers)],
        ["Known sniper bots", num(s.sniper_bots)],
        ["Supply they bought", pct(num(s.sniper_bought_share))],
        ["Of that, sold", pct(num(s.sniper_sold_share))],
      ],
    },
    {
      title: "Supply",
      sub: "How the supply is spread",
      visual: <SupplyBar check={check} />,
      rows: [
        ["Holders", whole(num(s.holders))],
        ["Top holder", pct(num(s.top_holder_share))],
        ["Top 10", pct(num(s.top10_share))],
        ["Largest linked cluster", pct(num(s.top_cluster_share))],
      ],
    },
    {
      title: "Wallets",
      sub: "Who the buyers are",
      visual: (
        <ShareBars
          label="Shares of buyers that are independent, fresh, and funded within an hour"
          bars={[
            { label: "Independent", v: num(s.independent_buyers) / Math.max(1, num(s.buyers)) },
            { label: "Fresh", v: num(s.fresh_buyer_share) },
            { label: "Funded last hour", v: num(s.funded_last_hour_share) },
          ]}
        />
      ),
      rows: [
        ["Independent buyers", whole(num(s.independent_buyers))],
        ["Per 100 SOL of market cap", num(s.independent_per_100_sol).toFixed(1)],
        ["Fresh wallets", pct(num(s.fresh_buyer_share))],
        ["Funded within an hour of buying", pct(num(s.funded_last_hour_share))],
      ],
    },
    {
      title: "Trading",
      sub: "Volume by who traded",
      visual: <MiniChart chart={check.chart} width={W} height={H} compact price={false} label={`${check.symbol}'s volume by who traded`} />,
      rows: [
        ["Wash-trading wallets", num(s.wash_wallets)],
        ["Their share of volume", pct(num(s.wash_volume_share))],
        ["Trades per trader", num(s.trades_per_trader).toFixed(2)],
        ["Buys right after a linked wallet sold", num(s.linked_round_trips)],
      ],
    },
    {
      title: "Chart shape",
      sub: "Curve progress is the strongest signal",
      visual: <MiniChart chart={check.chart} width={W} height={H} compact volume={false} sells={false} label={`${check.symbol}'s chart to the check`} />,
      rows: [
        ["Bonding curve filled per minute", pct(num(s.progress_per_minute))],
        ["Green candles", pct(num(s.green_candle_share), 0)],
        ["Fall from peak", pct(num(s.fall_from_peak))],
        ["Independent share of buying", pct(check.chart.independent_buy_share)],
      ],
    },
    {
      title: "Similar launches",
      sub: "The 5 nearest past tokens",
      visual: <OutcomeLine check={check} />,
      rows: check.similar.slice(0, 4).map((m) => [
        <span className="mono" key={m.mint}>
          {shortAddr(m.mint)}
        </span>,
        m.ended === "rugged" && m.rugged_after_s != null ? `Rugged after ${hoursAfter(m.rugged_after_s)}` : m.ended === "faded" ? "Faded" : "Survived",
      ]) as [ReactNode, ReactNode][],
    },
    {
      title: "Cross-checks",
      sub: "Copycats and token authorities",
      visual: <Copycats check={check} />,
      rows: [
        ["Copycat names in the week before", check.copycats?.covered === false ? "Not checked yet" : whole(check.copycats?.total ?? 0)],
        ["New tokens can be minted", yesNo(auth["new tokens can be minted"])],
        ["Holders’ accounts can be frozen", yesNo(auth["holders' accounts can be frozen"])],
        ["Authorities source", "Powered by GoPlus"],
      ],
    },
  ];
}

/** Every family of signals as cards, each with this check's own values. */
export function CheckCards({ run, check }: { run: Run; check: Check }) {
  const list = useMemo(() => cards(run, check), [run, check]);
  return (
    <ul className="checks__grid">
      {list.map((c) => (
        <li key={c.title} className="check-card">
          <div className="check-card__viz">{c.visual}</div>
          <h3>{c.title}</h3>
          <p className="check-card__sub">{c.sub}</p>
          <dl>
            {c.rows.map(([k, v], i) => (
              <div key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** "What we check" on the home page: the cards, with the lead saved check's values. */
export function Checks() {
  const [run, setRun] = useState<Run | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadRuns()
      .then((runs) => loadRun(runs[0].id))
      .then(setRun, () => setFailed(true));
  }, []);

  const check = run ? answerOf(run)?.check : undefined;

  if (failed) return <p className="checks__empty">The saved checks didn’t load, so these cards have no values to show.</p>;
  if (!run || !check) return <div className="checks__grid checks__grid--loading" aria-busy="true" />;

  return (
    <>
      <CheckCards run={run} check={check} />
      <p className="checks__note">
        Values are {check.symbol}’s, {Math.round(check.age_s / 60)} minutes after launch, at {sol(num(check.signals.mcap_sol))} market cap. The model’s
        numbers are from the May 16 test day.
      </p>
    </>
  );
}

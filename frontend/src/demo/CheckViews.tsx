import { useMemo } from "react";
import { ArrowUp, Check as CheckIcon, LoaderCircle, Paperclip, ShieldCheck } from "lucide-react";
import { BubbleMap } from "./BubbleMap";
import { MiniChart } from "./MiniChart";
import { CHART_ORDER, CHART_SWATCH, NODE_LABEL, NODE_SWATCH, SWATCH_LABEL, swatchVar, type Swatch } from "./groups";
import { pct, shortAddr, whole, type AnswerEvent, type Check } from "./runs";
import type { Frame } from "./timeline";

/**
 * The pieces of a rug check that the home demo and the IDE both draw: the chart, the holders, and the agent's steps
 * and answer. They take a Frame, so a replay (part of the way through) and a live check (as events arrive) look alike.
 */

/** A Solana address inside text, shortened for the thread. */
const MINT = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

const STEP_TITLE: Record<string, string> = {
  check_token: "Checked the token",
  token_security: "Checked token authorities",
  find_token: "Looked up the name",
  read_address: "Read the address",
  copy_trade: "Backtested the copy",
};
const STEP_RUNNING: Record<string, string> = {
  check_token: "Checking the token",
  token_security: "Checking token authorities",
  find_token: "Looking up the name",
  read_address: "Reading the address",
  copy_trade: "Backtesting the copy",
};

export function ChartView({ check, frame, width = 720, height = 330 }: { check: Check; frame: Frame; width?: number; height?: number }) {
  const swatches = useMemo(() => {
    const used = new Set<Swatch>();
    for (const c of check.chart.candles) for (const g of CHART_ORDER) if (c.volume[g]) used.add(CHART_SWATCH[g]);
    return [...used];
  }, [check]);
  const tx = frame.counters.transactions;
  return (
    <div className="chartv">
      <div className="ws__head">
        <p className="ws__h">Market cap in SOL, 15-second candles</p>
        <p className="ws__sub">{tx != null ? `${whole(tx)} transactions read` : frame.chartFill >= 1 ? `${whole(check.transactions_read)} transactions read` : "Reading transactions"}</p>
      </div>
      <MiniChart chart={check.chart} width={width} height={height} upTo={Math.ceil(frame.chartFill * check.chart.candles.length)} />
      <ul className="legend">
        {swatches.map((s) => (
          <li key={s}>
            <i style={{ background: swatchVar(s) }} />
            {SWATCH_LABEL[s]}
          </li>
        ))}
        <li>
          <i className="legend__sell" />
          Team sell
        </li>
      </ul>
    </div>
  );
}

export function HoldersView({ check, frame, mapWidth = 460, mapHeight = 330, rows = 9 }: { check: Check; frame: Frame; mapWidth?: number; mapHeight?: number; rows?: number }) {
  const holders = useMemo(() => [...check.bubble_map.nodes].sort((a, b) => b.share - a.share).slice(0, rows), [check, rows]);
  const w = frame.counters.wallets;
  return (
    <div className="holdv">
      <div className="holdv__map">
        <div className="ws__head">
          <p className="ws__h">Who holds it</p>
          <p className="ws__sub">{w ? `${w[0]} of ${w[1]} wallets traced` : frame.map.appear >= 1 ? `${check.traced_wallets} wallets traced` : "Tracing wallets"}</p>
        </div>
        <BubbleMap
          nodes={check.bubble_map.nodes}
          links={check.bubble_map.links}
          funders={check.bubble_map.funders}
          teamShare={typeof check.signals.team_share === "number" ? check.signals.team_share : undefined}
          width={mapWidth}
          height={mapHeight}
          appear={frame.map.appear}
          linkDraw={frame.map.linkDraw}
          color={frame.map.color}
        />
        <p className="ws__note">Sized by share of supply. Dark dots are wallets that funded two or more holders; lines are the funding.</p>
      </div>
      <div className="holdv__list">
        <p className="ws__h">Top holders</p>
        <ol>
          {holders.map((n) => {
            const sw = NODE_SWATCH[n.group];
            const known = frame.map.color === "all" || (frame.map.color === "team" && (sw === "team" || sw === "likely"));
            return (
              <li key={n.wallet}>
                <span className="mono">{shortAddr(n.wallet)}</span>
                <span className="holdv__group">
                  <i style={{ background: known ? swatchVar(sw) : "var(--map-pending)" }} />
                  {known ? NODE_LABEL[n.group] : "Tracing"}
                </span>
                <span className="holdv__share">{pct(n.share)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Splits the answer into paragraphs and lists (lines starting "- " or "* "), keeping what has streamed in so far. */
export function Answer({ text }: { text: string }) {
  const bullet = /^[-*] /;
  return (
    <div className="answer">
      {text.split(/\n\n+/).map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const items = lines.filter((l) => bullet.test(l));
        if (!items.length) return <p key={i}>{b}</p>;
        const lead = lines.filter((l) => !bullet.test(l));
        return (
          <div key={i}>
            {lead.map((l, j) => (
              <p key={j}>{l}</p>
            ))}
            <ul>
              {items.map((l, j) => (
                <li key={j}>{l.replace(bullet, "")}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The agent's work on one message: each step with its live counts, then the answer and its numbers audit. */
export function RunSteps({ frame, words, answer }: { frame: Frame; words: string[]; answer?: AnswerEvent }) {
  const c = frame.counters;
  return (
    <>
      {frame.steps.length > 0 && (
        <ol className="steps" aria-label="Agent steps">
          {frame.steps.map((s, i) => (
            <li key={i} className={s.state === "done" ? "is-done" : s.state === "error" ? "is-error" : ""}>
              <span className="steps__icon" aria-hidden>
                {s.state === "done" ? (
                  s.tool === "token_security" ? (
                    <ShieldCheck size={14} />
                  ) : (
                    <CheckIcon size={14} />
                  )
                ) : s.state === "error" ? (
                  <CheckIcon size={14} />
                ) : (
                  <LoaderCircle size={14} className="spin" />
                )}
              </span>
              <div>
                <p className="steps__title">{s.state === "running" ? (STEP_RUNNING[s.tool] ?? s.tool) : (STEP_TITLE[s.tool] ?? s.tool)}</p>
                {s.state !== "running" && s.done?.summary && <p className="steps__sum">{s.done.summary.replace(MINT, shortAddr).replace(" · ", ", ")}</p>}
                {s.tool === "copy_trade" && (c.walletTx != null || c.positions) && (
                  <ul className="steps__live">
                    {c.walletTx != null && <li>{whole(c.walletTx)} of the wallet’s latest transactions read</li>}
                    {c.positions && (
                      <li>
                        {c.positions[0]} of {c.positions[1]} closed positions priced
                      </li>
                    )}
                  </ul>
                )}
                {s.tool === "check_token" && (
                  <ul className="steps__live">
                    {c.transactions != null && <li>{whole(c.transactions)} transactions read</li>}
                    {c.wallets && (
                      <li>
                        {c.wallets[0]} of {c.wallets[1]} wallets traced
                      </li>
                    )}
                    {c.busy != null && <li>{c.busy} busy wallets checked for exchanges and bots</li>}
                    {c.funders && (
                      <li>
                        {c.funders[0]} of {c.funders[1]} funders traced
                      </li>
                    )}
                    {c.snipes && (
                      <li>
                        {c.snipes[0]} early buyers checked, {c.snipes[1]} sniper {c.snipes[1] === 1 ? "bot" : "bots"}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {frame.answerChars > 0 && <Answer text={words.slice(0, frame.answerChars).join("")} />}
      {frame.audited && answer?.audit.passed && (
        <p className="audit">
          <CheckIcon size={13} aria-hidden />
          {answer.audit.numbers} numbers checked against the data
        </p>
      )}
    </>
  );
}

/** The demo's message box. On a new check it sits in the middle of the window; after that, under the thread. */
export function Composer({ text, typing, wide }: { text: string; typing?: boolean; wide?: boolean }) {
  return (
    <div className={`composer${wide ? " composer--wide" : ""}`}>
      <p className={`composer__text${typing ? " is-typing" : ""}`}>
        {text || <span className="composer__ph">Paste a pump.fun link, a ticker or an address</span>}
      </p>
      <div className="composer__foot">
        <Paperclip size={14} aria-hidden />
        <span className="composer__model">Muse Spark 1.3</span>
        <span className={`composer__send${typing ? " is-ready" : ""}`} aria-hidden>
          <ArrowUp size={14} />
        </span>
      </div>
    </div>
  );
}

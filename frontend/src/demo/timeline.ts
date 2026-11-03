import type { AnswerEvent, ProgressEvent, Run, StepEvent } from "./runs";

/**
 * Turns a saved run into a replay schedule. The order and every count come from the run's own events; only the
 * pacing is ours, sped up so a check fits in about half a minute. A live check uses the same Frame, built from the
 * events that have arrived (frameFromEvents).
 */

type Kind = ProgressEvent["step"];

/** Time each kind of progress gets on screen, shared by its events. */
const KIND_MS: Record<Kind, number> = { token: 1700, wallets: 3400, busy: 900, funders: 1700, snipes: 1800, wallet: 1600, positions: 2800, reused: 400 };
const SECURITY_MS = 1000;
const TYPE_MS = 24;
/** A link is pasted, not typed: a short beat, then all of it at once, as people do. */
const PASTE_PAUSE_MS = 380;
const LINK = /(?:https?:\/\/)?pump\.fun\/\S+|\S*[1-9A-HJ-NP-Za-km-z]{32,44}\S*/;

/** When each character of the message appears: typed a letter at a time, any link pasted whole. */
function typingTimes(message: string, start: number): number[] {
  const link = LINK.exec(message);
  const from = link ? link.index : -1;
  const to = link ? link.index + link[0].length : -1;
  const at: number[] = [];
  let t = start;
  for (let i = 0; i < message.length; i++) {
    if (i === from) t += PASTE_PAUSE_MS;
    else if (i < from || i >= to) t += TYPE_MS;
    at.push(t);
  }
  return at;
}
const WORD_MS = 20;
const ANSWER_MAX_MS = 4600;

export type PlannedStep = { tool: string; start: number; end: number; done?: StepEvent };
export type Plan = {
  typeStart: number;
  typeEnd: number;
  typeAt: number[];
  sendAt: number;
  steps: PlannedStep[];
  progress: { at: number; ev: ProgressEvent }[];
  phase: Partial<Record<Kind, { start: number; end: number }>>;
  answer: AnswerEvent | undefined;
  words: string[];
  answerStart: number;
  answerEnd: number;
  end: number;
};

export function plan(run: Run): Plan {
  const typeStart = 450;
  const typeAt = typingTimes(run.message, typeStart);
  const typeEnd = typeAt.length ? typeAt[typeAt.length - 1] : typeStart;
  const sendAt = typeEnd + 450;

  const steps: PlannedStep[] = [];
  const progress: Plan["progress"] = [];
  const phase: Plan["phase"] = {};
  let t = sendAt + 350;
  const events = run.events;
  // Progress events come in runs of one kind; each run gets its kind's share of time.
  const kindCount = new Map<Kind, number>();
  for (const e of events) if (e.type === "progress") kindCount.set(e.step, (kindCount.get(e.step) ?? 0) + 1);

  for (const e of events) {
    if (e.type === "step" && e.status === "running") {
      steps.push({ tool: e.tool, start: t, end: t });
      if (e.tool === "token_security") t += SECURITY_MS;
      else if (e.tool !== "check_token") t += 900;
      else t += 250;
    } else if (e.type === "step") {
      const s = [...steps].reverse().find((p) => p.tool === e.tool);
      if (s) {
        s.end = t;
        s.done = e;
      }
      t += 300;
    } else if (e.type === "progress") {
      const each = KIND_MS[e.step] / (kindCount.get(e.step) ?? 1);
      t += each;
      progress.push({ at: t, ev: e });
      const p = phase[e.step];
      if (p) p.end = t;
      else phase[e.step] = { start: t - each, end: t };
    }
  }

  const answer = events.find((e): e is AnswerEvent => e.type === "answer");
  const words = answer ? answer.text.split(/(\s+)/) : [];
  const answerStart = t + 400;
  const answerEnd = answerStart + Math.min(ANSWER_MAX_MS, (words.length / 2) * WORD_MS);
  return { typeStart, typeEnd, typeAt, sendAt, steps, progress, phase, answer, words, answerStart, answerEnd, end: answerEnd + 700 };
}

export type View = "chart" | "holders" | "result";

export type Counters = {
  transactions?: number;
  wallets?: [number, number];
  busy?: number;
  funders?: [number, number];
  snipes?: [number, number];
  /** A copy-trade backtest's: the wallet's transactions read, and its positions priced of all of them. */
  walletTx?: number;
  found?: number;
  positions?: [number, number];
  /** Positions reused from a run on the same wallet in the last 30 minutes. */
  reused?: number;
};

export type Frame = {
  typed: number;
  sent: boolean;
  steps: { tool: string; state: "running" | "done" | "error"; done?: StepEvent }[];
  counters: Counters;
  kindsStarted: Kind[];
  kindsDone: Kind[];
  view: View | null;
  chartFill: number;
  map: { appear: number; linkDraw: number; color: "none" | "team" | "all" };
  /** How many pieces of the answer (words and the spaces between them) have come in. */
  answerChars: number;
  answering: boolean;
  audited: boolean;
  finished: boolean;
};

/** The latest counts from a list of progress events. A second pass of busy checks starts its count again; keep the total. */
function countersOf(events: ProgressEvent[]) {
  const counters: Counters = {};
  let busyBase = 0;
  let lastBusyOf = 0;
  for (const ev of events) {
    if (ev.step === "token") counters.transactions = ev.transactions;
    if (ev.step === "wallets") counters.wallets = [ev.scanned ?? 0, ev.of ?? 0];
    if (ev.step === "busy") {
      if ((ev.checked ?? 0) === 1 && lastBusyOf) busyBase += lastBusyOf;
      lastBusyOf = ev.of ?? 0;
      counters.busy = busyBase + (ev.checked ?? 0);
    }
    if (ev.step === "funders") counters.funders = [ev.scanned ?? 0, ev.of ?? 0];
    if (ev.step === "snipes") counters.snipes = [ev.lookups ?? 0, ev.sniper_bots ?? 0];
    if (ev.step === "wallet") {
      counters.walletTx = ev.transactions;
      counters.found = ev.positions;
    }
    if (ev.step === "positions") counters.positions = [ev.done ?? 0, ev.of ?? 0];
    if (ev.step === "reused") counters.reused = ev.positions ?? 0;
  }
  return counters;
}

const mapColor = (started: Kind[], answered: boolean): Frame["map"]["color"] =>
  started.includes("snipes") || answered ? "all" : started.includes("funders") ? "team" : "none";

export function frameAt(p: Plan, t: number): Frame {
  let maxTx = 0;
  for (const { ev } of p.progress) if (ev.step === "token") maxTx = Math.max(maxTx, ev.transactions ?? 0);
  const counters = countersOf(p.progress.filter((x) => x.at <= t).map((x) => x.ev));
  const kinds = Object.entries(p.phase) as [Kind, { start: number; end: number }][];
  const kindsStarted = kinds.filter(([, r]) => r.start <= t).map(([k]) => k);
  const kindsDone = kinds.filter(([, r]) => r.end <= t).map(([k]) => k);
  const steps = p.steps
    .filter((s) => s.start <= t)
    .map((s) => ({
      tool: s.tool,
      state: (s.done && s.end <= t ? (s.done.status === "error" ? "error" : "done") : "running") as Frame["steps"][number]["state"],
      done: s.done,
    }));

  const after = (k: Kind) => kindsDone.includes(k);
  const during = (k: Kind) => kindsStarted.includes(k) && !after(k);
  const frac = (k: Kind, v?: [number, number]) => (after(k) ? 1 : during(k) && v ? v[0] / Math.max(1, v[1]) : 0);

  const checkStep = p.steps.find((s) => s.tool === "check_token");
  let view: View | null = null;
  if (t >= p.answerStart) view = "result";
  else if (kindsStarted.some((k) => k !== "token")) view = "holders";
  else if (checkStep && t >= checkStep.start) view = "chart";

  const answerChars = t < p.answerStart ? 0 : Math.round(((t - p.answerStart) / (p.answerEnd - p.answerStart)) * p.words.length);
  return {
    typed: p.typeAt.filter((at) => at <= t).length,
    sent: t >= p.sendAt,
    steps,
    counters,
    kindsStarted,
    kindsDone,
    view,
    chartFill: after("token") ? 1 : maxTx ? (counters.transactions ?? 0) / maxTx : 0,
    map: {
      appear: frac("wallets", counters.wallets),
      linkDraw: frac("funders", counters.funders),
      color: mapColor(kindsStarted, t >= p.answerStart),
    },
    answerChars: Math.min(p.words.length, answerChars),
    answering: t >= p.answerStart && t < p.answerEnd,
    audited: t >= p.answerEnd + 300,
    finished: t >= p.end,
  };
}

/** A live check's frame: everything that has arrived is shown. `done` says the stream has ended. */
export function frameFromEvents(run: Run, done: boolean): Frame {
  const progress = run.events.filter((e): e is ProgressEvent => e.type === "progress");
  const counters = countersOf(progress);
  const order: Kind[] = [];
  for (const e of progress) if (!order.includes(e.step)) order.push(e.step);
  // A kind is done once a later kind has started, or the check step has finished.
  const checkDone = run.events.some((e) => e.type === "step" && e.tool === "check_token" && e.status !== "running");
  const kindsDone = order.filter((_, i) => i < order.length - 1 || checkDone);
  const steps: Frame["steps"] = [];
  for (const e of run.events) {
    if (e.type !== "step") continue;
    if (e.status === "running") steps.push({ tool: e.tool, state: "running" });
    else {
      const s = [...steps].reverse().find((x) => x.tool === e.tool && x.state === "running");
      if (s) Object.assign(s, { state: e.status === "error" ? "error" : "done", done: e });
      else steps.push({ tool: e.tool, state: e.status === "error" ? "error" : "done", done: e });
    }
  }
  const answer = run.events.find((e): e is AnswerEvent => e.type === "answer");
  const words = answer ? answer.text.split(/(\s+)/) : [];
  const has = (k: Kind) => kindsDone.includes(k);
  const frac = (k: Kind, v?: [number, number]) => (has(k) ? 1 : order.includes(k) && v ? v[0] / Math.max(1, v[1]) : 0);
  return {
    typed: run.message.length,
    sent: true,
    steps,
    counters,
    kindsStarted: order,
    kindsDone,
    view: answer ? "result" : order.some((k) => k !== "token") ? "holders" : order.length ? "chart" : null,
    chartFill: has("token") || answer ? 1 : 0.5,
    map: { appear: answer ? 1 : frac("wallets", counters.wallets), linkDraw: answer ? 1 : frac("funders", counters.funders), color: mapColor(order, !!answer) },
    answerChars: words.length,
    answering: false,
    audited: !!answer,
    finished: done,
  };
}

import { useEffect, useMemo, useState } from "react";
import type { AnswerEvent, CopyRequest, CopyTrade, RunEvent } from "../demo/runs";
import { frameAt, frameFromEvents, plan as makePlan, type Frame, type Plan } from "../demo/timeline";
import type { Attachment, CheckRun, Turn } from "./state";

/**
 * The backend, when there is one. Locally, Vite proxies /api to `uv run uvicorn receipts.server:app --port 8000`;
 * VITE_API_URL points a build at a hosted backend. The static site has none, so its chat replays saved checks.
 */
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type Backend = "checking" | "online" | "offline";

let probe: Promise<boolean> | null = null;
let failedAt = 0;
/** After a failed probe, wait this long before asking again: the backend may come up after the page. */
const RETRY_MS = 5000;

function reachable(): Promise<boolean> {
  if (!probe && Date.now() - failedAt < RETRY_MS) return Promise.resolve(false);
  probe ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 2500);
      const res = await fetch(`${API}/api/health`, { signal: ctl.signal });
      window.clearTimeout(t);
      // A static host can answer any path with the app's own page; only the backend says {"ok": true}.
      if (!res.ok || !res.headers.get("content-type")?.includes("json")) return false;
      return (await res.json())?.ok === true;
    } catch {
      return false;
    }
  })();
  const p = probe;
  // A success is kept for the page; a failure is forgotten, so the next ask tries again.
  void p.then((ok) => {
    if (!ok && probe === p) {
      probe = null;
      failedAt = Date.now();
    }
  });
  return p;
}

export function useBackend(): Backend {
  const [state, setState] = useState<Backend>("checking");
  useEffect(() => {
    let live = true;
    let timer = 0;
    const check = () =>
      reachable().then((ok) => {
        if (!live) return;
        setState(ok ? "online" : "offline");
        if (!ok) timer = window.setTimeout(check, RETRY_MS);
      });
    void check();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, []);
  return state;
}

/** What the backend streams: the agent's events, a copy-trade backtest's result, or an error. */
export type Streamed = RunEvent | { type: "result"; copy_trade: CopyTrade } | { type: "error"; message: string };

/**
 * Sends a message to the agent, with the thread so far and any attachment, and hands each event to `onEvent` as it
 * streams back (server-sent events). `contextId` names the thread's latest result (an answer's `run_id`, or
 * "demo:<saved run id>"), so a follow-up is answered from the data already pulled.
 */
export function streamAgent(
  message: string,
  onEvent: (e: Streamed) => void,
  opts: { history?: Turn[]; attachment?: Attachment; contextId?: string; signal?: AbortSignal } = {},
) {
  const { history = [], attachment, contextId, signal } = opts;
  const media = attachment ? { [attachment.kind]: attachment.dataUrl } : {};
  return stream("/api/agent", { message, history, ...media, ...(contextId ? { context_id: contextId } : {}) }, onEvent, signal);
}

/** Runs a copy-trade backtest without the agent: progress events, then `{type: "result", copy_trade}`. No Meta call. */
export function streamCopyTrade(request: CopyRequest, onEvent: (e: Streamed) => void, signal?: AbortSignal) {
  return stream("/api/copytrade", request, onEvent, signal);
}

async function stream(path: string, body: unknown, onEvent: (e: Streamed) => void, signal?: AbortSignal) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    // FastAPI says why in `detail`: a sentence for our own refusals, a list for a malformed request.
    const detail = await res.json().catch(() => null);
    onEvent({ type: "error", message: typeof detail?.detail === "string" ? detail.detail : `The backend answered ${res.status}.` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as Streamed);
    }
  }
}

export type CheckFrame = { frame: Frame; plan: Plan | null; words: string[]; answer?: AnswerEvent; finished: boolean };

/**
 * Where a check stands right now. A replay runs on its own clock from when it started (skipping the typing, since
 * the message is already sent); a live check shows whatever has arrived.
 */
export function useCheckFrame(c: CheckRun | undefined, onFinish?: () => void): CheckFrame | null {
  const replayPlan = useMemo(() => (c && c.mode === "replay" ? makePlan(c.run) : null), [c?.run, c?.mode]);
  const [now, setNow] = useState(() => performance.now());
  const ticking = !!c && c.mode === "replay" && c.status === "running" && Number.isFinite(c.startedAt);

  useEffect(() => {
    if (!ticking) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ticking]);

  const replayT = c && replayPlan ? (c.status === "waiting" ? replayPlan.sendAt : Number.isFinite(c.startedAt) ? now - c.startedAt + replayPlan.sendAt : replayPlan.end) : 0;
  const ended = !!replayPlan && replayT >= replayPlan.end;

  useEffect(() => {
    if (ticking && ended) onFinish?.();
  }, [ticking, ended]);

  if (!c) return null;
  if (replayPlan) {
    const frame = frameAt(replayPlan, Math.min(replayT, replayPlan.end));
    return { frame, plan: replayPlan, words: replayPlan.words, answer: replayPlan.answer, finished: frame.finished };
  }
  const frame = frameFromEvents(c.run, c.status !== "running");
  const answer = c.run.events.find((e): e is AnswerEvent => e.type === "answer");
  return { frame, plan: null, words: answer ? answer.text.split(/(\s+)/) : [], answer, finished: c.status !== "running" };
}

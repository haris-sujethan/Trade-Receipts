import { useEffect, useMemo, useState } from "react";
import type { AnswerEvent, RunEvent } from "../demo/runs";
import { frameAt, frameFromEvents, plan as makePlan, type Frame, type Plan } from "../demo/timeline";
import type { Attachment, CheckRun, Turn } from "./state";

/**
 * The backend, when there is one. Locally, Vite proxies /api to `uv run uvicorn receipts.server:app --port 8000`;
 * VITE_API_URL points a build at a hosted backend. The static site has none, so its chat replays saved checks.
 */
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type Backend = "checking" | "online" | "offline";

let probe: Promise<boolean> | null = null;

function reachable(): Promise<boolean> {
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
  return probe;
}

export function useBackend(): Backend {
  const [state, setState] = useState<Backend>("checking");
  useEffect(() => {
    let live = true;
    reachable().then((ok) => live && setState(ok ? "online" : "offline"));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

type Streamed = RunEvent | { type: "error"; message: string };

/**
 * Sends a message to the agent, with the thread so far and any attachment, and hands each event to `onEvent` as it
 * streams back (server-sent events).
 */
export async function streamAgent(
  message: string,
  onEvent: (e: Streamed) => void,
  opts: { history?: Turn[]; attachment?: Attachment; signal?: AbortSignal } = {},
) {
  const { history = [], attachment, signal } = opts;
  const media = attachment ? { [attachment.kind]: attachment.dataUrl } : {};
  const res = await fetch(`${API}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, ...media }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => null);
    onEvent({ type: "error", message: detail?.detail ?? `The backend answered ${res.status}.` });
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
    const frame = frameAt(replayPlan, c.run, Math.min(replayT, replayPlan.end));
    return { frame, plan: replayPlan, words: replayPlan.words, answer: replayPlan.answer, finished: frame.finished };
  }
  const frame = frameFromEvents(c.run, c.status !== "running");
  const answer = c.run.events.find((e): e is AnswerEvent => e.type === "answer");
  return { frame, plan: null, words: answer ? answer.text.split(/(\s+)/) : [], answer, finished: c.status !== "running" };
}

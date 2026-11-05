import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowUp, ImagePlus, PanelRightClose, Paperclip, Play, Plus, History, X } from "lucide-react";
import { RunSteps } from "../demo/CheckViews";
import { answerOf, loadRun } from "../demo/runs";
import { useBackend, useCheckFrame } from "./live";
import {
  COPY_FRESH_MS,
  COPY_HERO_KEY,
  copySoon,
  exampleThreadTitle,
  FOLLOW_UP_SOON,
  HERO_KEY,
  isCopyRun,
  LIVE_SOON,
  savedCopyMatch,
  savedMatch,
  tabOf,
  threadSubjects,
  threadTitle,
  useIde,
  type Attachment,
  type ThreadRef,
  type WorkTab,
} from "./state";
import { CheckHelp, findFailure } from "./CheckHelp";
import "../demo/demo.css";

const minutesAgo = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60_000);
  return m < 1 ? "just now" : `${m} min ago`;
};

/** A Solana address in a message: a token's mint or a wallet. */
const ADDRESS = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// What the backend accepts (receipts/server.py): mp4 clips up to 25 MB, images up to 8 MB.
const LIMITS = { video: 25 * 2 ** 20, image: 8 * 2 ** 20 };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const placeholders: Record<WorkTab, string> = {
  Analyze: "Paste a pump.fun link, a ticker or a token’s address…",
  "Copy trade": "Paste a pump.fun profile, and when you’d buy and sell after it…",
};

const starts: Record<WorkTab, { hello: string; sub: string }> = {
  Analyze: { hello: "Which token should I check?", sub: "Paste a pump.fun link, a ticker or a token’s address." },
  "Copy trade": { hello: "Which wallet should I copy?", sub: "Paste a pump.fun profile link and say how long after they buy and sell you’d copy." },
};

export function Thread() {
  const { state, dispatch } = useIde();
  const backend = useBackend();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const clipInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const canAttach = backend === "online" && state.workTab === "Analyze";
  const user = typeof state.thread === "number" ? state.threads.find((t) => t.id === state.thread) : undefined;
  const items = user?.items ?? [];
  const hero = state.checks[HERO_KEY];
  const copyHero = state.checks[COPY_HERO_KEY];

  // Follow the conversation as it grows, unless the visitor has scrolled up to read an earlier result.
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = true;
    const follow = () => stick.current && el.scrollTo({ top: el.scrollHeight });
    const onScroll = () => {
      stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    };
    follow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(follow);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [items.length, state.thread, hero?.status, copyHero?.status]);

  // What the thread's results are about: a message naming anything else gets a thread of its own.
  const subjects = threadSubjects(state);
  const hasResult = subjects.size > 0;
  // One live answer at a time in a thread: the box waits while the agent works.
  const busy = items.some((m) => m.kind === "check" && state.checks[m.key]?.mode === "live" && state.checks[m.key]?.status === "running");

  /** The same message sent again in this thread, while its result is running or fresh: point at it instead. */
  function repeatOf(text: string) {
    const said = text.trim().toLowerCase();
    for (let i = items.length - 1; i >= 0; i--) {
      const m = items[i];
      const next = items[i + 1];
      if (m.kind !== "user" || m.text.trim().toLowerCase() !== said || next?.kind !== "check") continue;
      const c = state.checks[next.key];
      if (c && (c.status === "running" || (c.status === "done" && Date.now() - (c.at ?? 0) < COPY_FRESH_MS))) return c;
    }
    return undefined;
  }

  async function attach(kind: Attachment["kind"], file: File | undefined) {
    setAttachError(null);
    if (!file) return;
    if (kind === "video" && file.type !== "video/mp4") return setAttachError("Clips must be mp4.");
    if (kind === "image" && !file.type.startsWith("image/")) return setAttachError("That isn't an image.");
    if (file.size > LIMITS[kind]) return setAttachError(kind === "video" ? "Clips can be up to 25 MB." : "Screenshots can be up to 8 MB.");
    setAttachment({ kind, name: file.name, dataUrl: await readAsDataUrl(file) });
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = state.draft.trim();
    if ((!text && !attachment) || sending || busy) return;
    const repeat = !attachment && repeatOf(text);
    if (repeat) {
      const tab = tabOf(repeat);
      const opens = isCopyRun(repeat) || !!answerOf(repeat.run)?.check;
      if (opens) dispatch({ type: "open", id: tab });
      return dispatch({
        type: "send",
        reply: {
          kind: "text",
          text:
            repeat.status === "running"
              ? "That's the same as your message above, and it's still running there."
              : `That's the same as your message above, so its result stands: it ran ${minutesAgo(repeat.at ?? Date.now())}.${opens ? " It's open in the editor." : ""} Change a value to run another.`,
        },
      });
    }
    // A clip or screenshot is a token to check, so with a result here already it starts a thread of its own.
    if (attachment && backend === "online") {
      dispatch({ type: "send", reply: { kind: "live", attachment }, fresh: hasResult });
      setAttachment(null);
      return;
    }
    const match = savedCopyMatch(text, state.savedCopies) ?? savedMatch(text, state.saved);
    const matchSubject = match && ("wallet" in match ? match.wallet : match.mint);
    const named = [...(text.match(ADDRESS) ?? []), ...(matchSubject ? [matchSubject] : [])];
    const fresh = hasResult && named.some((n) => !subjects.has(n));
    // A saved wallet or token not already here replays; a question about what's here is a follow-up.
    if (match && matchSubject && !subjects.has(matchSubject)) {
      setSending(true);
      try {
        const run = await loadRun(match.id);
        dispatch({ type: "send", reply: { kind: "replay", run }, fresh });
      } finally {
        setSending(false);
      }
      return;
    }
    if (backend === "online") return dispatch({ type: "send", reply: { kind: "live" }, fresh });
    const soon = hasResult && !fresh ? FOLLOW_UP_SOON : state.workTab === "Copy trade" ? copySoon(state.savedCopies) : LIVE_SOON;
    dispatch({ type: "send", reply: { kind: "text", text: soon }, fresh });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const copyWallet = state.savedCopies[0];
  const suggestions: Record<WorkTab, string[]> = {
    Analyze: state.saved.slice(0, 3).map((r, i) => (i === 0 ? `is this a rug? pump.fun/coin/${r.mint}` : `Check $${r.symbol}`)),
    // Offline only the saved backtest can answer, so only its own question is offered.
    "Copy trade": copyWallet
      ? [
          copyWallet.message,
          ...(backend === "online" ? [`If I copied pump.fun/profile/${copyWallet.wallet} 10 seconds after they buy and sell, what would I make?`] : []),
        ]
      : [],
  };

  return (
    <aside className="thread" aria-label="Agent thread" data-tour="thread">
      <div className="pane-head">
        <span className="pane-head__title thread__title" title={threadTitle(state)}>
          {threadTitle(state)}
        </span>
        <div className="pane-head__tools">
          <button className="icon-btn icon-btn--sm" title="New thread" aria-label="New thread" onClick={() => dispatch({ type: "newThread" })}>
            <Plus size={16} aria-hidden />
          </button>
          <ThreadHistory />
          <button className="icon-btn icon-btn--sm pane-hide" title="Hide the thread" aria-label="Hide the thread" onClick={() => dispatch({ type: "pane", pane: "thread", open: false })}>
            <PanelRightClose size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div className="thread__scroll" ref={scrollRef} role="log" aria-label="Messages">
        {state.thread === "rug" && hero && <Example checkKey={HERO_KEY} tour />}
        {state.thread === "copy" && copyHero && <Example checkKey={COPY_HERO_KEY} />}
        {user && items.length === 0 && (
          <div className="thread__start">
            <p className="thread__hello">{starts[state.workTab].hello}</p>
            <p className="thread__sub">{starts[state.workTab].sub}</p>
            <ul className="suggest">
              {suggestions[state.workTab].map((s) => (
                <li key={s}>
                  <button onClick={() => dispatch({ type: "draft", text: s })}>{s}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {items.map((m, i) =>
          m.kind === "check" ? (
            <ThreadCheck key={i} checkKey={m.key} />
          ) : (
            <div key={i} className={`msg msg--${m.kind}`}>
              {m.kind === "user" && m.attached && (
                <span className="clip-chip">
                  <Paperclip size={13} aria-hidden />
                  <span className="mono">{m.attached}</span>
                </span>
              )}
              <p>{m.text}</p>
            </div>
          ),
        )}
      </div>

      <form className="composer" onSubmit={send} data-tour="composer">
        <label htmlFor="composer-input" className="sr-only">
          Message the agent
        </label>
        <textarea
          id="composer-input"
          name="message"
          rows={3}
          autoComplete="off"
          value={state.draft}
          onChange={(e) => dispatch({ type: "draft", text: e.target.value })}
          onKeyDown={onKey}
          placeholder={hasResult ? "Ask about this result, or paste another token or wallet…" : placeholders[state.workTab]}
        />
        {attachment && (
          <span className="clip-chip">
            <Paperclip size={13} aria-hidden />
            <span className="mono">{attachment.name}</span>
            <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachment(null)}>
              <X size={13} aria-hidden />
            </button>
          </span>
        )}
        {attachError && (
          <p className="thread__error" role="alert">
            <AlertTriangle size={14} aria-hidden />
            {attachError}
          </p>
        )}
        <input ref={clipInput} type="file" accept="video/mp4" hidden onChange={(e) => void attach("video", e.target.files?.[0])} />
        <input ref={imageInput} type="file" accept="image/*" hidden onChange={(e) => void attach("image", e.target.files?.[0])} />
        <div className="composer__bar">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title={canAttach ? "Attach a clip (mp4, up to 25 MB)" : "Attach a clip (needs the live backend)"}
            aria-label={canAttach ? "Attach a clip" : "Attach a clip (needs the live backend)"}
            disabled={!canAttach}
            onClick={() => clipInput.current?.click()}
          >
            <Paperclip size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title={canAttach ? "Add a screenshot (up to 8 MB)" : "Add a screenshot (needs the live backend)"}
            aria-label={canAttach ? "Add a screenshot" : "Add a screenshot (needs the live backend)"}
            disabled={!canAttach}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus size={15} aria-hidden />
          </button>
          <span className="composer__model" title="The model that runs the agent">
            Muse Spark 1.3
          </span>
          <button
            type="submit"
            className="send"
            aria-label={busy ? "Send (waiting for the answer above)" : "Send"}
            title={busy ? "Waiting for the answer above" : undefined}
            disabled={(!state.draft.trim() && !attachment) || sending || busy}
          >
            <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
      <p className="thread__note">
        {backend === "checking"
          ? "Looking for the backend…"
          : hasResult
            ? backend === "online"
              ? "Ask about this result; the agent answers from the data already pulled. Another token or wallet opens a new thread."
              : "Questions about a result need the live agent, coming soon. Another token or wallet opens a new thread."
            : state.workTab === "Copy trade"
            ? backend === "online"
              ? "Live: any pump.fun wallet is backtested from the chain now. The saved one replays."
              : "Live backtests are coming soon. The saved one replays."
            : backend === "online"
              ? "Live: any pump.fun token is checked from the chain now. Saved checks replay."
              : "Live checks are coming soon. Saved checks replay."}
      </p>
    </aside>
  );
}

/** "Thinking", and how long the agent has been at it, until its first step shows. */
function Thinking({ since }: { since: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <p className="thread__tag thread__thinking" role="status">
      <span>
        Thinking
        <span className="thinking-dots" aria-hidden>
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
      <span className="num">{s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`}</span>
    </p>
  );
}

/** A backtest run from its form, in its chat: what it's doing, and a way to its tab. */
function FormRun({ checkKey }: { checkKey: string }) {
  const { state, dispatch } = useIde();
  const c = state.checks[checkKey];
  if (!c) return null;
  return (
    <div className="thread__run">
      <p className="thread__tag">
        {c.status === "error" ? "The backtest stopped." : c.copy ? "Backtested. Ask anything about the result." : c.status === "running" ? "Backtesting in the editor…" : "No result came back."}
      </p>
      {c.status === "error" && c.error && (
        <p className="thread__error" role="alert">
          <AlertTriangle size={14} aria-hidden />
          {c.error}
        </p>
      )}
      <button className="tool-btn" onClick={() => dispatch({ type: "open", id: `copy:${checkKey}` })}>
        Open the backtest
      </button>
    </div>
  );
}

/** One check in a thread: the agent's steps as they happen, then its answer and a way to the full check. */
function ThreadCheck({ checkKey }: { checkKey: string }) {
  const { state, dispatch } = useIde();
  const check = state.checks[checkKey];
  const cf = useCheckFrame(check, () => dispatch({ type: "finishCheck", key: checkKey }));
  if (check?.via === "copytrade") return <FormRun checkKey={checkKey} />;
  if (!check || !cf) return null;
  const hasCheck = !!cf.answer?.check;
  const copy = isCopyRun(check);
  const notices = check.run.events.filter((e) => e.type === "notice").map((e) => (e.type === "notice" ? e.message : ""));
  return (
    <div className="thread__run">
      {check.mode === "replay" && <p className="thread__tag">{copy ? "Saved backtest, replayed" : "Saved check, replayed"}</p>}
      {notices.map((n, i) => (
        <p key={i} className="thread__tag">
          {n}
        </p>
      ))}
      <RunSteps frame={cf.frame} words={cf.words} answer={cf.answer} />
      {cf.answer && cf.answer.explained_by === null && cf.frame.audited && (
        <p className="thread__tag">The agent is off, so this answer is the check’s own findings.</p>
      )}
      {check.status === "running" && cf.frame.steps.length === 0 && !cf.answer && <Thinking since={check.startedAt} />}
      {cf.finished && !hasCheck && findFailure(cf.frame) && <CheckHelp failure={findFailure(cf.frame)!} />}
      {check.status === "error" && (
        <p className="thread__error" role="alert">
          <AlertTriangle size={14} aria-hidden />
          {check.error}
        </p>
      )}
      {cf.finished && hasCheck && (
        <button className="tool-btn" onClick={() => dispatch({ type: "open", id: `check:${checkKey}` })}>
          Open the check
        </button>
      )}
      {cf.finished && cf.answer?.copy_trade && (
        <button className="tool-btn" onClick={() => dispatch({ type: "open", id: `copy:${checkKey}` })}>
          Open the backtest
        </button>
      )}
    </div>
  );
}

/** An example thread: the lead saved check, replayed during the tour, or the saved copy-trade backtest. It plays only
 * when asked. */
function Example({ checkKey, tour }: { checkKey: string; tour?: boolean }) {
  const { state, dispatch } = useIde();
  const run = state.checks[checkKey];
  return (
    <>
      <div className="msg msg--user" data-tour={tour ? "ask" : undefined}>
        <p>{run.run.message}</p>
      </div>
      {run.status === "waiting" ? (
        <div className="thread__run">
          <p className="thread__tag">A saved {checkKey === COPY_HERO_KEY ? "backtest" : "check"}. It replays when you ask; nothing runs live.</p>
          <button className="tool-btn" onClick={() => dispatch({ type: "playExample", key: checkKey })}>
            <Play size={12} aria-hidden fill="currentColor" />
            Replay it
          </button>
        </div>
      ) : (
        <ThreadCheck checkKey={checkKey} />
      )}
    </>
  );
}

function ThreadHistory() {
  const { state, dispatch } = useIde();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const items: { ref: ThreadRef; title: string; note: string }[] = [
    ...(state.checks[COPY_HERO_KEY] ? [{ ref: "copy" as ThreadRef, title: exampleThreadTitle.copy, note: "Example" }] : []),
    { ref: "rug" as ThreadRef, title: exampleThreadTitle.rug, note: "Example" },
    ...state.threads
      .filter((t) => t.items.length > 0 || t.id === state.thread)
      .map((t) => {
        const sent = t.items.filter((m) => m.kind === "user").length;
        return { ref: t.id, title: t.title || "New thread", note: sent === 1 ? "1 message" : `${sent} messages` };
      }),
  ].reverse();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="history" ref={wrap}>
      <button
        ref={button}
        className="icon-btn icon-btn--sm"
        title="Thread history"
        aria-label="Thread history"
        aria-expanded={open}
        aria-controls="thread-history"
        onClick={() => setOpen((v) => !v)}
      >
        <History size={15} aria-hidden />
      </button>
      {open && (
        <div id="thread-history" className="history__list" role="region" aria-label="Threads in this session">
          <p className="history__head">This session</p>
          <ul>
            {items.map((t) => (
              <li key={String(t.ref)}>
                <button
                  aria-current={state.thread === t.ref ? "true" : undefined}
                  onClick={() => {
                    dispatch({ type: "selectThread", thread: t.ref });
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  <span className="history__title">{t.title}</span>
                  <span className="history__note">{t.note}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="history__foot">Threads aren’t saved after you leave this preview.</p>
        </div>
      )}
    </div>
  );
}

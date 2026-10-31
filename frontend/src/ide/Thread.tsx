import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, CircleCheck, History, ImagePlus, Paperclip, Plus } from "lucide-react";
import { rsiThread, type ThreadStep } from "../data/examples";
import { clearTourDone, threadTitle, useIde, type ThreadRef, type WorkTab } from "./state";

const suggestions: Record<WorkTab, string[]> = {
  Backtest: [
    "Buy BTC when RSI closes below 30, sell above 70",
    "Compare QQQ with the S&P 500 over 10 years",
    "Code the strategy in this clip",
  ],
  Analyze: ["Research AAPL", "Is this coin legit? 7xKX…9fQe", "Check the claims in this clip"],
};

const placeholders: Record<WorkTab, string> = {
  Backtest: "Describe a strategy, or drop in a screenshot or clip…",
  Analyze: "Name a stock or coin, or drop in a clip…",
};

export function Thread() {
  const { state, dispatch } = useIde();
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = typeof state.thread === "number" ? state.threads.find((t) => t.id === state.thread) : undefined;
  const messages = user?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.revealed, state.replayed, state.edit, messages.length, state.thread]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    dispatch({ type: "send" });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <aside className="thread" aria-label="Agent thread" data-tour="thread">
      <div className="pane-head">
        <span className="pane-head__title thread__title" title={threadTitle(state)}>
          {threadTitle(state)}
        </span>
        <div className="pane-head__tools">
          <button
            className={`toggle ${state.autoAccept ? "is-on" : ""}`}
            aria-pressed={state.autoAccept}
            onClick={() => dispatch({ type: "autoAccept", on: !state.autoAccept })}
            title="Apply the agent's edits without asking"
          >
            <span className="toggle__track" aria-hidden>
              <span className="toggle__dot" />
            </span>
            Auto-accept
          </button>
          <button
            className="icon-btn icon-btn--sm"
            title="New thread"
            aria-label="New thread"
            onClick={() => dispatch({ type: "newThread" })}
          >
            <Plus size={16} aria-hidden />
          </button>
          <ThreadHistory />
        </div>
      </div>

      <div className="thread__scroll" ref={scrollRef} role="log" aria-label="Messages">
        {state.thread === "example" && <DemoConversation />}

        {user && messages.length === 0 && (
          <div className="thread__start">
            <p className="thread__hello">{state.workTab === "Backtest" ? "What do you want to test?" : "What do you want to check?"}</p>
            <p className="thread__sub">
              {state.workTab === "Backtest"
                ? "Describe a strategy, or drop in a chart screenshot or a short clip."
                : "Name a stock or coin, or drop in a clip with a pitch to check."}
            </p>
            <ul className="suggest">
              {suggestions[state.workTab].map((s) => (
                <li key={s}>
                  <button onClick={() => dispatch({ type: "draft", text: s })}>{s}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg msg--${m.kind}`}>
            <p>{m.text}</p>
          </div>
        ))}
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
          placeholder={placeholders[state.workTab]}
        />
        <div className="composer__bar">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="Attach a clip (coming soon)"
            aria-label="Attach a clip (coming soon)"
            disabled
          >
            <Paperclip size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="Add a screenshot (coming soon)"
            aria-label="Add a screenshot (coming soon)"
            disabled
          >
            <ImagePlus size={15} aria-hidden />
          </button>
          <span className="composer__model" title="The model that runs the agent">
            Muse Spark 1.3
          </span>
          <button type="submit" className="send" aria-label="Send" disabled={!state.draft.trim()}>
            <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
    </aside>
  );
}

function ThreadHistory() {
  const { state, dispatch } = useIde();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items: { ref: ThreadRef; title: string; note: string }[] = [
    { ref: "example" as ThreadRef, title: "Code the strategy in this clip", note: "Example" },
    ...state.threads
      .filter((t) => t.messages.length > 0 || t.id === state.thread)
      .map((t) => {
        const sent = t.messages.filter((m) => m.kind === "user").length;
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
          <p className="history__foot">Threads aren't saved after you leave this preview.</p>
        </div>
      )}
    </div>
  );
}

function DemoConversation() {
  const { state, dispatch } = useIde();
  const steps = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : []));
  const user = rsiThread.find((m) => m.kind === "user");
  const agent = rsiThread.find((m) => m.kind === "agent");
  const shown = steps.slice(0, state.revealed);
  const working = state.replaying && !state.awaitingEdit && state.revealed < steps.length;

  return (
    <>
      {user && user.kind === "user" && (
        <div className="msg msg--user" data-tour="ask">
          {user.clip && (
            <button className="clip-chip" onClick={() => dispatch({ type: "open", id: "clip" })}>
              <Paperclip size={13} aria-hidden />
              <span className="mono">
                {user.clip.name} · {user.clip.length}
              </span>
            </button>
          )}
          <p>{user.text}</p>
        </div>
      )}

      {shown.length > 0 && (
        <ol className="steps" aria-label="Agent steps">
          {shown.map((s) => (
            <Step key={s.id} step={s} />
          ))}
          {working && <li className="steps__working">Working…</li>}
        </ol>
      )}

      {state.edit === "rejected" && (
        <div className="msg msg--agent">
          <p>Stopped. You rejected rsi_dip.pine, so nothing was run.</p>
          <button
            className="tool-btn"
            onClick={() => {
              clearTourDone();
              dispatch({ type: "restartTour" });
            }}
          >
            Start the example again
          </button>
        </div>
      )}

      {state.replayed && agent && agent.kind === "agent" && (
        <div className="msg msg--agent">
          <p>{agent.text}</p>
          {agent.audited && (
            <p className="msg__audit">
              <CircleCheck size={13} aria-hidden /> Numbers checked against the run
            </p>
          )}
          <button className="tool-btn" onClick={() => dispatch({ type: "open", id: "results:rsi" })}>
            Open the results
          </button>
        </div>
      )}
    </>
  );
}

function Step({ step }: { step: ThreadStep }) {
  const { state, dispatch } = useIde();
  const wrote = step.text.startsWith("Wrote");
  return (
    <li className="step">
      <Check size={14} strokeWidth={3} className="step__tick" aria-hidden />
      <div className="step__body">
        <p className="step__text">
          {step.text}
          {step.meta && <span className="step__meta">{step.meta}</span>}
        </p>
        {step.detail && <p className="step__detail">{step.detail}</p>}
        {step.rules && (
          <ul className="step__rules">
            {step.rules.map((r) => (
              <li key={r.text}>
                <span>{r.text}</span>
                <button
                  className="at"
                  title="Open the clip at this moment"
                  aria-label={`Open the clip at ${r.at}`}
                  onClick={() => dispatch({ type: "open", id: "clip" })}
                >
                  {r.at}
                </button>
              </li>
            ))}
          </ul>
        )}
        {step.diff && (
          <pre className="diff" aria-label="Changes">
            {step.diff.minus.map((l) => (
              <span key={`-${l}`} className="diff__minus">
                - {l}
                {"\n"}
              </span>
            ))}
            {step.diff.plus.map((l) => (
              <span key={`+${l}`} className="diff__plus">
                + {l}
                {"\n"}
              </span>
            ))}
          </pre>
        )}
        {wrote && (
          <div className="edit-card">
            <span className="mono">rsi_dip.pine</span>
            <span className="edit-card__count">+33 lines</span>
            {state.awaitingEdit ? (
              <span className="edit-card__actions">
                <button className="tool-btn tool-btn--solid" onClick={() => dispatch({ type: "acceptEdit" })}>
                  Accept
                </button>
                <button className="tool-btn" onClick={() => dispatch({ type: "rejectEdit" })}>
                  Reject
                </button>
              </span>
            ) : (
              <span className={`edit-card__state ${state.edit === "rejected" ? "is-rejected" : ""}`}>
                {state.edit === "rejected" ? "Rejected" : "Accepted"}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

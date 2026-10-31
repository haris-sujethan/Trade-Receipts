import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, CircleCheck, History, ImagePlus, Paperclip, Plus } from "lucide-react";
import { projectFiles, rsiThread, rugThread, type ThreadMessage, type ThreadStep } from "../data/examples";
import { clearTourDone, exampleThreadTitle, threadTitle, useIde, type ThreadRef, type WorkTab } from "./state";

const suggestions: Record<WorkTab, string[]> = {
  Backtest: [
    "Buy BTC when RSI closes below 30, sell above 70",
    "Compare this strategy with holding ETH since 2021",
    "Code the strategy in this clip",
  ],
  Analyze: ["Is this token legit? 7xKX…gAsU", "Who holds this token?", "Check the claims in this clip"],
};

const placeholders: Record<WorkTab, string> = {
  Backtest: "Describe a crypto strategy, or drop in a screenshot or clip…",
  Analyze: "Paste a token's mint, or drop in the clip shilling it…",
};

type Example = "rug" | "backtest";

const examples: Record<Example, { messages: ThreadMessage[]; clipId: string; opens: string; openLabel: string }> = {
  rug: { messages: rugThread, clipId: "moonclip", opens: "moon", openLabel: "Open the report" },
  backtest: { messages: rsiThread, clipId: "clip", opens: "results:rsi", openLabel: "Open the results" },
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
        {typeof state.thread !== "number" && <ExampleConversation which={state.thread} />}

        {user && messages.length === 0 && (
          <div className="thread__start">
            <p className="thread__hello">{state.workTab === "Backtest" ? "What do you want to test?" : "What do you want to check?"}</p>
            <p className="thread__sub">
              {state.workTab === "Backtest"
                ? "Describe a strategy, or drop in a chart screenshot or a short clip."
                : "Paste a token's mint, or drop in the clip shilling it."}
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
    { ref: "backtest" as ThreadRef, title: exampleThreadTitle.backtest, note: "Example" },
    { ref: "rug" as ThreadRef, title: exampleThreadTitle.rug, note: "Example" },
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

/** An example thread. The rug check replays step by step during the tour; the backtest is already finished. */
function ExampleConversation({ which }: { which: Example }) {
  const { state, dispatch } = useIde();
  const ex = examples[which];
  const replayed = which === "rug";
  const steps = ex.messages.flatMap((m) => (m.kind === "steps" ? m.steps : []));
  const user = ex.messages.find((m) => m.kind === "user");
  const agent = ex.messages.find((m) => m.kind === "agent");
  const shown = replayed ? steps.slice(0, state.revealed) : steps;
  const working = replayed && state.replaying && !state.awaitingEdit && state.revealed < steps.length;
  const finished = replayed ? state.replayed : true;

  return (
    <>
      {user && user.kind === "user" && (
        <div className="msg msg--user" data-tour={replayed ? "ask" : undefined}>
          {user.clip && (
            <button className="clip-chip" onClick={() => dispatch({ type: "open", id: ex.clipId })}>
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
            <Step key={s.id} step={s} clipId={ex.clipId} live={replayed} />
          ))}
          {working && <li className="steps__working">Working…</li>}
        </ol>
      )}

      {replayed && state.edit === "rejected" && (
        <div className="msg msg--agent">
          <p>Stopped. You rejected the report, so the token wasn't scored.</p>
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

      {finished && agent && agent.kind === "agent" && (
        <div className="msg msg--agent">
          <p>{agent.text}</p>
          {agent.audited && (
            <p className="msg__audit">
              <CircleCheck size={13} aria-hidden /> Numbers checked against the {which === "rug" ? "check" : "run"}
            </p>
          )}
          <button className="tool-btn" onClick={() => dispatch({ type: "open", id: ex.opens })}>
            {ex.openLabel}
          </button>
        </div>
      )}
    </>
  );
}

/** One agent step. `live` steps belong to the replay, so their edit can still wait for Accept or Reject. */
function Step({ step, clipId, live }: { step: ThreadStep; clipId: string; live: boolean }) {
  const { state, dispatch } = useIde();
  const wrote = step.text.startsWith("Wrote");
  const writtenName = wrote ? step.text.split("/").pop()! : "";
  const written = projectFiles.find((f) => f.name === writtenName);
  const lines = written ? written.content.split("\n").length : 0;
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
                  onClick={() => dispatch({ type: "open", id: clipId })}
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
            <span className="mono">{writtenName}</span>
            <span className="edit-card__count">+{lines} lines</span>
            {live && state.awaitingEdit ? (
              <span className="edit-card__actions">
                <button className="tool-btn tool-btn--solid" onClick={() => dispatch({ type: "acceptEdit" })}>
                  Accept
                </button>
                <button className="tool-btn" onClick={() => dispatch({ type: "rejectEdit" })}>
                  Reject
                </button>
              </span>
            ) : (
              <span className={`edit-card__state ${live && state.edit === "rejected" ? "is-rejected" : ""}`}>
                {live && state.edit === "rejected" ? "Rejected" : "Accepted"}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

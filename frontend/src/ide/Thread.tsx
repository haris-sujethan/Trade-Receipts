import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, CircleCheck, History, ImagePlus, Paperclip, Plus } from "lucide-react";
import { rsiThread, type ThreadStep } from "../data/examples";
import { useIde } from "./state";

const suggestions = [
  "Code the strategy in this clip",
  "Compare QQQ with the S&P 500 over 10 years",
  "Research AAPL",
];

type LocalMessage = { kind: "user" | "agent"; text: string };

export function Thread() {
  const { state, dispatch } = useIde();
  const [autoAccept, setAutoAccept] = useState(true);
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const demo = state.mode === "demo";

  useEffect(() => {
    setLocal([]);
  }, [state.mode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.revealed, state.replayed, local.length]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = state.draft.trim();
    if (!text) return;
    setLocal((m) => [
      ...m,
      { kind: "user", text },
      {
        kind: "agent",
        text: "This preview runs on example data, so I can't run new strategies yet. Open a file in the Examples folder to see a complete run.",
      },
    ]);
    dispatch({ type: "draft", text: "" });
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
        <span className="pane-head__title">Thread</span>
        <div className="pane-head__tools">
          <button
            className={`toggle ${autoAccept ? "is-on" : ""}`}
            aria-pressed={autoAccept}
            onClick={() => setAutoAccept((v) => !v)}
            title="Apply the agent's edits without asking"
          >
            <span className="toggle__track" aria-hidden>
              <span className="toggle__dot" />
            </span>
            Auto-accept
          </button>
          <button className="icon-btn icon-btn--sm" title="New thread" aria-label="New thread">
            <Plus size={16} />
          </button>
          <button className="icon-btn icon-btn--sm" title="Thread history" aria-label="Thread history">
            <History size={15} />
          </button>
        </div>
      </div>

      <div className="thread__scroll" ref={scrollRef} aria-live="polite">
        {demo && <DemoConversation autoAccept={autoAccept} />}

        {!demo && local.length === 0 && (
          <div className="thread__start">
            <p className="thread__hello">What do you want to test?</p>
            <p className="thread__sub">Describe a strategy, drop in a chart screenshot, or a short clip.</p>
            <ul className="suggest">
              {suggestions.map((s) => (
                <li key={s}>
                  <button onClick={() => dispatch({ type: "draft", text: s })}>{s}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {local.map((m, i) =>
          m.kind === "user" ? (
            <div key={i} className="msg msg--user">
              <p>{m.text}</p>
            </div>
          ) : (
            <div key={i} className="msg msg--agent">
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
          rows={3}
          value={state.draft}
          onChange={(e) => dispatch({ type: "draft", text: e.target.value })}
          onKeyDown={onKey}
          placeholder="Describe a strategy, or drop in a screenshot or clip"
        />
        <div className="composer__bar">
          <button type="button" className="icon-btn icon-btn--sm" title="Attach a clip" aria-label="Attach a clip">
            <Paperclip size={15} />
          </button>
          <button type="button" className="icon-btn icon-btn--sm" title="Add a screenshot" aria-label="Add a screenshot">
            <ImagePlus size={15} />
          </button>
          <span className="composer__model" title="The model that runs the agent">
            Muse Spark 1.3
          </span>
          <button type="submit" className="send" aria-label="Send" disabled={!state.draft.trim()}>
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </aside>
  );
}

function DemoConversation({ autoAccept }: { autoAccept: boolean }) {
  const { state, dispatch } = useIde();
  const steps = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : []));
  const user = rsiThread.find((m) => m.kind === "user");
  const agent = rsiThread.find((m) => m.kind === "agent");
  const shown = steps.slice(0, state.revealed);

  return (
    <>
      {user && user.kind === "user" && (
        <div className="msg msg--user">
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
        <ol className="steps">
          {shown.map((s) => (
            <Step key={s.id} step={s} autoAccept={autoAccept} />
          ))}
          {state.replaying && state.revealed < steps.length && <li className="steps__working">Working…</li>}
        </ol>
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
            Open Results
          </button>
        </div>
      )}
    </>
  );
}

function Step({ step, autoAccept }: { step: ThreadStep; autoAccept: boolean }) {
  const { dispatch } = useIde();
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
                  title="Jump to this moment in the clip"
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
            {autoAccept ? (
              <span className="edit-card__state">Accepted</span>
            ) : (
              <span className="edit-card__actions">
                <button className="tool-btn">Accept</button>
                <button className="tool-btn">Reject</button>
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

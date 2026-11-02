import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowUp, Check, ImagePlus, Paperclip, Plus, History } from "lucide-react";
import { projectFiles, rsiThread, type ThreadStep } from "../data/examples";
import { RunSteps } from "../demo/CheckViews";
import { loadRun } from "../demo/runs";
import { useBackend, useCheckFrame } from "./live";
import { BACKTEST_SOON, exampleThreadTitle, HERO_KEY, LIVE_SOON, savedMatch, threadTitle, useIde, type ThreadRef, type WorkTab } from "./state";
import "../demo/demo.css";

const placeholders: Record<WorkTab, string> = {
  Backtest: "Describe a crypto strategy to test…",
  Analyze: "Paste a pump.fun link, a ticker or a token’s address…",
};

export function Thread() {
  const { state, dispatch } = useIde();
  const backend = useBackend();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const user = typeof state.thread === "number" ? state.threads.find((t) => t.id === state.thread) : undefined;
  const items = user?.items ?? [];
  const hero = state.checks[HERO_KEY];

  // Follow the conversation as it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const follow = () => el.scrollTo({ top: el.scrollHeight });
    follow();
    const ro = new ResizeObserver(follow);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [items.length, state.thread, hero?.status]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = state.draft.trim();
    if (!text || sending) return;
    if (state.workTab === "Backtest") return dispatch({ type: "send", reply: { kind: "text", text: BACKTEST_SOON } });
    const match = savedMatch(text, state.saved);
    if (match) {
      setSending(true);
      try {
        const run = await loadRun(match.id);
        dispatch({ type: "send", reply: { kind: "replay", run } });
      } finally {
        setSending(false);
      }
      return;
    }
    dispatch({ type: "send", reply: backend === "online" ? { kind: "live" } : { kind: "text", text: LIVE_SOON } });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const suggestions: Record<WorkTab, string[]> = {
    Analyze: state.saved.slice(0, 3).map((r, i) => (i === 0 ? `is this a rug? pump.fun/coin/${r.mint}` : `Check $${r.symbol}`)),
    Backtest: ["Buy BTC when RSI closes below 30, sell above 70", "Compare this strategy with holding ETH since 2021"],
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
        </div>
      </div>

      <div className="thread__scroll" ref={scrollRef} role="log" aria-label="Messages">
        {state.thread === "rug" && hero && <RugExample />}
        {state.thread === "backtest" && <BacktestExample />}
        {user && items.length === 0 && (
          <div className="thread__start">
            <p className="thread__hello">{state.workTab === "Backtest" ? "What do you want to test?" : "Which token should I check?"}</p>
            <p className="thread__sub">
              {state.workTab === "Backtest" ? "Describe a crypto strategy in plain words." : "Paste a pump.fun link, a ticker or a token’s address."}
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
        {items.map((m, i) =>
          m.kind === "check" ? (
            <ThreadCheck key={i} checkKey={m.key} />
          ) : (
            <div key={i} className={`msg msg--${m.kind}`}>
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
          placeholder={placeholders[state.workTab]}
        />
        <div className="composer__bar">
          <button type="button" className="icon-btn icon-btn--sm" title="Attach a clip (coming soon)" aria-label="Attach a clip (coming soon)" disabled>
            <Paperclip size={15} aria-hidden />
          </button>
          <button type="button" className="icon-btn icon-btn--sm" title="Add a screenshot (coming soon)" aria-label="Add a screenshot (coming soon)" disabled>
            <ImagePlus size={15} aria-hidden />
          </button>
          <span className="composer__model" title="The model that runs the agent">
            Muse Spark 1.3
          </span>
          <button type="submit" className="send" aria-label="Send" disabled={!state.draft.trim() || sending}>
            <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
      {state.workTab === "Analyze" && backend !== "online" && (
        <p className="thread__note">{backend === "checking" ? "Looking for the backend…" : "Live checks are coming soon. Saved checks replay."}</p>
      )}
    </aside>
  );
}

/** One check in a thread: the agent's steps as they happen, then its answer and a way to the full check. */
function ThreadCheck({ checkKey }: { checkKey: string }) {
  const { state, dispatch } = useIde();
  const check = state.checks[checkKey];
  const cf = useCheckFrame(check, () => dispatch({ type: "finishCheck", key: checkKey }));
  if (!check || !cf) return null;
  const hasCheck = !!cf.answer?.check;
  return (
    <div className="thread__run">
      {check.mode === "replay" && <p className="thread__tag">Saved check, replayed</p>}
      <RunSteps frame={cf.frame} words={cf.words} answer={cf.answer} />
      {check.status === "running" && cf.frame.steps.length === 0 && <p className="thread__tag">Starting…</p>}
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
    </div>
  );
}

/** The example rug check: the lead saved check, replayed during the tour. */
function RugExample() {
  const { state } = useIde();
  const hero = state.checks[HERO_KEY];
  return (
    <>
      <div className="msg msg--user" data-tour="ask">
        <p>{hero.run.message}</p>
      </div>
      {hero.status !== "waiting" && <ThreadCheck checkKey={HERO_KEY} />}
    </>
  );
}

/** The example backtest: a strategy from a clip, coded and tested. It's already finished. */
function BacktestExample() {
  const { dispatch } = useIde();
  const steps = rsiThread.flatMap((m) => (m.kind === "steps" ? m.steps : []));
  const user = rsiThread.find((m) => m.kind === "user");
  const agent = rsiThread.find((m) => m.kind === "agent");
  return (
    <>
      {user && user.kind === "user" && (
        <div className="msg msg--user">
          {user.clip && (
            <button className="clip-chip" onClick={() => dispatch({ type: "open", id: "clip" })}>
              <Paperclip size={13} aria-hidden />
              <span className="mono">
                {user.clip.name}, {user.clip.length}
              </span>
            </button>
          )}
          <p>{user.text}</p>
        </div>
      )}
      <ol className="steps-ex" aria-label="Agent steps">
        {steps.map((s) => (
          <Step key={s.id} step={s} />
        ))}
      </ol>
      {agent && agent.kind === "agent" && (
        <div className="msg msg--agent">
          <p>{agent.text}</p>
          {agent.audited && (
            <p className="msg__audit">
              <Check size={13} aria-hidden /> Numbers checked against the run
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

/** One step of the example backtest. */
function Step({ step }: { step: ThreadStep }) {
  const { dispatch } = useIde();
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
                <button className="at" title="Open the clip at this moment" aria-label={`Open the clip at ${r.at}`} onClick={() => dispatch({ type: "open", id: "clip" })}>
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
            <span className="edit-card__state">Accepted</span>
          </div>
        )}
      </div>
    </li>
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

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, Settings, Share2 } from "lucide-react";
import { APP_NAME } from "../config";
import { useBackend } from "./live";
import { clearTourDone, useIde, type WorkTab } from "./state";

const workTabs: WorkTab[] = ["Backtest", "Analyze"];

export function TopBar() {
  const { state, dispatch } = useIde();

  return (
    <header className="topbar">
      <Link to="/" className="topbar__mark" aria-label={`${APP_NAME} home`}>
        {APP_NAME}
      </Link>

      <div className="topbar__tabs" role="group" aria-label="Mode" data-tour="worktabs">
        {workTabs.map((t) => (
          <button
            key={t}
            className={state.workTab === t ? "is-on" : ""}
            aria-pressed={state.workTab === t}
            onClick={() => dispatch({ type: "workTab", tab: t })}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="topbar__tools">
        <PreviewNote />
        <button
          className="icon-btn topbar__wide"
          title="Replay the tour"
          aria-label="Replay the tour"
          onClick={() => {
            clearTourDone();
            dispatch({ type: "restartTour" });
          }}
        >
          <CircleHelp size={17} aria-hidden />
        </button>
        <button className="icon-btn topbar__wide" title="Share (coming soon)" aria-label="Share (coming soon)" disabled>
          <Share2 size={17} aria-hidden />
        </button>
        <button className="icon-btn topbar__wide" title="Settings (coming soon)" aria-label="Settings (coming soon)" disabled>
          <Settings size={17} aria-hidden />
        </button>
        <span className="topbar__guest topbar__wide" title="You're using the preview without an account">
          Guest
        </span>
      </div>
    </header>
  );
}

/** Says plainly what this preview can and can't do yet. */
function PreviewNote() {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
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
    <div className="preview" ref={wrap}>
      <button
        ref={button}
        className="preview__chip"
        aria-expanded={open}
        aria-controls="preview-note"
        onClick={() => setOpen((v) => !v)}
      >
        {backend === "online" ? "Live" : "Preview"}
        <span className="preview__more">{backend === "online" ? ", backend connected" : ", saved checks"}</span>
      </button>
      {open && (
        <div id="preview-note" className="preview__note" role="region" aria-label="About this preview">
          <p className="preview__title">{backend === "online" ? "Connected to the backend" : "This preview replays saved checks"}</p>
          <p className="preview__head">Works now</p>
          <ul>
            <li>Six saved rug checks of real pump.fun tokens, each 15 minutes after launch, replayed step by step</li>
            <li>Their chart, holders and every signal, with the rug chance and a second opinion</li>
            <li>An example backtest, with its code and results (example values)</li>
            {backend === "online" && <li>Live checks: ask about any pump.fun token in the thread</li>}
          </ul>
          <p className="preview__head">Coming next</p>
          <ul>
            {backend !== "online" && <li>Live checks on any pump.fun token</li>}
            <li>Running your own strategies on real prices</li>
            <li>Attaching clips and screenshots</li>
            <li>Saving your own projects</li>
          </ul>
        </div>
      )}
    </div>
  );
}

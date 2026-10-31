import { Link } from "react-router-dom";
import { CircleHelp, Settings, Share2 } from "lucide-react";
import { APP_NAME } from "../config";
import { clearTourDone, useIde, type WorkTab } from "./state";

const workTabs: WorkTab[] = ["Backtest", "Analyze"];

export function TopBar() {
  const { state, dispatch } = useIde();

  function switchTab(tab: WorkTab) {
    dispatch({ type: "workTab", tab });
    if (tab === "Analyze" && state.mode === "demo") dispatch({ type: "open", id: "acme" });
  }

  return (
    <header className="topbar">
      <Link to="/" className="topbar__mark" aria-label={`${APP_NAME} home`}>
        {APP_NAME}
      </Link>

      <nav className="topbar__tabs" aria-label="Mode" data-tour="worktabs">
        {workTabs.map((t) => (
          <button
            key={t}
            className={state.workTab === t ? "is-on" : ""}
            aria-pressed={state.workTab === t}
            onClick={() => switchTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="topbar__tools">
        <button
          className="icon-btn"
          title="Replay the tour"
          aria-label="Replay the tour"
          onClick={() => {
            clearTourDone();
            dispatch({ type: "restartDemo" });
          }}
        >
          <CircleHelp size={17} />
        </button>
        <button className="icon-btn" title="Share (coming soon)" aria-label="Share (coming soon)" disabled>
          <Share2 size={17} />
        </button>
        <button className="icon-btn" title="Settings (coming soon)" aria-label="Settings (coming soon)" disabled>
          <Settings size={17} />
        </button>
        <span className="topbar__guest" title="Guest: projects are saved in this browser">
          Guest
        </span>
      </div>
    </header>
  );
}

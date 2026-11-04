import { Link } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import { APP_NAME } from "../config";
import { clearTourDone, useIde, type WorkTab } from "./state";

const workTabs: WorkTab[] = ["Analyze", "Copy trade"];

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
        <span className="topbar__guest topbar__wide" title="You're using the preview without an account">
          Guest
        </span>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, CircleHelp, UserRound } from "lucide-react";
import { APP_NAME } from "../config";
import { signOut, useSession } from "../lib/auth";
import { openSettings } from "./Settings";
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
        <Account />
      </div>
    </header>
  );
}

/** The account menu: who's signed in, Settings (the AI key) and signing out. */
function Account() {
  const session = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const email = session?.user.email;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="account" ref={wrap}>
      <button
        className="topbar__guest account__btn"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label="Account and settings"
        onClick={() => setOpen((v) => !v)}
      >
        <UserRound size={14} aria-hidden />
        <span className="account__name">{email ? email.split("@")[0] : "Account"}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div id="account-menu" className="account__menu" role="menu">
          {email && <p className="account__who">{email}</p>}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openSettings();
            }}
          >
            Settings and AI key
          </button>
          {session && (
            <button
              role="menuitem"
              onClick={async () => {
                await signOut();
                navigate("/signup");
              }}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

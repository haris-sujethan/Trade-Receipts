import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import wallpaper from "../assets/home/wallpaper.jpg";
import { onTablistKeyDown } from "../lib/tabs";
import { DemoWindow } from "./DemoWindow";
import { loadRun, loadRuns, type Run, type RunSummary } from "./runs";
import { frameAt, plan as makePlan, type View } from "./timeline";
import "./demo.css";

/** After a check finishes, its result stays up this long before the next token. */
const HOLD_MS = 9000;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The home page's live demo: a Mac desktop with Trade Receipts open, replaying a saved rug check from the user's
 * message to the result. It starts once it's on screen, and moves to the next token when a result has been up a while.
 */
export function DemoScreen() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const [userView, setUserView] = useState<View | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRuns().then(setRuns, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (!runs?.[active]) return;
    let live = true;
    loadRun(runs[active].id).then(
      (r) => {
        if (!live) return;
        setRun(r);
        setT(reducedMotion() ? Number.POSITIVE_INFINITY : 0);
        setUserView(null);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [runs, active]);

  // Play once the screen is mostly in view; pause when it scrolls away.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.35), { threshold: [0, 0.35, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const plan = useMemo(() => (run ? makePlan(run) : null), [run]);
  const playing = !!plan && visible && !paused && t < plan.end;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A tab coming back from the background hands over one long gap; never jump more than a second.
      setT((v) => v + Math.min(1000, now - last));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const finished = !!plan && t >= plan.end;
  useEffect(() => {
    if (!finished || held || paused || !visible || !runs || runs.length < 2 || reducedMotion()) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % runs.length), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [finished, held, paused, visible, runs]);

  const frame = plan && run ? frameAt(plan, run, Math.min(t, plan.end)) : null;
  const view = userView ?? frame?.view ?? null;

  function choose(i: number) {
    setPaused(false);
    if (i === active) {
      setT(reducedMotion() ? Number.POSITIVE_INFINITY : 0);
      setUserView(null);
    } else setActive(i);
  }

  return (
    <div className="demo">
      <div
        ref={frameRef}
        className="mac"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
        }}
      >
        <img className="mac__wall" src={wallpaper} alt="" />
        {runs && runs.length > 0 && (
          <div className="mac__tabs" role="tablist" aria-label="Saved checks" onKeyDown={onTablistKeyDown}>
            {runs.map((r, i) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={i === active}
                aria-controls="demo-window"
                tabIndex={i === active ? 0 : -1}
                className={i === active ? "is-on" : ""}
                onClick={() => choose(i)}
              >
                {r.symbol ?? shortMint(r.mint)}
                {r.clip && <span className="mac__tab-note">from a clip</span>}
              </button>
            ))}
          </div>
        )}

        <div id="demo-window" className="mac__window" role="tabpanel">
          {failed && <p className="mac__empty">The saved checks didn’t load. Launch the IDE to run one live.</p>}
          {!failed && run && plan && frame && <DemoWindow run={run} plan={plan} frame={frame} view={view} onView={setUserView} />}
        </div>
      </div>

      <div className="demo__foot">
        <p>
          A saved check, replayed. Each token launched on May 16, 2026, a day the models never trained on, and was checked
          15 minutes after launch.
        </p>
        {plan && (
          <div className="demo__controls">
            {!finished && (
              <button className="ctl" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play the replay" : "Pause the replay"}>
                {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
                {paused ? "Play" : "Pause"}
              </button>
            )}
            <button className="ctl" onClick={() => choose(active)}>
              <RotateCcw size={15} aria-hidden />
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const shortMint = (m: string) => `${m.slice(0, 4)}…`;

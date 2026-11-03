import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import wallpaper from "../assets/home/wallpaper.jpg";
import { onTablistKeyDown } from "../lib/tabs";
import { DemoWindow } from "./DemoWindow";
import { loadCopyRuns, loadRun, loadRuns, type Run } from "./runs";
import { frameAt, plan as makePlan, type View } from "./timeline";
import "./demo.css";

/** After a check finishes, its result stays up this long before the next token. */
const HOLD_MS = 9000;

/** One example on the desktop: a saved run, its pill's label, and the line under the demo. */
type Slot = { id: string; label: string; about: string };

const CHECK_ABOUT =
  "A saved check, replayed. The token launched on May 16, 2026, a day the models never trained on, and was checked 15 minutes after launch.";

/**
 * The three examples, in order: a rug check (BABYBULL), a copy-trade backtest of a real wallet from pump.fun's
 * leaderboard, and a check that didn't rug (Jim). Any that isn't saved here is left out.
 */
const SLOTS: Slot[] = [
  { id: "8ieFgzKCkQj1eTLjpfSpXGS6vqkxDmYpu3avzWMhpump_900", label: "BABYBULL", about: CHECK_ABOUT },
  {
    id: "copy_GeUnv1jmtviRbR7Gu1JnXSGkUMUgFVBHuEVQVpTaUX1W",
    label: "Copy trade",
    about: "A saved copy-trade backtest, replayed: a wallet from pump.fun’s leaderboard, copied 5 minutes after its buys and 10 after its sells.",
  },
  { id: "BnK8QgRW6BGPbPV2b1tAZgxVwAJvJpEC9xPoQikRpump_900", label: "Jim", about: CHECK_ABOUT },
];

/** People type their question and paste the link: a message that opens with a link shows it pasted at the end. */
function linkLast(message: string) {
  const m = /^(\S*(?:pump\.fun\/|[1-9A-HJ-NP-Za-km-z]{32,44})\S*)\s+(.+)$/s.exec(message.trim());
  return m ? `${m[2]} ${m[1]}` : message;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The home page's live demo: a Mac desktop with Trade Receipts open, replaying a saved rug check from the user's
 * message to the result. It starts once it's on screen, and moves to the next token when a result has been up a while.
 */
export function DemoScreen() {
  const [runs, setRuns] = useState<Slot[] | null>(null);
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
    Promise.all([loadRuns(), loadCopyRuns()]).then(([checks, copies]) => {
      const saved = new Set([...checks.map((r) => r.id), ...copies.map((r) => r.id)]);
      setRuns(SLOTS.filter((s) => saved.has(s.id)));
    }, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (!runs?.[active]) return;
    let live = true;
    loadRun(runs[active].id).then(
      (r) => {
        if (!live) return;
        setRun(r.kind === "copy_trade" ? { ...r, message: linkLast(r.message) } : r);
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

  const frame = plan && run ? frameAt(plan, Math.min(t, plan.end)) : null;
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
          <div className="mac__tabs" role="tablist" aria-label="Saved examples" onKeyDown={onTablistKeyDown}>
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
                {r.label}
              </button>
            ))}
          </div>
        )}

        <div id="demo-window" className="mac__window" role="tabpanel">
          {failed && <p className="mac__empty">The saved examples didn’t load. Launch the IDE to run one live.</p>}
          {!failed && run && plan && frame && <DemoWindow run={run} plan={plan} frame={frame} view={view} onView={setUserView} />}
        </div>
      </div>

      <div className="demo__foot">
        <p>{runs?.[active]?.about ?? CHECK_ABOUT}</p>
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

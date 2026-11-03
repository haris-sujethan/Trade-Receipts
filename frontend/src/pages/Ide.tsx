import { useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { APP_NAME } from "../config";
import { HERO_KEY, IdeProvider, problemsFor, useIde, type Panes } from "../ide/state";
import { TopBar } from "../ide/TopBar";
import { Explorer } from "../ide/Explorer";
import { MainArea } from "../ide/MainArea";
import { BottomPanel } from "../ide/BottomPanel";
import { Thread } from "../ide/Thread";
import { StatusBar } from "../ide/StatusBar";
import { Tour } from "../ide/Tour";
import { useNarrow, useThemeColor } from "../ide/useNarrow";
import { onTablistKeyDown } from "../lib/tabs";
import "../ide/ide.css";

export function Ide() {
  const narrow = useNarrow();
  useThemeColor("#fcfcfc");

  return <IdeProvider>{narrow ? <NarrowIde /> : <WideIde />}</IdeProvider>;
}

/** A side panel that can be hidden: it follows the IDE's state, and dragging it shut (or open) updates the state. */
function useSidePanel(pane: keyof Panes) {
  const { state, dispatch } = useIde();
  const ref = usePanelRef();
  const open = state.panes[pane];
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (open && p.isCollapsed()) p.expand();
    if (!open && !p.isCollapsed()) p.collapse();
  }, [open, ref]);
  const onResize = () => {
    const collapsed = ref.current?.isCollapsed();
    if (collapsed != null && collapsed === latest.current) dispatch({ type: "pane", pane, open: !collapsed });
  };
  return { panelRef: ref, onResize, collapsible: true, collapsedSize: 0 };
}

function WideIde() {
  const { state } = useIde();
  const files = useSidePanel("files");
  const thread = useSidePanel("thread");

  return (
    <div className="theme-glass ide">
      {/* Everything behind the tour is inert while it's open. */}
      <div className="ide__frame" inert={state.tourOpen}>
        <h1 className="sr-only">{APP_NAME} IDE</h1>
        <TopBar />
        <main className="ide__body">
          <Group orientation="horizontal" id="ide-columns">
            <Panel id="explorer" defaultSize={228} minSize={180} maxSize={420} {...files}>
              <Explorer />
            </Panel>
            <Separator className="sep sep--v" aria-label="Resize the file list" />
            <Panel id="center" minSize={420}>
              <Group orientation="vertical" id="ide-center">
                <Panel id="main" minSize={220}>
                  <MainArea />
                </Panel>
                <Separator className="sep sep--h" aria-label="Resize the problems panel" />
                <Panel id="bottom" defaultSize={176} minSize={92} maxSize={420}>
                  <BottomPanel />
                </Panel>
              </Group>
            </Panel>
            <Separator className="sep sep--v" aria-label="Resize the thread" />
            <Panel id="thread" defaultSize={364} minSize={300} maxSize={600} {...thread}>
              <Thread />
            </Panel>
          </Group>
        </main>
        <StatusBar />
      </div>
      <Tour />
    </div>
  );
}

type Pane = "thread" | "files" | "main" | "problems";

const panes: { id: Pane; label: string }[] = [
  { id: "thread", label: "Thread" },
  { id: "files", label: "Files" },
  { id: "main", label: "Editor" },
  { id: "problems", label: "Problems" },
];

/** Phones and small tablets: the same IDE, one pane at a time. The tour needs the full layout, so the agent's
 * steps simply play in the thread instead. */
function NarrowIde() {
  const { state, dispatch } = useIde();
  const hero = state.checks[HERO_KEY];
  const [pane, setPane] = useState<Pane>(() => (hero?.status === "done" ? "main" : "thread"));
  const problems = problemsFor(state).length;

  // The tour needs the full layout, so here the example simply plays in the thread once it has loaded.
  useEffect(() => {
    if (hero?.status === "waiting") dispatch({ type: "startHero" });
  }, [hero?.status, state.tourRun]);

  // Whatever the visitor opens, or the replay finishes on, comes to the front.
  const seen = useRef(state.openSeq);
  useEffect(() => {
    if (state.openSeq !== seen.current) setPane("main");
    seen.current = state.openSeq;
  }, [state.openSeq]);
  const finished = useRef(hero?.status === "done");
  useEffect(() => {
    const done = hero?.status === "done";
    if (done && !finished.current) setPane("main");
    finished.current = done;
  }, [hero?.status]);

  return (
    <div className="theme-glass ide ide--narrow">
      <h1 className="sr-only">{APP_NAME} IDE</h1>
      <TopBar />
      <div className="panes" role="tablist" aria-label="Panes" onKeyDown={onTablistKeyDown}>
        {panes.map((p) => (
          <button
            key={p.id}
            id={`pane-tab-${p.id}`}
            role="tab"
            aria-selected={pane === p.id}
            aria-controls="pane"
            tabIndex={pane === p.id ? 0 : -1}
            className={pane === p.id ? "is-on" : ""}
            onClick={() => setPane(p.id)}
          >
            {p.label}
            {p.id === "problems" && problems > 0 && <span className="count">{problems}</span>}
          </button>
        ))}
      </div>
      <main className="ide__pane">
        <div id="pane" className="ide__panel" role="tabpanel" aria-labelledby={`pane-tab-${pane}`}>
          {pane === "thread" && <Thread />}
          {pane === "files" && <Explorer />}
          {pane === "main" && <MainArea />}
          {pane === "problems" && <BottomPanel />}
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

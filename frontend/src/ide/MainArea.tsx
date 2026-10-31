import { lazy, Suspense, useState } from "react";
import { Check, Columns2, Copy, Download, FileCode2, FileText, FileVideo, Play, X } from "lucide-react";
import { runs, type ProjectFile } from "../data/examples";
import { onTablistKeyDown } from "../lib/tabs";
import { fileById, fileOf, hasRun, useIde, type TabId } from "./state";
import { CodeView } from "./CodeView";
import { ResultsView } from "./ResultsView";
import { ResearchSheet } from "./report/ResearchSheet";
import { ClipView } from "./ClipView";
import { useNarrow } from "./useNarrow";

// Monaco is the heaviest part of the IDE; it loads only when a file first opens on a wide screen.
const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));

function tabLabel(id: TabId): string {
  if (id.startsWith("results:")) {
    const f = fileById(id.slice(8));
    return `Results · ${f?.name.replace(/\.\w+$/, "") ?? id}`;
  }
  return fileById(id)?.name ?? id;
}

function tabDomId(id: TabId) {
  return `tab-${id.replace(/[^a-z0-9]/gi, "-")}`;
}

function TabIcon({ id }: { id: TabId }) {
  if (id.startsWith("results:")) return <Check size={14} aria-hidden />;
  const kind = fileById(id)?.kind;
  if (kind === "clip") return <FileVideo size={14} aria-hidden />;
  if (kind === "markdown") return <FileText size={14} aria-hidden />;
  return <FileCode2 size={14} aria-hidden />;
}

export function MainArea() {
  const { state, dispatch } = useIde();
  const narrow = useNarrow();
  const active = state.active;
  const fileId = fileOf(active);
  const file = fileId ? fileById(fileId) : undefined;
  const isCode = !!file && (file.kind === "pine" || file.kind === "python");
  const split = state.split && !narrow;

  return (
    <section className="main" aria-label="Editor and results" data-tour="main">
      <div className="tabbar">
        <div className="tabbar__tabs" role="tablist" aria-label="Open files" onKeyDown={onTablistKeyDown}>
          {state.openTabs.map((id) => (
            <div key={id} className={`tab ${active === id ? "is-active" : ""}`} role="presentation">
              <button
                id={tabDomId(id)}
                role="tab"
                aria-selected={active === id}
                aria-controls="main-panel"
                tabIndex={active === id ? 0 : -1}
                onClick={() => dispatch({ type: "open", id })}
              >
                <TabIcon id={id} />
                {tabLabel(id)}
              </button>
              <button className="tab__close" aria-label={`Close ${tabLabel(id)}`} onClick={() => dispatch({ type: "close", id })}>
                <X size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <div className="tabbar__tools">
          {file && isCode && <ExportButtons file={file} />}
          {file && isCode && hasRun(file.id) && !narrow && (
            <button
              className={`tool-btn ${state.split ? "is-on" : ""}`}
              onClick={() => dispatch({ type: "split" })}
              aria-pressed={state.split}
              title="Show code and results side by side"
            >
              <Columns2 size={14} aria-hidden />
              Split
            </button>
          )}
        </div>
      </div>

      {fileId && (isCode || active?.startsWith("results:")) && <RunBar fileId={fileId} />}

      <div
        id="main-panel"
        className="main__content"
        role={active ? "tabpanel" : undefined}
        aria-labelledby={active ? tabDomId(active) : undefined}
      >
        {!active && <EmptyState />}
        {active && <TabContent id={active} split={split} narrow={narrow} />}
      </div>
    </section>
  );
}

function Code({ file, narrow }: { file: ProjectFile; narrow: boolean }) {
  if (narrow) return <CodeView file={file} />;
  return (
    <Suspense fallback={<div className="code__loading">Loading editor…</div>}>
      <CodeEditor file={file} />
    </Suspense>
  );
}

function TabContent({ id, split, narrow }: { id: TabId; split: boolean; narrow: boolean }) {
  const { state } = useIde();
  const fileId = fileOf(id)!;
  const file = fileById(fileId);

  if (id.startsWith("results:")) {
    if (split && file) {
      return (
        <div className="split">
          <Code file={file} narrow={narrow} />
          <ResultsView runId={fileId} />
        </div>
      );
    }
    return <ResultsView runId={fileId} />;
  }

  if (!file) return <EmptyState />;
  if (file.kind === "markdown") return <ResearchSheet which={file.id === "moon" ? "moon" : "acme"} />;
  if (file.kind === "clip") return <ClipView />;
  if (split && state.ranRuns.includes(file.id)) {
    return (
      <div className="split">
        <Code file={file} narrow={narrow} />
        <ResultsView runId={file.id} />
      </div>
    );
  }
  return <Code file={file} narrow={narrow} />;
}

const settingFields = [
  ["symbol", "Symbol"],
  ["timeframe", "Timeframe"],
  ["from", "From"],
  ["to", "To"],
  ["capital", "Capital"],
] as const;

/** What the run used, stated as facts. In this preview example runs replay and can't be changed. */
function RunBar({ fileId }: { fileId: string }) {
  const { state, dispatch } = useIde();
  const run = runs[fileId];
  const running = state.running === fileId;

  if (!run) {
    return (
      <div className="runbar" data-tour="settings">
        <p className="runbar__note">
          Not run in this preview. Running new code comes with the backend.
        </p>
        <button className="run-btn" disabled aria-describedby="run-why">
          <Play size={13} aria-hidden fill="currentColor" />
          Run
        </button>
        <span id="run-why" className="sr-only">
          Running new code comes with the backend.
        </span>
      </div>
    );
  }

  return (
    <div className="runbar" data-tour="settings">
      <dl className="runbar__settings" aria-label="Settings this example ran with">
        {settingFields.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd className="mono">{run.settings[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="runbar__note">Example run · settings are fixed</p>
      <button
        className="run-btn"
        disabled={running}
        onClick={() => dispatch({ type: "runStart", runId: fileId })}
      >
        <Play size={13} aria-hidden fill="currentColor" />
        {running ? "Replaying…" : "Replay run"}
      </button>
    </div>
  );
}

function ExportButtons({ file }: { file: ProjectFile }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    window.setTimeout(() => setCopy("idle"), 1800);
  }

  function download() {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    // Some browsers start the download after click() returns; give them time before freeing the file.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <span className="export" data-tour="export">
      <button className="tool-btn" onClick={onCopy}>
        {copy === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        {copy === "copied" ? "Copied" : copy === "failed" ? "Copy blocked" : "Copy"}
      </button>
      <button className="tool-btn" onClick={download} aria-label={`Download ${file.name}`}>
        <Download size={14} aria-hidden />
        <span className="export__word">Download </span>
        {file.kind === "pine" ? ".pine" : ".py"}
      </button>
      <span className="sr-only" role="status">
        {copy === "copied" ? "Code copied" : copy === "failed" ? "The browser blocked copying. Use Download instead." : ""}
      </span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <p className="empty__title">Open a file to see it here.</p>
      <p className="empty__body">
        Strategies open as code with their results next to them. Research files open as a report.
      </p>
    </div>
  );
}

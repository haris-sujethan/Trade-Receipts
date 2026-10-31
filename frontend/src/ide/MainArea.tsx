import { useState } from "react";
import { Check, Columns2, Copy, Download, FileCode2, FileText, FileVideo, Lock, Play, X } from "lucide-react";
import { runs } from "../data/examples";
import { fileById, hasRun, useIde, type TabId } from "./state";
import { CodeEditor } from "./CodeEditor";
import { ResultsView } from "./ResultsView";
import { ResearchView } from "./ResearchView";
import { ClipView } from "./ClipView";

function tabLabel(id: TabId): string {
  if (id.startsWith("results:")) {
    const f = fileById(id.slice(8));
    return `Results · ${f?.name.replace(/\.\w+$/, "") ?? id}`;
  }
  return fileById(id)?.name ?? id;
}

function TabIcon({ id }: { id: TabId }) {
  if (id.startsWith("results:")) return <Check size={14} aria-hidden />;
  const kind = fileById(id)?.kind;
  if (kind === "clip") return <FileVideo size={14} aria-hidden />;
  if (kind === "markdown") return <FileText size={14} aria-hidden />;
  return <FileCode2 size={14} aria-hidden />;
}

/** The file a tab belongs to: a results tab belongs to the file that ran. */
function fileOf(id: TabId | null): string | null {
  if (!id) return null;
  return id.startsWith("results:") ? id.slice(8) : id;
}

export function MainArea() {
  const { state, dispatch } = useIde();
  const active = state.active;
  const fileId = fileOf(active);
  const file = fileId ? fileById(fileId) : undefined;
  const readOnly = state.mode === "personal";
  const isCode = file && (file.kind === "pine" || file.kind === "python");
  const showSettings = isCode || active?.startsWith("results:");

  return (
    <section className="main" aria-label="Editor and results" data-tour="main">
      <div className="tabbar" role="tablist" aria-label="Open files">
        {state.openTabs.map((id) => (
          <div key={id} className={`tab ${state.active === id ? "is-active" : ""}`} role="presentation">
            <button role="tab" aria-selected={state.active === id} onClick={() => dispatch({ type: "open", id })}>
              <TabIcon id={id} />
              {tabLabel(id)}
            </button>
            <button className="tab__close" aria-label={`Close ${tabLabel(id)}`} onClick={() => dispatch({ type: "close", id })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <div className="tabbar__tools">
          {file && isCode && <ExportButtons fileId={file.id} />}
          {file && isCode && hasRun(file.id) && (
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

      {showSettings && fileId && <SettingsBar key={fileId} fileId={fileId} />}

      <div className="main__content">
        {!active && <EmptyState />}
        {active && <TabContent id={active} readOnly={readOnly} split={state.split} />}
      </div>
    </section>
  );
}

function TabContent({ id, readOnly, split }: { id: TabId; readOnly: boolean; split: boolean }) {
  const { state } = useIde();
  const fileId = fileOf(id)!;
  const file = fileById(fileId);
  const ran = state.ranRuns.includes(fileId);

  if (id.startsWith("results:")) {
    if (split && file) {
      return (
        <div className="split">
          <CodeEditor file={file} readOnly={readOnly} />
          <ResultsView runId={fileId} />
        </div>
      );
    }
    return <ResultsView runId={fileId} />;
  }

  if (!file) return <EmptyState />;
  if (file.kind === "markdown") return <ResearchView />;
  if (file.kind === "clip") return <ClipView />;
  if (split && ran) {
    return (
      <div className="split">
        <CodeEditor file={file} readOnly={readOnly} />
        <ResultsView runId={file.id} />
      </div>
    );
  }
  return <CodeEditor file={file} readOnly={readOnly} />;
}

function SettingsBar({ fileId }: { fileId: string }) {
  const { state, dispatch } = useIde();
  const run = runs[fileId];
  const defaults = run?.settings ?? { symbol: "SPY", timeframe: "1D", from: "2010-01-01", to: "2026-10-29", capital: "$10,000" };
  const [values, setValues] = useState(defaults);
  const running = state.running === fileId;
  const canRun = fileId in runs;

  const field = (key: keyof typeof values, label: string, width: number) => (
    <label className="setting">
      <span>{label}</span>
      <input
        value={values[key]}
        style={{ width }}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="settings" data-tour="settings">
      {field("symbol", "Symbol", 132)}
      {field("timeframe", "Timeframe", 44)}
      {field("from", "From", 96)}
      {field("to", "To", 96)}
      {field("capital", "Capital", 84)}
      <button
        className="run-btn"
        disabled={running || !canRun}
        title={canRun ? "Run this strategy" : "Running new strategies needs the backend, which isn't connected yet"}
        onClick={() => dispatch({ type: "runStart", runId: fileId })}
      >
        <Play size={13} aria-hidden fill="currentColor" />
        {running ? "Running…" : "Run"}
      </button>
    </div>
  );
}

function ExportButtons({ fileId }: { fileId: string }) {
  const file = fileById(fileId);
  const [copied, setCopied] = useState(false);
  if (!file) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(file!.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked; the download button still works.
    }
  }

  function download() {
    const blob = new Blob([file!.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file!.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <span className="export" data-tour="export">
      <button className="tool-btn" onClick={copy}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button className="tool-btn" onClick={download}>
        <Download size={14} aria-hidden />
        Download {file.kind === "pine" ? ".pine" : ".py"}
      </button>
    </span>
  );
}

function EmptyState() {
  const { state } = useIde();
  return (
    <div className="empty">
      <p className="empty__title">Open a file, or ask the agent to create one.</p>
      <p className="empty__body">
        Describe a strategy in the thread on the right. The agent writes the code here and prints the results next to
        it.
      </p>
      {state.mode === "personal" && (
        <p className="empty__body">
          <Lock size={13} aria-hidden /> Finished examples are in the Examples folder.
        </p>
      )}
    </div>
  );
}

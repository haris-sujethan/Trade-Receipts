import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileText, FileVideo, ScanSearch, Timer } from "lucide-react";
import { projectFiles, type ProjectFile } from "../data/examples";
import { answerOf, duration, loadRun, shortAddr } from "../demo/runs";
import { copyTitle, isCopyRun, tabOf, useIde } from "./state";

/** Strategies and clips (ProjectFile folders) are unplugged with the strategy backtests; the code still reads them. */
type Folder = "checks" | "copy trades" | "this session" | ProjectFile["folder"];

function FileIcon({ kind }: { kind: ProjectFile["kind"] }) {
  if (kind === "clip") return <FileVideo size={15} aria-hidden />;
  if (kind === "markdown" || kind === "token") return <FileText size={15} aria-hidden />;
  return <FileCode2 size={15} aria-hidden />;
}

/** The files: the examples (saved rug checks and copy-trade backtests), then the runs started in this session. */
export function Explorer() {
  const { state, dispatch } = useIde();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  // Checks and backtests started here; a follow-up question's answer lives in its thread, not in the files.
  const session = Object.values(state.checks).filter(
    (c) =>
      (c.key.startsWith("live:") || /^replay:\d/.test(c.key)) &&
      (isCopyRun(c) || c.run.events.some((e) => e.type === "step" && e.tool === "check_token") || !!answerOf(c.run)?.check),
  );
  const examples: Folder[] = ["checks", "copy trades"];

  function openSaved(id: string) {
    const key = `saved:${id}`;
    if (state.checks[key]) return dispatch({ type: "open", id: `check:${key}` });
    setLoading(id);
    loadRun(id)
      .then((run) => dispatch({ type: "openSaved", key, run }))
      .finally(() => setLoading(null));
  }

  function openCopy(id: string) {
    const key = `saved:${id}`;
    if (state.checks[key]) return dispatch({ type: "open", id: `copy:${key}` });
    setLoading(id);
    loadRun(id)
      .then((run) => dispatch({ type: "openSavedCopy", key, run }))
      .finally(() => setLoading(null));
  }

  const folderBody = (folder: Folder) => {
    if (folder === "checks") {
      if (!state.saved.length) return <li className="tree__empty">Loading saved checks</li>;
      return state.saved.map((r) => {
        const tab = `check:saved:${r.id}`;
        return (
          <li key={r.id}>
            <button className={`tree__file ${state.active === tab ? "is-active" : ""}`} aria-current={state.active === tab ? "true" : undefined} onClick={() => openSaved(r.id)}>
              <ScanSearch size={15} aria-hidden />
              <span className="tree__name">{r.symbol ?? r.mint.slice(0, 6)}</span>
              <span className="tree__meta">{loading === r.id ? "Opening" : r.rug_chance != null ? `${Math.round(r.rug_chance * 100)}%` : ""}</span>
            </button>
          </li>
        );
      });
    }
    if (folder === "copy trades") {
      if (!state.savedCopies.length) return <li className="tree__empty">No saved backtests</li>;
      return state.savedCopies.map((r) => {
        const tab = `copy:saved:${r.id}`;
        return (
          <li key={r.id}>
            <button className={`tree__file ${state.active === tab ? "is-active" : ""}`} aria-current={state.active === tab ? "true" : undefined} onClick={() => openCopy(r.id)}>
              <Timer size={15} aria-hidden />
              <span className="tree__name mono">{shortAddr(r.wallet)}</span>
              <span className="tree__meta">
                {loading === r.id ? "Opening" : r.buy_after_s != null && r.sell_after_s != null ? `${duration(r.buy_after_s)} / ${duration(r.sell_after_s)}` : ""}
              </span>
            </button>
          </li>
        );
      });
    }
    if (folder === "this session") {
      return session.map((c) => {
        const tab = tabOf(c);
        const copy = isCopyRun(c);
        const answer = c.run.events.find((e) => e.type === "answer");
        const name = copy ? copyTitle(c) : answer && answer.type === "answer" && answer.check ? answer.check.symbol : c.run.message.slice(0, 24);
        return (
          <li key={c.key}>
            <button className={`tree__file ${state.active === tab ? "is-active" : ""}`} aria-current={state.active === tab ? "true" : undefined} onClick={() => dispatch({ type: "open", id: tab })}>
              {copy ? <Timer size={15} aria-hidden /> : <ScanSearch size={15} aria-hidden />}
              <span className="tree__name">{name}</span>
              <span className="tree__meta">{c.status === "running" ? (copy ? "Running" : "Checking") : c.status === "error" ? "Failed" : c.mode === "live" ? "Live" : "Replay"}</span>
            </button>
          </li>
        );
      });
    }
    return projectFiles
      .filter((f) => f.folder === folder)
      .map((f) => (
        <li key={f.id}>
          <button className={`tree__file ${state.active === f.id ? "is-active" : ""}`} aria-current={state.active === f.id ? "true" : undefined} onClick={() => dispatch({ type: "open", id: f.id })}>
            <FileIcon kind={f.kind} />
            <span className="tree__name">{f.name}</span>
          </button>
        </li>
      ));
  };

  const folder = (name: Folder, label: string = name) => {
    const open = !closed[name];
    return (
      <li key={name}>
        <button className="tree__folder" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [name]: !c[name] }))}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <span>{label}</span>
        </button>
        {open && <ul className="tree">{folderBody(name)}</ul>}
      </li>
    );
  };
  const examplesOpen = !closed.examples;

  return (
    <aside className="explorer" aria-label="Files" data-tour="explorer">
      <div className="pane-head">
        <span className="pane-head__title">Files</span>
      </div>
      <ul className="tree tree--root">
        {session.length > 0 && folder("this session")}
        <li data-tour="examples">
          <button className="tree__folder" aria-expanded={examplesOpen} onClick={() => setClosed((c) => ({ ...c, examples: !c.examples }))}>
            {examplesOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            <span>examples</span>
          </button>
          {examplesOpen && <ul className="tree">{examples.map((f) => folder(f))}</ul>}
        </li>
      </ul>
    </aside>
  );
}

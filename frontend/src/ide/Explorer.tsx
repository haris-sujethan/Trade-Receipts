import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileText, FileVideo, Lock, ScanSearch } from "lucide-react";
import { projectFiles, type ProjectFile } from "../data/examples";
import { loadRun } from "../demo/runs";
import { useIde } from "./state";

type Folder = "checks" | "this session" | ProjectFile["folder"];

function FileIcon({ kind }: { kind: ProjectFile["kind"] }) {
  if (kind === "clip") return <FileVideo size={15} aria-hidden />;
  if (kind === "markdown" || kind === "token") return <FileText size={15} aria-hidden />;
  return <FileCode2 size={15} aria-hidden />;
}

/** The demo project: the saved rug checks, checks started in this session, and the example strategies. */
export function Explorer() {
  const { state, dispatch } = useIde();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const session = Object.values(state.checks).filter((c) => c.key.startsWith("live:") || /^replay:\d/.test(c.key));
  const folders: Folder[] = ["checks", ...(session.length ? (["this session"] as Folder[]) : []), "strategies", "clips"];

  function openSaved(id: string) {
    const key = `saved:${id}`;
    if (state.checks[key]) return dispatch({ type: "open", id: `check:${key}` });
    setLoading(id);
    loadRun(id)
      .then((run) => dispatch({ type: "openSaved", key, run }))
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
    if (folder === "this session") {
      return session.map((c) => {
        const tab = `check:${c.key}`;
        const answer = c.run.events.find((e) => e.type === "answer");
        const name = answer && answer.type === "answer" && answer.check ? answer.check.symbol : c.run.message.slice(0, 24);
        return (
          <li key={c.key}>
            <button className={`tree__file ${state.active === tab ? "is-active" : ""}`} aria-current={state.active === tab ? "true" : undefined} onClick={() => dispatch({ type: "open", id: tab })}>
              <ScanSearch size={15} aria-hidden />
              <span className="tree__name">{name}</span>
              <span className="tree__meta">{c.status === "running" ? "Checking" : c.status === "error" ? "Failed" : c.mode === "live" ? "Live" : "Replay"}</span>
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

  return (
    <aside className="explorer" aria-label="Project files" data-tour="explorer">
      <div className="pane-head">
        <span className="pane-head__title">Demo project</span>
        <span className="pane-head__note" title="Saved checks and example files can be read, copied and downloaded">
          <Lock size={11} aria-hidden />
          Read-only
        </span>
      </div>
      <ul className="tree tree--root">
        {folders.map((folder) => {
          const open = !closed[folder];
          return (
            <li key={folder}>
              <button className="tree__folder" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [folder]: !c[folder] }))}>
                {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                <span>{folder}</span>
              </button>
              {open && <ul className="tree">{folderBody(folder)}</ul>}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FileText,
  FileVideo,
  FolderPlus,
  Lock,
  RefreshCw,
} from "lucide-react";
import { projectFiles, type ProjectFile } from "../data/examples";
import { useIde } from "./state";

const folders: ProjectFile["folder"][] = ["strategies", "research", "clips"];

function FileIcon({ kind }: { kind: ProjectFile["kind"] }) {
  if (kind === "clip") return <FileVideo size={15} aria-hidden />;
  if (kind === "markdown") return <FileText size={15} aria-hidden />;
  return <FileCode2 size={15} aria-hidden />;
}

export function Explorer() {
  const { state, dispatch } = useIde();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const demo = state.mode === "demo";

  function toggle(key: string) {
    setClosed((c) => ({ ...c, [key]: !c[key] }));
  }

  function fileRow(f: ProjectFile, depth: number) {
    const isNew = demo && f.id === "rsi" && state.revealed >= 5 && !state.openTabs.includes("results:rsi");
    return (
      <li key={`${depth}-${f.id}`}>
        <button
          className={`tree__file ${state.active === f.id ? "is-active" : ""}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => dispatch({ type: "open", id: f.id })}
        >
          <FileIcon kind={f.kind} />
          <span className="tree__name">{f.name}</span>
          {isNew && <span className="tree__new" aria-label="new file" />}
        </button>
      </li>
    );
  }

  function folderRow(key: string, label: string, files: ProjectFile[], depth: number, extra?: ReactNode) {
    const open = !closed[key];
    return (
      <li key={key}>
        <button
          className="tree__folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          aria-expanded={open}
          onClick={() => toggle(key)}
        >
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <span>{label}</span>
          {extra}
        </button>
        {open && (
          <ul className="tree">
            {files.length === 0 && (
              <li className="tree__empty" style={{ paddingLeft: 30 + depth * 14 }}>
                Empty
              </li>
            )}
            {files.map((f) => fileRow(f, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <aside className="explorer" aria-label="Project files" data-tour="explorer">
      <div className="pane-head">
        <span className="pane-head__title">{demo ? "Demo project" : "My project"}</span>
        <div className="pane-head__tools">
          <button className="icon-btn icon-btn--sm" title="New file" aria-label="New file">
            <FilePlus2 size={15} />
          </button>
          <button className="icon-btn icon-btn--sm" title="New folder" aria-label="New folder">
            <FolderPlus size={15} />
          </button>
          <button className="icon-btn icon-btn--sm" title="Refresh" aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <ul className="tree tree--root">
        {folders.map((folder) =>
          folderRow(
            folder,
            folder,
            demo ? projectFiles.filter((f) => f.folder === folder) : [],
            0,
          ),
        )}
        {!demo &&
          folderRow(
            "examples",
            "Examples",
            projectFiles,
            0,
            <span className="tree__lock" title="Read-only">
              <Lock size={12} aria-hidden />
              read-only
            </span>,
          )}
      </ul>
    </aside>
  );
}

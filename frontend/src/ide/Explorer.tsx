import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileText, FileVideo, Lock } from "lucide-react";
import { projectFiles, type ProjectFile } from "../data/examples";
import { useIde, WRITE_STEP, WRITTEN_FILE } from "./state";

const folders: ProjectFile["folder"][] = ["tokens", "strategies", "clips"];

function FileIcon({ kind }: { kind: ProjectFile["kind"] }) {
  if (kind === "clip") return <FileVideo size={15} aria-hidden />;
  if (kind === "markdown" || kind === "token") return <FileText size={15} aria-hidden />;
  return <FileCode2 size={15} aria-hidden />;
}

export function Explorer() {
  const { state, dispatch } = useIde();
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  return (
    <aside className="explorer" aria-label="Project files" data-tour="explorer">
      <div className="pane-head">
        <span className="pane-head__title">Demo project</span>
        <span className="pane-head__note" title="Example files can be read, copied and downloaded">
          <Lock size={11} aria-hidden />
          Read-only
        </span>
      </div>

      <ul className="tree tree--root">
        {folders.map((folder) => {
          const open = !closed[folder];
          const files = projectFiles.filter((f) => f.folder === folder);
          return (
            <li key={folder}>
              <button
                className="tree__folder"
                aria-expanded={open}
                onClick={() => setClosed((c) => ({ ...c, [folder]: !c[folder] }))}
              >
                {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                <span>{folder}</span>
              </button>
              {open && (
                <ul className="tree">
                  {files.map((f) => {
                    // The report the agent is writing, until the check finishes.
                    const isNew = f.id === WRITTEN_FILE && state.revealed >= WRITE_STEP && !state.replayed;
                    return (
                      <li key={f.id}>
                        <button
                          className={`tree__file ${state.active === f.id ? "is-active" : ""}`}
                          aria-current={state.active === f.id ? "true" : undefined}
                          onClick={() => dispatch({ type: "open", id: f.id })}
                        >
                          <FileIcon kind={f.kind} />
                          <span className="tree__name">{f.name}</span>
                          {isNew && (
                            <span className="tree__new">
                              <span className="sr-only">(new)</span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

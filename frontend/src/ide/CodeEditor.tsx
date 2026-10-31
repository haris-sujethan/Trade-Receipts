import { useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { monaco } from "../monaco/setup";
import { type ProjectFile } from "../data/examples";
import { problemsFor, useIde } from "./state";

type Props = { file: ProjectFile; readOnly: boolean };

const severity = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
};

export function CodeEditor({ file, readOnly }: Props) {
  const { state } = useIde();
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const language = file.kind === "pine" ? "pine" : file.kind === "python" ? "python" : "markdown";

  // Problems from runs become squiggles in the file they point at.
  useEffect(() => {
    const model = editor?.getModel();
    if (!model) return;
    const markers = problemsFor(state.ranRuns)
      .filter((p) => p.file === file.name && p.line)
      .map((p) => {
        const line = Math.min(p.line!, model.getLineCount());
        return {
          severity: severity[p.severity],
          message: p.message,
          startLineNumber: line,
          startColumn: model.getLineFirstNonWhitespaceColumn(line) || 1,
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        };
      });
    monaco.editor.setModelMarkers(model, "results", markers);
  }, [editor, state.ranRuns, file.name]);

  const onMount: OnMount = (instance) => setEditor(instance);

  return (
    <div className="code">
      {readOnly && <div className="code__banner">Example file · read-only. Ask the agent to make a copy you can edit.</div>}
      <Editor
        path={file.name}
        defaultLanguage={language}
        language={language}
        value={file.content}
        theme="desk"
        onMount={onMount}
        loading={<div className="code__loading">Loading editor…</div>}
        options={{
          readOnly,
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: 13,
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          padding: { top: 14, bottom: 14 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          overviewRulerBorder: false,
          guides: { indentation: true },
          wordWrap: "off",
          tabSize: 4,
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}

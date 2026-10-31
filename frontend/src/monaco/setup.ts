import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

// Bundle Monaco locally instead of loading it from a CDN.
(globalThis as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
loader.config({ monaco });

// Pine Script v6: enough grammar to read comfortably.
monaco.languages.register({ id: "pine", extensions: [".pine"], aliases: ["Pine Script"] });
monaco.languages.setMonarchTokensProvider("pine", {
  keywords: [
    "if", "else", "for", "to", "by", "in", "while", "switch", "var", "varip", "import", "export",
    "method", "type", "enum", "and", "or", "not", "true", "false", "na", "return", "continue", "break",
  ],
  namespaces: ["strategy", "indicator", "ta", "math", "input", "request", "color", "str", "array", "barstate", "syminfo", "timeframe"],
  builtins: ["close", "open", "high", "low", "volume", "time", "bar_index", "hl2", "hlc3", "ohlc4", "plot", "hline", "plotshape", "bgcolor"],
  tokenizer: {
    root: [
      // [@] instead of a bare @: Monarch reads @name as a reference to a word list.
      [/\/\/[@]version=\d+/, "annotation"],
      [/\/\/.*$/, "comment"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/\d+(\.\d+)?/, "number"],
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@namespaces": "namespace",
            "@builtins": "builtin",
            "@default": "identifier",
          },
        },
      ],
      [/[=<>!+\-*/%]+/, "operator"],
    ],
  },
} as monaco.languages.IMonarchLanguage);

monaco.editor.defineTheme("desk", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "7e7e85", fontStyle: "italic" },
    { token: "annotation", foreground: "a6a6ab" },
    { token: "keyword", foreground: "ffffff", fontStyle: "bold" },
    { token: "namespace", foreground: "d9d9dc" },
    { token: "builtin", foreground: "d9d9dc" },
    { token: "identifier", foreground: "c8c8cc" },
    { token: "string", foreground: "b9cbb2" },
    { token: "number", foreground: "dcc79e" },
    { token: "operator", foreground: "a6a6ab" },
    { token: "keyword.python", foreground: "ffffff", fontStyle: "bold" },
    { token: "string.python", foreground: "b9cbb2" },
    { token: "number.python", foreground: "dcc79e" },
  ],
  colors: {
    "editor.background": "#0b0b0c",
    "editor.foreground": "#d9d9dc",
    "editorLineNumber.foreground": "#4f4f56",
    "editorLineNumber.activeForeground": "#a6a6ab",
    "editor.lineHighlightBackground": "#141417",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#34343c",
    "editor.inactiveSelectionBackground": "#26262c",
    "editorCursor.foreground": "#ffffff",
    "editorIndentGuide.background1": "#1f1f23",
    "editorIndentGuide.activeBackground1": "#36363d",
    "editorWarning.foreground": "#e3a53c",
    "editorError.foreground": "#f0675c",
    "editorInfo.foreground": "#85858b",
    "scrollbarSlider.background": "#36363d80",
    "scrollbarSlider.hoverBackground": "#4a4a52a0",
    "editorWidget.background": "#17171a",
    "editorWidget.border": "#36363d",
    "editorHoverWidget.background": "#17171a",
    "editorHoverWidget.border": "#36363d",
  },
});

export { monaco };

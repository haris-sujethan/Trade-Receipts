// The editor core and its features, plus the two languages the IDE shows. The full "monaco-editor" entry would
// also bundle every other language and the TypeScript, CSS, JSON and HTML language services (about 12 MB).
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/markdown/register";
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

// The editor's light theme, named "desk" for the editor component. Ink from the site tokens; strings and numbers
// stay quiet so problems (amber, red) and the Meta blue cursor stand out.
monaco.editor.defineTheme("desk", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6b6e73", fontStyle: "italic" },
    { token: "annotation", foreground: "4a4d51" },
    { token: "keyword", foreground: "141618", fontStyle: "bold" },
    { token: "namespace", foreground: "2b2e33" },
    { token: "builtin", foreground: "2b2e33" },
    { token: "identifier", foreground: "2b2e33" },
    { token: "string", foreground: "1f7a4d" },
    { token: "number", foreground: "8a5a00" },
    { token: "operator", foreground: "4a4d51" },
    { token: "keyword.python", foreground: "141618", fontStyle: "bold" },
    { token: "string.python", foreground: "1f7a4d" },
    { token: "number.python", foreground: "8a5a00" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#2b2e33",
    "editorLineNumber.foreground": "#6b6e73",
    "editorLineNumber.activeForeground": "#2b2e33",
    "editor.lineHighlightBackground": "#f5f6f8",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#cfe4ff",
    "editor.inactiveSelectionBackground": "#e6eef9",
    "editorCursor.foreground": "#0064e0",
    "editorIndentGuide.background1": "#eceef1",
    "editorIndentGuide.activeBackground1": "#d5d8dd",
    "editorWarning.foreground": "#9a6700",
    "editorError.foreground": "#c0392b",
    "editorInfo.foreground": "#6b6e73",
    "scrollbarSlider.background": "#c9ccd180",
    "scrollbarSlider.hoverBackground": "#b4b8bea0",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e2e4e8",
    "editorHoverWidget.background": "#ffffff",
    "editorHoverWidget.border": "#e2e4e8",
  },
});

export { monaco };

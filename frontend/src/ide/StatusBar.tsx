import { Lock } from "lucide-react";
import { fileById, fileOf, useIde } from "./state";

export function StatusBar() {
  const { state } = useIde();
  const file = fileById(fileOf(state.active));
  const kind =
    file?.kind === "pine" ? "Pine Script v6" : file?.kind === "python" ? "Python" : file?.kind === "token" ? "Rug check" : null;

  return (
    <footer className="status">
      <span className="status__item">Demo project</span>
      {file && (
        <span className="status__item status__wide">
          <Lock size={11} aria-hidden /> Read-only
        </span>
      )}
      {kind && <span className="status__item status__wide">{kind}</span>}

      <span className="status__spacer" />

      <span className="status__item status__wide">Muse Spark 1.3 · Muse Glimmer</span>
      <span className="status__item">Not financial advice</span>
    </footer>
  );
}

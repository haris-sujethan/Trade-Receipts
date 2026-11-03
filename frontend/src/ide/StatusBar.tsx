import { Lock } from "lucide-react";
import { checkOf, copyRunOf, fileById, fileOf, useIde } from "./state";

export function StatusBar() {
  const { state } = useIde();
  const file = fileById(fileOf(state.active));
  const check = checkOf(state, state.active);
  const copy = copyRunOf(state, state.active);
  const kind = check ? "Rug check" : copy ? "Copy-trade backtest" : file?.kind === "pine" ? "Pine Script v6" : file?.kind === "python" ? "Python" : null;

  return (
    <footer className="status">
      <span className="status__item">Demo project</span>
      {(file || check || (copy && copy.mode === "replay")) && (
        <span className="status__item status__wide">
          <Lock size={11} aria-hidden /> Read-only
        </span>
      )}
      {kind && <span className="status__item status__wide">{kind}</span>}

      <span className="status__spacer" />

      <span className="status__item status__wide">Agent: Muse Spark 1.3</span>
      <span className="status__item status__wide">Second opinion: Muse Glimmer</span>
      <span className="status__item">Not financial advice</span>
    </footer>
  );
}

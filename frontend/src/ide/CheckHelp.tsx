import { LifeBuoy } from "lucide-react";
import type { Frame } from "../demo/timeline";

/** The tools whose failure means the token wasn't found or couldn't be read. */
const FINDING = new Set(["check_token", "find_token", "read_address"]);

/** The failed finding step in a check, if any: its tool and what it said. */
export function findFailure(frame: Frame): { tool: string; said: string } | null {
  const s = frame.steps.find((x) => FINDING.has(x.tool) && x.state === "error");
  return s ? { tool: s.tool, said: s.done?.summary ?? "" } : null;
}

/** What to try when a check couldn't find or read the token: the likely cause first, then the usual fixes. */
export function CheckHelp({ failure }: { failure: { tool: string; said: string } }) {
  const said = failure.said.toLowerCase();
  const first = said.includes("valid solana address")
    ? "Check the address: it should be the token’s full mint, 32 to 44 letters and numbers, usually ending in “pump”. Copy it from the token’s pump.fun page rather than typing it."
    : said.includes("no pump.fun launch")
      ? "Make sure it’s a pump.fun token on Solana. Tokens from other launchpads or chains aren’t covered yet."
      : failure.tool === "find_token"
        ? "Paste the token’s mint or pump.fun link instead of its ticker: many tokens share a ticker, and the newest may not be searchable yet."
        : "The check couldn’t finish reading the token. Send the same message again; it usually goes through the second time.";
  const steps = [
    first,
    "Open the token on pump.fun and copy the link from the address bar (pump.fun/coin/…), then paste that.",
    "If you pasted a wallet, not a token, switch to Copy trade at the top to backtest copying it.",
    "Just launched? Give it a minute so its first trades are on chain, then check again.",
  ];
  return (
    <div className="check-help" role="note">
      <p className="check-help__title">
        <LifeBuoy size={14} aria-hidden />
        What to try
      </p>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

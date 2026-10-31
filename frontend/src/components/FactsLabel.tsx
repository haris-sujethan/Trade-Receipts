import { useEffect, useState } from "react";
import type { Facts } from "../data/examples";
import "./facts.css";

type Props = {
  facts: Facts;
  title?: string;
  size?: "full" | "compact";
  /** Draw the strike through the claimed number after mount. */
  animate?: boolean;
  className?: string;
};

export function FactsLabel({ facts, title = "Strategy Facts", size = "full", animate = true, className = "" }: Props) {
  const [struck, setStruck] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    setStruck(false);
    const t = window.setTimeout(() => setStruck(true), 650);
    return () => window.clearTimeout(t);
  }, [facts, animate]);

  return (
    <section
      className={`facts facts--${size} ${struck ? "is-struck" : ""} ${className}`}
      aria-label={`${title}: ${facts.subject}`}
    >
      <h2 className="facts__title">{title}</h2>
      <p className="facts__subject">{facts.subject}</p>
      <p className="facts__serving">{facts.serving}</p>

      {facts.claimed && (
        <div className="facts__big facts__claimed">
          <span>{facts.claimed.label}</span>
          <span className="facts__claimed-value">
            {/* Screen readers skip <s>, so the strike's meaning is spelled out. */}
            <span className="sr-only">Contradicted by the test: </span>
            <s>{facts.claimed.value}</s>
          </span>
        </div>
      )}
      <div className={`facts__big facts__tested ${facts.tested.tone === "bad" ? "is-bad" : ""}`}>
        <span>{facts.tested.label}</span>
        <span>{facts.tested.value}</span>
      </div>

      <dl className="facts__rows">
        {facts.rows.map((row) => (
          <div
            key={row.label}
            className={`facts__row rule-${row.rule ?? "hair"} ${row.tone === "strong" ? "is-strong" : ""}`}
          >
            <dt>{row.label}</dt>
            <dd className={row.tone === "bad" ? "is-bad" : ""}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="facts__foot">{facts.footnote}</p>
    </section>
  );
}

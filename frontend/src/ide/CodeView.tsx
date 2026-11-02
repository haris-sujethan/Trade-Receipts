import { Fragment } from "react";
import { type ProjectFile } from "../data/examples";
import { problemsFor, useIde } from "./state";

/** A light, read-only code view for narrow screens, where Monaco is too heavy and too fiddly to touch.
 * Problems from runs show under the line they point at. */
export function CodeView({ file }: { file: ProjectFile }) {
  const { state } = useIde();
  const problems = problemsFor(state).filter((p) => p.file === file.name && p.line);
  const lines = file.content.split("\n");

  return (
    <div className="code">
      <p className="code__banner">Example file · read-only. Copy or download it to edit it anywhere.</p>
      <pre className="codeview" tabIndex={0} aria-label={`${file.name}, read-only`}>
        {lines.map((line, i) => {
          const here = problems.filter((p) => p.line === i + 1);
          return (
            <Fragment key={i}>
              <span className={`codeview__line ${here.length ? `has-${here[0].severity}` : ""}`}>
                <span className="codeview__ln" aria-hidden>
                  {i + 1}
                </span>
                {line || " "}
              </span>
              {here.map((p) => (
                <span key={p.message} className={`codeview__problem is-${p.severity}`}>
                  {p.message}
                </span>
              ))}
            </Fragment>
          );
        })}
      </pre>
    </div>
  );
}

---
version: 1
slug: "frontend-src-pages-ide-tsx"
primary_target: "frontend/src/pages/Ide.tsx"
related_targets: ["frontend/src/pages/SignUp.tsx"]
---

# IDE

Scope: the app itself, plus its sign-up screen and guided tour. Mode: Operate. Desktop-only; phones see a "best on a larger screen" message.

Task: describe a strategy (text, screenshot, clip), watch the agent write and fix code, run it, read honest results, keep the code; research a stock from filings. Layout (pinned by the user): top bar with centered text tabs Backtest and Analyze (selected white, other grey, no pill); file explorer far left; main area with Results and code tabs, Split, and a settings bar; agent thread on the right; Problems and Output panel at the bottom. Agent edits show as diffs with Accept and Reject.

World: inherits the home page's facts-label world as the dark desk: near-black panels, white hairlines, the same grotesque, monospace for code. Every run's results appear as a white Strategy Facts label on the dark ground (confirmed by the user). Red only for failed, contradicted, or trailing values; amber for warnings; one accent for whatever is running. No shadows, glows, or gradients.

States to cover: empty project, running, fix rounds, compile errors, honesty warnings, finished run, ambiguous rule, missing Tiingo key, tour overlay.

Data for now: mock project files and cached example runs, labeled as examples.

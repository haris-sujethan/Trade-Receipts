---
target: home page, sign-up, and IDE
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:/Users/harissujethan/Desktop/Trade-Receipts/frontend/src/pages/Home.tsx"
target_fingerprint: "sha256:de23e11ceed9ee04ded73f0d6d7bd57acfc0945f9eb275cd29a25fd508f64591"
target_path: /Users/harissujethan/Desktop/Trade-Receipts/frontend/src/pages/Home.tsx
timestamp: 2026-10-31T02-21-38Z
slug: frontend-src-pages-home-tsx
---
Method: dual-agent (A: design review · B: detector and browser), plus a technical audit, a web interface guidelines check, and a code review.

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Replay steps and Running… are clear; Problems keeps showing RSI issues while ACME.md is open |
| 2 | Match system / real world | 3 | Label metaphor lands; "agent-native IDE", "pts", "Repaints", "Look-ahead" unexplained for non-coders |
| 3 | User control and freedom | 2 | Esc on the tour wipes the demo into an empty project |
| 4 | Consistency and standards | 2 | Top bar stays on Backtest while research is open; the slab rule doubled as nav border and data divider |
| 5 | Error prevention | 2 | Settings inputs on examples are editable but Run ignores them |
| 6 | Recognition rather than recall | 3 | Why Run is disabled lives only in a tooltip |
| 7 | Flexibility and efficiency | 2 | No run shortcut, no report outline, New thread/History do nothing |
| 8 | Aesthetic and minimalist design | 3 | Restrained, but rules were overused (fixed) and fake controls add noise |
| 9 | Error recovery | 3 | Problems with file:line are strong; the composer's "can't run yet" is a dead end |
| 10 | Help and documentation | 3 | Replayable tour, but 9 steps |
| Total | | 26/40 | Acceptable |

## Design specificity
Authored, not interchangeable: the struck-through claim beside the tested number only makes sense for this product. Still category-default: the page skeleton (hero, demo, three steps, black CTA band) and the IDE chrome (generic dark VS Code). In the IDE the specificity lives in the white report sheet.
Detector: CLI 0 findings (regex-only for TSX/CSS). Live URL scan of /: oversized-h1 (88px, 50 chars) and 3 advisory stragglers; /signup and /ide clean.

## Heavy rules (fixed in this run)
The 14px slab under the nav and the 7px bar above the next section ran full-bleed while everything else sat in the column, used the label's heaviest weight for page chrome, and added up to ~9 black bars in the first viewport, so the page read as a barcode and the label lost its hierarchy. The 7px bar also sat just above the fold like a false floor. Fix applied: page chrome now takes a 1px hairline at column width (nav and section head), the tagline rule is a hairline, and heavy rules live only inside bordered objects (labels, How it works, the report).

## Priority issues
1. [P1] Heavy full-bleed rules. Fixed. Command: quieter.
2. [P1] The preview overstates itself: hero promises crypto research and "real data"; ~9 enabled controls do nothing (New file/folder/Refresh, New thread/History, Attach/Screenshot, Accept/Reject); settings inputs are ignored by Run; golden_cross says "Press Run" while Run is disabled; the Tiingo popover describes requests that don't exist yet. Fix: disable with "coming soon", lock example settings with visible text, show the disabled reason next to Run, add a "Preview · example data" chip. Commands: clarify, harden.
3. [P1] Accessibility: focus ring invisible inside the dark product window (ink outline on near-black); tour dialog doesn't trap focus and Esc drops focus on body; the demo auto-advances with no pause control (WCAG 2.2.2); the struck claim's meaning isn't announced; tablists lack arrow keys and aria-controls; charts have no data table. Command: harden.
4. [P1] Mobile: Launch IDE dead-ends at "Best on a larger screen"; the 760px product window traps scrolling; top bar text collides; demo tabs wrap into 3 rows; equity chart drawing area 100px of 274px. Command: adapt.
5. [P1] Performance: home page lazy-loads all of Plotly (1.42 MB gzipped); IDE imports the whole Monaco package (TS/JSON/CSS/HTML workers emitted, dist 19 MB) and loads it even on the narrow-screen page; the replay clock re-renders the report 10x/second through the hold. Command: optimize.
6. [P2] Tour: 9 steps, starts on the dullest beat (explorer), Esc wipes the demo, ends on an empty IDE; replaying it opens the Analyze tab at step 1 (stale-index bug). Command: onboard.

## Persona red flags
Jordan: undefined "agent-native IDE", "pts", "Repaints", "Look-ahead"; Step 1 of 9; disabled Run under "Press Run". Alex: no run shortcut or report outline; dead thread/explorer buttons; Problems not scoped to the open file. Sam: strike semantics lost; "Examplesread-only"; Run reason tooltip-only; noisy live region; focus escapes the tour; invisible focus in the demo. Casey: CTA dead-ends; demo traps scroll; "Strategy Facts" wraps.

## Minor observations
Disabled sign-up buttons at ~3:1 come before the real action; the heatmap/histogram green stretches "one red only"; desk input borders 1.64:1 and line numbers ~2.4:1; colors copied into TypeScript have drifted from tokens; lightweight-charts unused; IDE has no h1 or main landmark; placeholders don't end with "…"; no meta theme-color.

## Questions to consider
1. If the label is the truth-teller, should anything else on the page be louder than it?
2. Should a judge's first IDE moment be the receipt, with the code one click behind it?
3. What would the home page say if it only made claims the live preview can back up?

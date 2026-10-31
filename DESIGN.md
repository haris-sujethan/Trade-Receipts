---
name: Trade Receipts
description: An agent-native IDE for financial research and automated backtesting.
colors:
  ink: "#111111"
  ink-2: "#444447"
  ink-3: "#66666b"
  paper: "#ffffff"
  paper-2: "#f2f2ef"
  paper-3: "#e6e6e2"
  red: "#c3261c"
  gain: "#1f7a4d"
  regime-calm-up: "#1f7a4d"
  regime-volatile-up: "#4a86c8"
  regime-calm-down: "#2f4f99"
  regime-volatile-down: "#b0559a"
  desk-0: "#0b0b0c"
  desk-1: "#111113"
  desk-2: "#17171a"
  desk-3: "#1f1f23"
  desk-line: "#26262b"
  desk-line-2: "#36363d"
  desk-field: "#66666b"
  desk-ln: "#7a7a80"
  desk-text: "#ededeb"
  desk-text-2: "#a6a6ab"
  desk-text-3: "#85858b"
  desk-amber: "#e3a53c"
  desk-red: "#f0675c"
  desk-green: "#6cc287"
typography:
  display:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "88px"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "60px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  label-title:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  label-row:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  ui:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  code:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: "0px"
spacing:
  label-pad: "18px"
  gutter: "56px"
  section: "112px"
  column: "1360px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "15px 24px"
  button-ink-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-line:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "15px 24px"
  label-tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "10px 8px"
  label-tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  desk-tool-button:
    backgroundColor: "{colors.desk-0}"
    textColor: "{colors.desk-text-2}"
    rounded: "{rounded.none}"
    height: "26px"
    padding: "0 10px"
  desk-run-button:
    backgroundColor: "{colors.desk-text}"
    textColor: "{colors.desk-0}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 14px"
  desk-input:
    backgroundColor: "{colors.desk-0}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.none}"
    height: "30px"
    padding: "0 8px"
---

# Design System: Trade Receipts

## Overview

**Creative North Star: "The Strategy Facts Label"**

Every result in Trade Receipts is printed as a facts label, modeled on the FDA Nutrition Facts panel: white stock, near-black ink, rows set name-left and value-right, grouped by black rules of fixed weights. The claimed number is struck through in red beside the tested one. The label is the product's proof and its signature, so the rest of the system exists to frame it and never to outshout it.

The system has two surfaces that share one ink. **Paper** is the home page and sign-up: bold, white, typographic, built from the label's own rules and type. **Desk** is the IDE: a quiet near-black workspace in the manner of a code editor, where reports and labels print as white sheets. Wherever a label appears, on paper or on the desk, it is the same object at the same weight.

It refuses the category default of a dark fintech hero with glowing charts, and the headline-over-screenshot template. No shadows on paper, no gradients, no pills, no glows, no rounded corners.

**Key Characteristics:**
- One grotesque, Public Sans, from Regular to Black, with tabular figures everywhere.
- Black rules in four fixed weights: hairline (1px), bar (4px), mid (7px), slab (14px).
- One red, used only for contradicted, failed or trailing values.
- Square corners on everything.
- Paper for persuasion, desk for work; the label is identical on both.

## Colors

Ink on white, plus one red, plus a dark desk for the IDE; chart color appears only inside reports.

### Primary
- **Label Ink** (#111111): All paper text, rules, borders and the solid button. It is the label's ink and nothing on paper is darker.
- **Contradiction Red** (#c3261c): The strike through a claimed number, failed checks, trailing values and losing trades. Never decoration, never a link, never a brand accent.

### Secondary
- **Gain Green** (#1f7a4d): Winning trades and positive bins in report charts only, always paired with a second cue (marker shape, sign or label). It never appears in page chrome.

### Tertiary
- **Regime palette** (#1f7a4d, #4a86c8, #2f4f99, #b0559a): The four market regimes in the P&L chart, in that fixed order (calm uptrend, volatile uptrend, calm downtrend, volatile downtrend). Validated for lightness, chroma, color-vision deficiency and contrast on white. Never reordered or cycled.

### Neutral
- **Soft Ink** (#444447): Secondary paper text: sublines, report subtitles, footnotes.
- **Muted Ink** (#66666b): Struck-through claims after the strike lands, chart tick labels.
- **Label Stock** (#ffffff): The paper surface and every report sheet.
- **Stock Tint** (#f2f2ef) and **Stock Rule** (#e6e6e2): Hover fills and the disabled sign-up options.
- **Desk** (#0b0b0c → #1f1f23, four steps): The IDE's surfaces, from the editor (darkest) up through panels, inputs and selected rows.
- **Desk Lines** (#26262b, #36363d): Panel dividers and quiet control borders.
- **Desk Field** (#66666b): Input and composer borders, kept at 3:1 against their panels.
- **Desk Text** (#ededeb, #a6a6ab, #85858b): Primary, secondary and tertiary IDE text. Line numbers use #7a7a80 for 4.5:1 on the editor.
- **Desk Signals** (#e3a53c amber, #f0675c red, #6cc287 green): Problem severity, diff lines and edit counts inside the IDE, always next to an icon or a word.

### Named Rules
**The One Red Rule.** Red means the test disagreed. If a value isn't contradicted, failed or trailing, it isn't red.

**The Label Owns the Ink Rule.** Heavy rules (bar, mid, slab) live inside labels and boxed objects, where they group data. Page chrome such as the nav and section breaks takes a hairline at column width.

## Typography

**Display Font:** Public Sans Variable (with Public Sans, system-ui)
**Body Font:** Public Sans Variable
**Label/Mono Font:** JetBrains Mono, for code, file names, timestamps and run settings only

**Character:** A plain, governmental grotesque pushed to Black for headlines and label titles, and kept at Regular for reading. The contrast between weight 400 and 900 does the work that color does elsewhere.

### Hierarchy
- **Display** (900, clamp(48px, 6.4vw, 88px), 0.95): The home hero headline only. Balanced wrap, max 13ch.
- **Headline** (900, clamp(36px, 4.4vw, 60px), 1): Home section titles and the closing band.
- **Label title** (900, 56px full, 36px compact, 1): "Strategy Facts", "Company Facts", "Coin Facts".
- **Title** (900, clamp(26px, 3vw, 36px), 1.05): Report headers and tour card titles (24px).
- **Body** (400, 19px home and 14px reports, 1.55): Paragraphs, max 34–38em on paper and 62ch for report verdicts. Paragraphs wrap with `text-wrap: pretty`.
- **Label row** (700 values, 400 names, 17px full and 14px compact): Facts label rows, with tabular figures and values right-aligned.
- **UI** (400–700, 12–14px): All IDE chrome.
- **Code** (400, 12–13px, 1.6): Monaco, the narrow-screen code view, diffs and run settings.

### Named Rules
**The Tabular Rule.** Every number is set in tabular lining figures (`"tnum" 1, "lnum" 1` on body), so columns of results align without help.

**The True Minus Rule.** Negative values print with a real minus sign (−), never a hyphen.

## Layout

Paper pages use a single centered column up to 1360px with a fluid gutter of clamp(20px, 4vw, 56px). The home hero is a two-column grid (copy, then a 380–500px label column) that stacks below 960px. Sections are separated by generous vertical space, clamp(56px, 8vw, 112px), not by boxes.

The desk is a full-height three-pane IDE: file list (228px default), editor and results over a Problems panel (176px default), and the agent thread (364px default), all resizable. Below 900px the same panes show one at a time, chosen from a four-tab row (Thread, Files, Editor, Problems) under the top bar. On narrow screens the editor becomes a plain read-only code view.

Reports print as a white sheet up to 1080px wide on the desk. Their two-column pairs and stat tiles fold to one and two columns below a 760px container width.

## Elevation & Depth

Flat. Paper has no shadows at all; depth comes from rule weight and the black-on-white contrast of the label. On the desk, depth is tonal: four surface steps from #0b0b0c to #1f1f23. Floating desk elements carry one soft shadow so they separate from the panes beneath.

### Shadow Vocabulary
- **Desk popover** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45)`): The preview note and thread history, which float over panes.
- **Tour dimmer** (`box-shadow: 0 0 0 200vmax rgba(5, 5, 6, 0.72)`): The spotlight cut-out around the element the tour is pointing at.

### Named Rules
**The Paper Is Flat Rule.** Nothing printed on white casts a shadow. A label is ink on stock.

## Shapes

Square corners throughout (0px), on paper and on the desk, including buttons, inputs, tabs, popovers and the tour card. Borders do the shaping: 3–4px ink borders on paper objects (buttons, label tabs, the label itself), 1px lines on the desk. The only round shape in the system is the 6px dot that marks a file the agent just wrote.

## Components

### Buttons
- **Shape:** Square (0px), 3px ink border.
- **Primary (ink):** Ink fill, white text, weight 800. Large: 18px text, 15px × 24px padding.
- **Hover:** Inverts to white fill and ink text over 160ms.
- **Line:** White fill with the same ink border; inverts to ink on hover.
- **On the closing band:** A paper button on the ink band, inverting the other way.
- **Desk tool button:** 26px tall, 1px quiet border, 12px weight-600 text; brightens on hover.
- **Desk run button:** A solid light block (#ededeb) on the desk. When it can't run, it is disabled and the reason is printed beside it, not hidden in a tooltip.

### Chips
- **Preview chip:** A small solid light block in the IDE top bar, "Preview · example data". It opens a white note that lists what works now and what comes next.

### Cards / Containers
- **Facts label:** See below. It is the only card-like object on paper.
- **Report sheet:** White, square, padded clamp(20px, 3vw, 40px), ruled sections, ending on the receipt.
- **Tour card:** A small white label on the dark desk: 3px ink border, a mid rule under its title, ink "Next" button.

### Inputs / Fields
- **Style:** Desk inputs are #0b0b0c with a 1px #66666b border and square corners. The composer is a bordered box containing a borderless textarea.
- **Focus:** The border turns #ededeb; keyboard focus also draws a 2px light ring inset on the desk.
- **Error:** Desk red text under the field, announced as an alert, with the field marked invalid.

### Navigation
- **Paper nav:** Wordmark (22px, weight 900) left, two text links (16px, weight 600, underline on hover with 6px offset), ink Launch IDE button right, one hairline at column width beneath.
- **Label tabs:** A row of equal tabs set in the label's own rules over the label: white with ink text, the selected one solid ink. Arrow keys move between them.
- **IDE mode switch:** Two text tabs centered in the top bar, Backtest and Analyze. Grey when off, white when on, never boxed.
- **IDE file tabs:** Editor-style tabs; the active tab takes the editor's background and a 1px light top edge.

### Facts Label (signature)
The product's proof and its signature object. White stock with a 4px ink border, an 18px pad, a Black title over a hairline, the subject and test window, then a 14px slab. The claimed row prints in ink; 650ms after it appears a 4px red bar draws across the claimed value from left to right over 520ms and the row fades to muted ink. The tested value sits below on a mid rule. Rows follow with hairlines, using the mid and bar weights to group them, and a footnote closes the label. It renders identically on paper and on the desk, at full or compact size. Screen readers hear "Contradicted by the test" before the struck value.

### Product Window
A working slice of the dark IDE framed by a 4px ink border on paper, with example tabs above it. It replays an agent session: steps appear in the thread, the file types itself in, and then the report prints one part at a time. It starts only when it is on screen, holds the finished results while hovered, focused or touched, and has Pause and Replay controls. With reduced motion, it shows each example finished.

## Do's and Don'ts

### Do:
- **Do** print every result as a facts label or a report that ends on one.
- **Do** keep heavy rules (4px, 7px, 14px) inside labels, report sheets and boxed objects; give page chrome a 1px hairline at column width.
- **Do** set every number in tabular figures, with a true minus sign.
- **Do** pair every chart color with a second cue (marker shape, sign, legend or label), and put a "Show the numbers" table under every chart.
- **Do** state why a control can't act, in visible text next to it.
- **Do** label example values as examples wherever they appear.

### Don't:
- **Don't** use red for anything but a contradicted, failed or trailing value.
- **Don't** add shadows, gradients, glows, pills or rounded corners on paper.
- **Don't** run a heavy rule edge to edge across the page.
- **Don't** use a dark fintech hero with glowing charts, or a headline over a product screenshot.
- **Don't** let anything on paper outweigh the facts label.
- **Don't** leave a control that looks live but does nothing; disable it and say "coming soon", or remove it.

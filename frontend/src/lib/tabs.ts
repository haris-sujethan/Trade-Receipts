import type { KeyboardEvent } from "react";

/** Arrow keys, Home and End move between tabs and select them, as in the ARIA tabs pattern. */
export function onTablistKeyDown(e: KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  const last = tabs.length - 1;
  const next =
    e.key === "ArrowRight"
      ? (i + 1) % tabs.length
      : e.key === "ArrowLeft"
        ? (i + last) % tabs.length
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? last
            : -1;
  if (next < 0) return;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

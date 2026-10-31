import { useEffect, useState } from "react";

/** Below this width the IDE shows one pane at a time. */
const QUERY = "(max-width: 899px)";

export function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

/** Match the browser chrome to the page while it's mounted. */
export function useThemeColor(color: string) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.content;
    meta.content = color;
    return () => {
      meta.content = before;
    };
  }, [color]);
}

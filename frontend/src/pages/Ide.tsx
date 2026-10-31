import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Group, Panel, Separator } from "react-resizable-panels";
import "../monaco/setup";
import { IdeProvider } from "../ide/state";
import { TopBar } from "../ide/TopBar";
import { Explorer } from "../ide/Explorer";
import { MainArea } from "../ide/MainArea";
import { BottomPanel } from "../ide/BottomPanel";
import { Thread } from "../ide/Thread";
import { StatusBar } from "../ide/StatusBar";
import { Tour } from "../ide/Tour";
import "../ide/ide.css";

const MIN_WIDTH = 900;

function useWideEnough() {
  const [wide, setWide] = useState(() => window.innerWidth >= MIN_WIDTH);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return wide;
}

export function Ide() {
  const wide = useWideEnough();

  if (!wide) {
    return (
      <div className="theme-desk ide-narrow">
        <h1>Best on a larger screen</h1>
        <p>The IDE needs a laptop or desktop. Open this page on a wider screen to build and test strategies.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  return (
    <IdeProvider>
      <div className="theme-desk ide">
        <TopBar />
        <Group orientation="horizontal" className="ide__body" id="ide-columns">
          <Panel id="explorer" defaultSize={228} minSize={180} maxSize={420}>
            <Explorer />
          </Panel>
          <Separator className="sep sep--v" />
          <Panel id="center" minSize={420}>
            <Group orientation="vertical" id="ide-center">
              <Panel id="main" minSize={220}>
                <MainArea />
              </Panel>
              <Separator className="sep sep--h" />
              <Panel id="bottom" defaultSize={176} minSize={92} maxSize={420}>
                <BottomPanel />
              </Panel>
            </Group>
          </Panel>
          <Separator className="sep sep--v" />
          <Panel id="thread" defaultSize={364} minSize={300} maxSize={600}>
            <Thread />
          </Panel>
        </Group>
        <StatusBar />
        <Tour />
      </div>
    </IdeProvider>
  );
}

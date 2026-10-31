import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { APP_NAME } from "./config";
import { Home } from "./pages/Home";
import { SignUp } from "./pages/SignUp";

// The IDE pulls in Monaco and charts; load it only when someone opens it.
const Ide = lazy(() => import("./pages/Ide").then((m) => ({ default: m.Ide })));

const titles: Record<string, string> = {
  "/": `${APP_NAME} · Build and test trading strategies without code`,
  "/signup": `Sign up · ${APP_NAME}`,
  "/ide": `IDE · ${APP_NAME}`,
};

export function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = titles[pathname] ?? APP_NAME;
  }, [pathname]);

  return (
    <Suspense fallback={<div className="theme-desk" style={{ minHeight: "100vh" }} />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/ide" element={<Ide />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  );
}

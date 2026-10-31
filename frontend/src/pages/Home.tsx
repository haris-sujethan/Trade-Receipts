import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME, TAGLINE } from "../config";
import { FactsLabel } from "../components/FactsLabel";
import { ProductWindow } from "../components/home/ProductWindow";
import { acmeFacts, moonFacts, rsiFacts } from "../data/examples";
import { onTablistKeyDown } from "../lib/tabs";
import "./home.css";

const heroLabels = [
  { id: "backtest", tab: "Backtest", title: "Strategy Facts", facts: rsiFacts },
  { id: "stock", tab: "Stock research", title: "Company Facts", facts: acmeFacts },
  { id: "crypto", tab: "Crypto research", title: "Coin Facts", facts: moonFacts },
];

export function Home() {
  // Opens on the backtest label; the other two show on click.
  const [active, setActive] = useState(0);
  const current = heroLabels[active];

  return (
    <div className="theme-paper home">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="home-nav">
        <Link to="/" className="wordmark">
          {APP_NAME}
        </Link>
        <nav aria-label="Main">
          <a href="#examples">Examples</a>
          <a href="#how">How it works</a>
        </nav>
        <Link to="/signup" className="btn btn--ink">
          Launch IDE
        </Link>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title">Backtest any strategy. Research any stock or coin.</h1>
            <p className="hero__tagline">{TAGLINE}</p>
            <p className="hero__sub">
              Describe what you want to test or check. The agent writes the code, runs it on real data, and shows you
              the receipts.
            </p>
            <div className="hero__ctas">
              <Link to="/signup" className="btn btn--ink btn--lg">
                Launch IDE
                <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
              </Link>
              <a href="#examples" className="btn btn--line btn--lg">
                See it work
              </a>
            </div>
          </div>

          <div className="hero__label">
            <div className="label-tabs" role="tablist" aria-label="Example results" onKeyDown={onTablistKeyDown}>
              {heroLabels.map((l, i) => (
                <button
                  key={l.id}
                  id={`label-tab-${l.id}`}
                  role="tab"
                  aria-selected={i === active}
                  aria-controls="label-panel"
                  tabIndex={i === active ? 0 : -1}
                  className={i === active ? "is-on" : ""}
                  onClick={() => setActive(i)}
                >
                  {l.tab}
                </button>
              ))}
            </div>
            <div id="label-panel" role="tabpanel" aria-labelledby={`label-tab-${current.id}`}>
              <FactsLabel facts={current.facts} title={current.title} />
            </div>
          </div>
        </section>

        <section id="examples" className="showcase" aria-labelledby="showcase-title">
          <div className="section-head">
            <h2 id="showcase-title">Watch the agent work.</h2>
            <p>
              Each example replays a session in the IDE: a strategy backtested, a stock checked, a coin checked. Every
              answer comes with its receipts.
            </p>
          </div>
          <ProductWindow />
        </section>

        <section id="how" className="how" aria-labelledby="how-title">
          <h2 id="how-title" className="how__title">
            How it works
          </h2>
          <ol className="how__steps">
            <li>
              <h3>Ask</h3>
              <p>
                Describe a strategy to backtest, or name a stock or coin to research. Plain English, a chart
                screenshot, or a short clip all work.
              </p>
            </li>
            <li>
              <h3>The agent does the work</h3>
              <p>
                It writes the code, fixes its own errors, and pulls the data, in a workspace you can watch. Strategies
                come out as Pine Script for TradingView or Python.
              </p>
            </li>
            <li>
              <h3>You get the receipts</h3>
              <p>
                Backtests with trading costs included and compared with the S&amp;P 500. Research where every number
                shows where it came from. The code is yours to keep.
              </p>
            </li>
          </ol>
        </section>

        <section className="close" aria-labelledby="close-title">
          <h2 id="close-title">Test it before you trade it.</h2>
          <Link to="/signup" className="btn btn--paper">
            Launch IDE
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="home-foot">
        <p className="home-foot__name">{APP_NAME}</p>
        <p>For research and education. Not financial advice.</p>
        <p>Data from Tiingo · Crypto data: Binance Vision</p>
        <p>Built for the Meta Global AI Developer Hackathon, 2026.</p>
      </footer>
    </div>
  );
}

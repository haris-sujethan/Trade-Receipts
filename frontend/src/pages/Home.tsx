import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME, TAGLINE } from "../config";
import { FactsLabel } from "../components/FactsLabel";
import { ProductWindow } from "../components/home/ProductWindow";
import { rsiFacts } from "../data/examples";
import { tokenChecks } from "../data/tokens";
import { onTablistKeyDown } from "../lib/tabs";
import "./home.css";

const heroLabels = [
  { id: "rug", tab: "Rug check", title: "Token Facts", facts: tokenChecks.moon.facts },
  { id: "backtest", tab: "Backtest", title: "Strategy Facts", facts: rsiFacts },
];

export function Home() {
  // Opens on the rug check label; the backtest label shows on click.
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
            <h1 id="hero-title">Check the token before you buy it.</h1>
            <p className="hero__tagline">{TAGLINE}</p>
            <p className="hero__sub">
              Paste a pump.fun token or drop in the clip shilling it. The agent traces every wallet, splits independent
              buyers from the team and the bots, and scores the rug chance with a model trained on thousands of past
              tokens. It backtests crypto strategies too.
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
              Each example replays a session in the IDE: a token checked from a shill clip, a token checked from its
              mint, and a strategy backtested. Every answer comes with its receipts.
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
                Paste a pump.fun token's mint, drop in the clip shilling it, or describe a crypto strategy to backtest
                in plain English.
              </p>
            </li>
            <li>
              <h3>The agent does the work</h3>
              <p>
                It pulls the token's history from launch, traces who funded every wallet, and separates the team and the
                bots from independent buyers, in a workspace you can watch. Strategies come out as Pine Script for
                TradingView or Python, and get tested.
              </p>
            </li>
            <li>
              <h3>You get the receipts</h3>
              <p>
                A verdict and rug chance from a model trained on thousands of past tokens, explained in plain words,
                with the real chart and the bubble map as evidence. Backtests include trading costs and are compared
                with simply holding. The code is yours to keep.
              </p>
            </li>
          </ol>
        </section>

        <section className="close" aria-labelledby="close-title">
          <h2 id="close-title">See who's selling before you buy.</h2>
          <Link to="/signup" className="btn btn--paper">
            Launch IDE
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="home-foot">
        <p className="home-foot__name">{APP_NAME}</p>
        <p>For research and education. Not financial advice.</p>
        <p>Crypto data: Binance Vision</p>
        <p>Built for the Meta Global AI Developer Hackathon, 2026.</p>
      </footer>
    </div>
  );
}

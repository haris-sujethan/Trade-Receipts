import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "../config";
import { Checks } from "../demo/Checks";
import { DemoScreen } from "../demo/DemoScreen";
import "./home.css";

/** The crypto-first home: the live demo on a Mac desktop, then everything the rug check looks at. */
export function Home() {
  return (
    <div className="theme-glass hn">
      <a href="#main" className="hn-skip">
        Skip to content
      </a>
      <header className="hn-nav">
        <Link to="/" className="hn-mark">
          {APP_NAME}
        </Link>
        <nav aria-label="Main" className="hn-links">
          <a href="#demo">Demo</a>
          <a href="#checks">What we check</a>
        </nav>
        <Link to="/signup" className="hn-btn hn-btn--primary hn-btn--sm">
          Launch IDE
        </Link>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hn-hero" aria-labelledby="hn-title">
          <h1 id="hn-title">
            Check the token
            <span>before you buy it.</span>
          </h1>
          <p className="hn-lede">Paste a pump.fun link, a ticker or a token’s address.</p>
          <div className="hn-acts">
            <Link to="/signup" className="hn-btn hn-btn--primary">
              Launch IDE
            </Link>
            <a href="#checks" className="hn-btn hn-btn--line">
              What we check
            </a>
          </div>
        </section>

        <section id="demo" className="hn-demo" aria-label="Live demo">
          <DemoScreen />
        </section>

        <section id="checks" className="hn-checks" aria-labelledby="checks-title">
          <div className="hn-checks__head">
            <h2 id="checks-title">Everything we check, on every token</h2>
            <Link to="/signup" className="hn-link">
              Check a token
              <ArrowRight size={17} strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <Checks />
        </section>

        <section className="hn-close" aria-labelledby="close-title">
          <h2 id="close-title">See who’s selling before you buy.</h2>
          <p>The same IDE backtests copying a pump.fun wallet: what you’d have made buying and selling a little after it.</p>
          <Link to="/signup" className="hn-btn hn-btn--primary">
            Launch IDE
          </Link>
        </section>
      </main>

      <footer className="hn-foot">
        <p className="hn-foot__name">{APP_NAME}</p>
        <p>For research and education. Not financial advice.</p>
        <p>Token authorities: Powered by GoPlus.</p>
        <p>
          Photograph:{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Moraine_Lake_17092005.jpg">Moraine Lake by Gorgo</a> (public domain,
          Wikimedia Commons)
        </p>
        <p>Built for the Meta Global AI Developer Hackathon, 2026.</p>
      </footer>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME, PENDING_PROMPT_KEY } from "../config";
import { FactsLabel } from "../components/FactsLabel";
import { ProductWindow } from "../components/home/ProductWindow";
import { homeExamples } from "../data/examples";
import "./home.css";

export function Home() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [exampleId, setExampleId] = useState(homeExamples[0].id);
  const example = homeExamples.find((e) => e.id === exampleId) ?? homeExamples[0];

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim() || example.prompt;
    try {
      sessionStorage.setItem(PENDING_PROMPT_KEY, text);
    } catch {
      // Storage can be blocked; the IDE simply opens without a prefilled prompt.
    }
    navigate("/signup");
  }

  return (
    <div className="theme-paper home">
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

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title">Know what your strategy really does.</h1>
            <p className="hero__sub">
              Describe a trading strategy in plain English. The agent writes the code, tests it honestly against
              the S&amp;P&nbsp;500, and checks the stocks behind it against their SEC filings.
            </p>

            <form className="ask" onSubmit={submit}>
              <label htmlFor="ask-input" className="sr-only">
                Describe a strategy
              </label>
              <input
                id="ask-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={example.prompt}
                autoComplete="off"
              />
              <button type="submit" className="btn btn--ink ask__go">
                Test it
                <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
              </button>
            </form>

            <div className="tries">
              <span className="tries__lead">Or try:</span>
              <ul>
                {homeExamples.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      className={ex.id === exampleId ? "is-on" : ""}
                      aria-pressed={ex.id === exampleId}
                      onClick={() => {
                        setExampleId(ex.id);
                        setPrompt(ex.prompt);
                      }}
                    >
                      {ex.prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="hero__label">
            <FactsLabel facts={example.facts} />
          </div>
        </section>

        <section id="examples" className="showcase" aria-labelledby="showcase-title">
          <div className="section-head">
            <h2 id="showcase-title">Watch an idea become a tested strategy.</h2>
            <p>
              Each example replays a session in the IDE: the agent reads the idea, writes the code, fixes its own
              errors, and prints the label.
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
              <h3>Describe it</h3>
              <p>
                Plain English, a chart screenshot, or a short video clip. The agent pulls out the exact rules and
                shows where each one came from.
              </p>
            </li>
            <li>
              <h3>It writes the code</h3>
              <p>
                Pine Script for TradingView, or Python when a strategy needs many stocks, company filings, or
                economic data. Compile errors get fixed in a loop you can watch.
              </p>
            </li>
            <li>
              <h3>You get an honest test</h3>
              <p>
                Trading costs included, checked for repainting and look-ahead, and compared with the S&amp;P 500.
                The code is yours to keep.
              </p>
            </li>
          </ol>
        </section>

        <section className="close" aria-labelledby="close-title">
          <h2 id="close-title">Test your first strategy.</h2>
          <Link to="/signup" className="btn btn--paper">
            Launch IDE
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="home-foot">
        <p className="home-foot__name">{APP_NAME}</p>
        <p>For research and education. Not financial advice.</p>
        <p>Data from Tiingo · Crypto data: Binance Vision · Filings from SEC EDGAR</p>
        <p>Built for the Meta Global AI Developer Hackathon, 2026.</p>
      </footer>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "../config";
import "./home.css";
import "./signup.css";

export function SignUp() {
  const navigate = useNavigate();

  return (
    <div className="theme-paper signup">
      <header className="home-nav">
        <Link to="/" className="wordmark">
          {APP_NAME}
        </Link>
        <Link to="/" className="signup-back">
          Back to home
        </Link>
      </header>

      <main className="signup-main">
        <section className="signup-card" aria-labelledby="signup-title">
          <h1 id="signup-title">Create your account</h1>
          <p className="signup-status" id="signup-status">
            Sign-up opens after the hackathon.
          </p>

          <div className="signup-options" role="group" aria-describedby="signup-status">
            <button type="button" disabled>
              Continue with Google
            </button>
            <button type="button" disabled>
              Continue with GitHub
            </button>
            <button type="button" disabled>
              Continue with email
            </button>
          </div>

          <p className="signup-for">For hackathon judges and participants</p>
          <button type="button" className="btn btn--ink signup-skip" onClick={() => navigate("/ide")}>
            Meta Hackathon: skip sign-up
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden />
          </button>
          <p className="signup-fine">No account is created. Your projects are saved in this browser.</p>
        </section>
      </main>
    </div>
  );
}

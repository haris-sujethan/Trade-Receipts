import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "../config";
import { authRequired, markTourDoneOnAccount, supabase, useSession } from "../lib/auth";
import { readTourDone } from "../ide/state";
import "./home.css";
import "./signup.css";

type Mode = "signup" | "signin";

/** Sign up or sign in with an email and a password. Signed-in visitors go straight to the IDE. A visitor who has just
 * taken the tour arrives here to start using it. */
export function SignUp() {
  const session = useSession();
  const navigate = useNavigate();
  const afterTour = !!(useLocation().state as { afterTour?: boolean } | null)?.afterTour;
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "note"; text: string } | null>(null);

  if (!authRequired || session) return <Navigate to="/ide" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } = mode === "signup" ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) return setMessage({ kind: "error", text: error.message });
    if (data.session) {
      // The tour was taken before signing up: keep it done on the account, so it doesn't play again.
      if (readTourDone()) await markTourDoneOnAccount();
      return navigate("/ide");
    }
    // Sign-up with email confirmation on: the account exists once the link in the email is opened.
    setMessage({ kind: "note", text: "Check your email for a link to confirm your account, then sign in." });
  }

  const title = mode === "signup" ? "Create your account" : "Sign in";

  return (
    <div className="theme-glass hn signup">
      <header className="hn-nav">
        <Link to="/" className="hn-mark">
          {APP_NAME}
        </Link>
        <span aria-hidden />
        <Link to="/" className="hn-link signup-back">
          Back to home
        </Link>
      </header>

      <main className="signup-main">
        <section className="signup-card" aria-labelledby="signup-title">
          <h1 id="signup-title">{title}</h1>
          <p className="signup-status">
            {mode === "signin"
              ? "Welcome back."
              : afterTour
                ? "That was the tour. Create a free account to check any token, backtest any wallet, and add your own AI key."
                : "Free. An account keeps live checks fair for everyone."}
          </p>

          <form className="signup-form" onSubmit={submit}>
            <label>
              <span>Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {message && (
              <p className={message.kind === "error" ? "signup-error" : "signup-note"} role={message.kind === "error" ? "alert" : "status"}>
                {message.text}
              </p>
            )}
            <button type="submit" className="hn-btn hn-btn--primary signup-skip" disabled={busy}>
              {busy ? "One moment…" : title}
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </form>

          <p className="signup-fine">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button type="button" className="signup-switch" onClick={() => (setMode(mode === "signup" ? "signin" : "signup"), setMessage(null))}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="signup-fine">For research and education. Not financial advice.</p>
        </section>
      </main>
    </div>
  );
}

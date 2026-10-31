import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound, Lock } from "lucide-react";
import { TIINGO_KEY_STORAGE } from "../config";
import { fileById, useIde } from "./state";

function readKey() {
  try {
    return localStorage.getItem(TIINGO_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function StatusBar() {
  const { state } = useIde();
  const [hasKey, setHasKey] = useState(() => readKey() !== "");
  const [open, setOpen] = useState(false);
  const fileId = state.active?.replace(/^results:/, "");
  const file = fileId ? fileById(fileId) : undefined;
  const language = file?.kind === "pine" ? "Pine Script v6" : file?.kind === "python" ? "Python" : null;

  return (
    <footer className="status">
      <span className="status__item">{state.mode === "demo" ? "Demo project" : "My project"}</span>
      {state.mode === "personal" && file && (
        <span className="status__item">
          <Lock size={11} aria-hidden /> Examples · read-only
        </span>
      )}
      {language && <span className="status__item">{language}</span>}

      <span className="status__spacer" />

      <span className="status__key">
        <button className="status__item status__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <KeyRound size={12} aria-hidden />
          {hasKey ? "Tiingo key: saved" : "Tiingo key: not set"}
        </button>
        {open && (
          <KeyPopover
            onClose={() => setOpen(false)}
            onSaved={() => {
              setHasKey(true);
              setOpen(false);
            }}
          />
        )}
      </span>
      <span className="status__item">Muse Spark 1.3</span>
      <span className="status__item">For research and education. Not financial advice.</span>
    </footer>
  );
}

function KeyPopover({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(readKey());
  const [error, setError] = useState("");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length < 20) {
      setError("That doesn't look like a Tiingo key. Copy it from your Tiingo account page.");
      return;
    }
    try {
      localStorage.setItem(TIINGO_KEY_STORAGE, value.trim());
      onSaved();
    } catch {
      setError("Couldn't save the key in this browser. Check that site storage is allowed.");
    }
  }

  return (
    <form className="keypop" ref={ref} onSubmit={save} aria-label="Tiingo key">
      <p className="keypop__title">Stock runs use your own free Tiingo key</p>
      <p className="keypop__body">
        Signing up takes a minute. The key stays in this browser and is only sent with stock data requests.
      </p>
      <label htmlFor="tiingo-key" className="sr-only">
        Tiingo key
      </label>
      <input
        id="tiingo-key"
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        placeholder="Paste your Tiingo key"
        autoComplete="off"
      />
      {error && <p className="keypop__error">{error}</p>}
      <div className="keypop__actions">
        <a href="https://www.tiingo.com" target="_blank" rel="noreferrer">
          Get a free key
        </a>
        <button type="button" className="tool-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="tool-btn tool-btn--solid">
          Save key
        </button>
      </div>
    </form>
  );
}

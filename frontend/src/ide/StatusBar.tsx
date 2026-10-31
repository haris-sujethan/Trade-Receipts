import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { KeyRound, Lock } from "lucide-react";
import { TIINGO_KEY_STORAGE } from "../config";
import { fileById, fileOf, useIde } from "./state";

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
  const button = useRef<HTMLButtonElement>(null);
  const file = fileById(fileOf(state.active));
  const language = file?.kind === "pine" ? "Pine Script v6" : file?.kind === "python" ? "Python" : null;

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }

  return (
    <footer className="status">
      <span className="status__item">Demo project</span>
      {file && (
        <span className="status__item status__wide">
          <Lock size={11} aria-hidden /> Read-only
        </span>
      )}
      {language && <span className="status__item status__wide">{language}</span>}

      <span className="status__spacer" />

      <span className="status__key">
        <button
          ref={button}
          className="status__item status__btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="tiingo-key-form"
        >
          <KeyRound size={12} aria-hidden />
          {hasKey ? "Tiingo key: saved" : "Tiingo key: not set"}
        </button>
        {open && (
          <KeyPopover
            onClose={close}
            onSaved={() => {
              setHasKey(true);
              close();
            }}
          />
        )}
      </span>
      <span className="status__item status__wide">Muse Spark 1.3</span>
      <span className="status__item">Not financial advice</span>
    </footer>
  );
}

function KeyPopover({ onClose, onSaved }: { onClose: (returnFocus?: boolean) => void; onSaved: () => void }) {
  const [value, setValue] = useState(readKey());
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Reads the latest close handler without re-running the listener effect when the parent re-renders.
  const dismiss = useEffectEvent((returnFocus: boolean) => onClose(returnFocus));

  // Focus the field once, when the popover opens.
  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(true);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // A click elsewhere closes it and leaves focus where the click put it.
      if (!form.current?.parentElement?.contains(target)) dismiss(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  function save(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length < 20) {
      setError("That doesn't look like a Tiingo key. Copy it from your Tiingo account page.");
      input.current?.focus();
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
    <form id="tiingo-key-form" className="keypop" ref={form} onSubmit={save} aria-label="Tiingo key" noValidate>
      <p className="keypop__title">Stock runs will use your own free Tiingo key</p>
      <p className="keypop__body">
        Runs aren't connected in this preview. A key you add now stays in this browser and is used once they are.
      </p>
      <label htmlFor="tiingo-key" className="sr-only">
        Tiingo key
      </label>
      <input
        ref={input}
        id="tiingo-key"
        name="tiingo-key"
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        placeholder="Paste your Tiingo key…"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "tiingo-key-error" : undefined}
      />
      {error && (
        <p id="tiingo-key-error" className="keypop__error" role="alert">
          {error}
        </p>
      )}
      <div className="keypop__actions">
        <a href="https://www.tiingo.com" target="_blank" rel="noreferrer">
          Get a free key
        </a>
        <button type="button" className="tool-btn" onClick={() => onClose()}>
          Cancel
        </button>
        <button type="submit" className="tool-btn tool-btn--solid">
          Save key
        </button>
      </div>
    </form>
  );
}

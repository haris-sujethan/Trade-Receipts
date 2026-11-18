import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { DEFAULT_MODEL, PROVIDER_NAME, readAiKey, saveAiKey, type Provider } from "../lib/aiKey";

/** Opens the Settings dialog from anywhere in the IDE. */
export function openSettings() {
  window.dispatchEvent(new Event("open-settings"));
}

const KEY_HELP: Record<Provider, { url: string; shape: string }> = {
  openai: { url: "https://platform.openai.com/api-keys", shape: "sk-" },
  anthropic: { url: "https://console.anthropic.com/settings/keys", shape: "sk-ant-" },
};

/**
 * Settings: the visitor's own AI key. Checks and backtests run without one; the key adds the agent's written
 * explanations and answers to questions. It stays in this browser and is sent only with the visitor's requests.
 */
export function Settings() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-settings", show);
    return () => window.removeEventListener("open-settings", show);
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="settings" aria-labelledby="settings-title" onClose={() => setOpen(false)}>
      {open && <KeyForm onDone={() => setOpen(false)} />}
    </dialog>
  );
}

function KeyForm({ onDone }: { onDone: () => void }) {
  const saved = readAiKey();
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? "openai");
  const [key, setKey] = useState(saved?.key ?? "");
  const [model, setModel] = useState(saved?.model ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k.startsWith(KEY_HELP[provider].shape)) return setError(`${PROVIDER_NAME[provider]} keys start with “${KEY_HELP[provider].shape}”.`);
    saveAiKey({ provider, key: k, model: model.trim() || DEFAULT_MODEL[provider] });
    onDone();
  }

  function forget() {
    saveAiKey(null);
    setKey("");
    onDone();
  }

  return (
    <form className="settings__form" onSubmit={submit} method="dialog">
      <div className="settings__head">
        <h2 id="settings-title">Settings</h2>
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Close settings" onClick={onDone}>
          <X size={16} aria-hidden />
        </button>
      </div>

      <p className="settings__lede">
        Checks and backtests run without a key. Add your own OpenAI or Anthropic key and the agent explains each result and
        answers your questions, billed to your account.
      </p>

      <fieldset className="settings__providers">
        <legend>Provider</legend>
        {(["openai", "anthropic"] as const).map((p) => (
          <label key={p} className={provider === p ? "is-on" : ""}>
            <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => (setProvider(p), setError(null))} />
            {PROVIDER_NAME[p]}
          </label>
        ))}
      </fieldset>

      <label className="settings__field">
        <span>API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          placeholder={`${KEY_HELP[provider].shape}…`}
          onChange={(e) => (setKey(e.target.value), setError(null))}
          aria-describedby="settings-key-note"
        />
      </label>
      <p id="settings-key-note" className="settings__note">
        Kept in this browser only and sent with your own requests; Trade Receipts never stores it.{" "}
        <a href={KEY_HELP[provider].url} target="_blank" rel="noreferrer">
          Get a {PROVIDER_NAME[provider]} key
        </a>
      </p>

      <label className="settings__field">
        <span>Model</span>
        <input type="text" spellCheck={false} value={model} placeholder={DEFAULT_MODEL[provider]} onChange={(e) => setModel(e.target.value)} />
      </label>

      {error && (
        <p className="settings__error" role="alert">
          {error}
        </p>
      )}

      <div className="settings__actions">
        {saved && (
          <button type="button" className="tool-btn" onClick={forget}>
            Forget key
          </button>
        )}
        <span className="settings__spacer" />
        <button type="submit" className="run-btn" disabled={!key.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

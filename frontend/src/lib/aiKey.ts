/**
 * The visitor's own AI key: OpenAI or Anthropic. It stays in this browser (localStorage) and goes out only as
 * headers on the visitor's own agent requests; the backend uses it for that request and never stores it.
 */
export type Provider = "openai" | "anthropic";
export type AiKey = { provider: Provider; key: string; model: string };

const STORE = "ai.key";

export const DEFAULT_MODEL: Record<Provider, string> = { openai: "gpt-5", anthropic: "claude-opus-5-5" };
export const PROVIDER_NAME: Record<Provider, string> = { openai: "OpenAI", anthropic: "Anthropic" };

export function readAiKey(): AiKey | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return v && (v.provider === "openai" || v.provider === "anthropic") && typeof v.key === "string" && v.key ? v : null;
  } catch {
    return null;
  }
}

export function saveAiKey(k: AiKey | null) {
  try {
    if (k) localStorage.setItem(STORE, JSON.stringify(k));
    else localStorage.removeItem(STORE);
  } catch {
    // Without storage the key lasts until the page closes.
  }
  window.dispatchEvent(new Event("ai-key"));
}

/** The headers that carry the key on an agent request. */
export function aiHeaders(): Record<string, string> {
  const k = readAiKey();
  return k ? { "X-AI-Provider": k.provider, "X-AI-Key": k.key, "X-AI-Model": k.model || DEFAULT_MODEL[k.provider] } : {};
}

// Terminal relay configuration & validation.
// Stored per-browser in localStorage; ConnectDialog reads via getRelayUrl().

const KEY = "ac.terminal.relay";
const ENV_URL = (import.meta.env.VITE_TERMINAL_RELAY_URL as string | undefined) ?? "";

export type RelayConfig = {
  url: string;
  validatedAt: string | null; // ISO timestamp of last successful handshake
  latencyMs: number | null;
};

export const loadRelayConfig = (): RelayConfig | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as RelayConfig;
  } catch {
    /* ignore */
  }
  if (ENV_URL) return { url: ENV_URL, validatedAt: null, latencyMs: null };
  return null;
};

export const saveRelayConfig = (cfg: RelayConfig) => {
  localStorage.setItem(KEY, JSON.stringify(cfg));
};

export const clearRelayConfig = () => localStorage.removeItem(KEY);

/** Returns the validated relay URL, or undefined if not configured/validated. */
export const getRelayUrl = (): string | undefined => {
  const cfg = loadRelayConfig();
  if (cfg?.url && cfg.validatedAt) return cfg.url;
  return undefined;
};

/** Suggest a relay URL based on a workspace/org slug. */
export const suggestRelayUrl = (slug?: string | null): string => {
  const s = (slug || "workspace").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32) || "workspace";
  return `wss://relay-${s}.ac-relay.africa/ws`;
};

export type ValidateResult =
  | { ok: true; latencyMs: number }
  | { ok: false; error: string };

/**
 * Open a WebSocket against the relay's `/health` (falling back to the base URL)
 * and resolve as soon as the connection opens. Times out after `timeoutMs`.
 */
export const validateRelay = (rawUrl: string, timeoutMs = 6000): Promise<ValidateResult> =>
  new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      resolve({ ok: false, error: "Invalid URL" });
      return;
    }
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      resolve({ ok: false, error: "Relay URL must use ws:// or wss://" });
      return;
    }

    const probe = new URL(url.toString());
    if (!probe.pathname || probe.pathname === "/") probe.pathname = "/health";

    const started = performance.now();
    let settled = false;
    let ws: WebSocket;
    const finish = (r: ValidateResult) => {
      if (settled) return;
      settled = true;
      try { ws?.close(); } catch { /* noop */ }
      resolve(r);
    };

    const timer = window.setTimeout(
      () => finish({ ok: false, error: `Timed out after ${timeoutMs}ms` }),
      timeoutMs,
    );

    try {
      ws = new WebSocket(probe.toString());
      ws.onopen = () => {
        window.clearTimeout(timer);
        finish({ ok: true, latencyMs: Math.round(performance.now() - started) });
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        finish({ ok: false, error: "Relay refused the WebSocket handshake" });
      };
    } catch (e) {
      window.clearTimeout(timer);
      finish({ ok: false, error: (e as Error).message });
    }
  });

// Terminal relay configuration & per-route validation.
// Connect for a given resource kind (compute → /ssh, database → /db) is gated
// on the matching route having passed validation.

const KEY = "ac.terminal.relay";
const ENV_URL = (import.meta.env.VITE_TERMINAL_RELAY_URL as string | undefined) ?? "";

export type RelayRoute = "health" | "ssh" | "db";

export type RouteStatus = {
  validatedAt: string | null;
  latencyMs: number | null;
  error: string | null;
};

export type RelayConfig = {
  url: string;
  routes: Record<RelayRoute, RouteStatus>;
};

const emptyRoute = (): RouteStatus => ({ validatedAt: null, latencyMs: null, error: null });

const blankConfig = (url: string): RelayConfig => ({
  url,
  routes: { health: emptyRoute(), ssh: emptyRoute(), db: emptyRoute() },
});

export const ROUTE_PATHS: Record<RelayRoute, string> = {
  health: "/health",
  ssh: "/ssh",
  db: "/db",
};

export const loadRelayConfig = (): RelayConfig | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RelayConfig> & { url: string };
      // Backfill missing route entries (older shape).
      const base = blankConfig(parsed.url);
      return { url: parsed.url, routes: { ...base.routes, ...(parsed.routes ?? {}) } };
    }
  } catch {
    /* ignore */
  }
  if (ENV_URL) return blankConfig(ENV_URL);
  return null;
};

export const saveRelayConfig = (cfg: RelayConfig) => {
  localStorage.setItem(KEY, JSON.stringify(cfg));
};

export const clearRelayConfig = () => localStorage.removeItem(KEY);

/** True when the route the kind needs has been validated. */
export const isRouteReady = (cfg: RelayConfig | null, route: RelayRoute): boolean =>
  !!cfg?.url && !!cfg.routes[route]?.validatedAt;

/** Returns the relay base URL only when the route Connect needs is ready. */
export const getRelayUrlForRoute = (route: RelayRoute): string | undefined => {
  const cfg = loadRelayConfig();
  return isRouteReady(cfg, route) ? cfg!.url : undefined;
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
 * Open a WebSocket handshake against `<relay>/<route-path>` and resolve as soon
 * as the connection opens. Times out after `timeoutMs`. Used for /health, /ssh
 * and /db separately so each Connect surface can be unlocked independently.
 */
export const validateRelay = (
  rawUrl: string,
  route: RelayRoute = "health",
  timeoutMs = 6000,
): Promise<ValidateResult> =>
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
    const base = probe.pathname.replace(/\/$/, "");
    probe.pathname = `${base}${ROUTE_PATHS[route]}`;

    const started = performance.now();
    let settled = false;
    let ws: WebSocket;
    const finish = (r: ValidateResult) => {
      if (settled) return;
      settled = true;
      try { ws?.close(); } catch { /* noop */ }
      resolve(r);
    };

    const timer = (typeof window !== "undefined" ? window : globalThis).setTimeout(
      () => finish({ ok: false, error: `Timed out after ${timeoutMs}ms` }),
      timeoutMs,
    );

    try {
      ws = new WebSocket(probe.toString());
      ws.onopen = () => {
        clearTimeout(timer);
        finish({ ok: true, latencyMs: Math.round(performance.now() - started) });
      };
      ws.onerror = () => {
        clearTimeout(timer);
        finish({ ok: false, error: `Relay refused WebSocket upgrade on ${ROUTE_PATHS[route]}` });
      };
    } catch (e) {
      clearTimeout(timer);
      finish({ ok: false, error: (e as Error).message });
    }
  });

/** Validate one route and persist the result into the saved config. */
export const validateAndPersistRoute = async (
  url: string,
  route: RelayRoute,
): Promise<ValidateResult> => {
  const result = await validateRelay(url, route);
  const existing = loadRelayConfig();
  const cfg: RelayConfig = existing && existing.url === url ? existing : blankConfig(url);
  cfg.url = url;
  cfg.routes[route] = result.ok
    ? { validatedAt: new Date().toISOString(), latencyMs: result.latencyMs, error: null }
    : { validatedAt: null, latencyMs: null, error: result.error };
  saveRelayConfig(cfg);
  return result;
};

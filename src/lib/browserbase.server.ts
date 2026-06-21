/**
 * Browserbase REST client — SERVER-ONLY.
 *
 * Uses BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID, read inside functions
 * (not at module scope) so secrets never leak to client bundles or static
 * analysis. The `.server.ts` suffix also blocks this file from client builds.
 *
 * Strategy for credential-free session capture: we use Browserbase's
 * "Contexts" feature. When a session is created with
 * `browserSettings.context.persist = true`, Browserbase saves the browser
 * profile (cookies + localStorage) to the context on session end. We then
 * store ONLY the contextId (encrypted) — Browserbase holds the actual
 * cookies under our project. We NEVER see or store the client's username
 * or password.
 */

const BASE = "https://api.browserbase.com/v1";

function env() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not set");
  if (!projectId) throw new Error("BROWSERBASE_PROJECT_ID is not set");
  return { apiKey, projectId };
}

async function bb<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { apiKey } = env();
  const headers: Record<string, string> = {
    "X-BB-API-Key": apiKey,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Browserbase ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type BBSession = {
  id: string;
  status: string;
  contextId?: string;
};

export type BBDebug = {
  debuggerFullscreenUrl: string;
  debuggerUrl: string;
  wsUrl: string;
  pages?: Array<{ id: string; url: string; debuggerUrl: string; debuggerFullscreenUrl: string }>;
};

export async function createContext(): Promise<{ id: string }> {
  const { projectId } = env();
  return bb<{ id: string }>("/contexts", {
    method: "POST",
    json: { projectId },
  });
}

export async function createSession(opts: {
  contextId: string;
  persist?: boolean;
}): Promise<BBSession> {
  const { projectId } = env();
  return bb<BBSession>("/sessions", {
    method: "POST",
    json: {
      projectId,
      browserSettings: {
        context: { id: opts.contextId, persist: opts.persist ?? true },
        viewport: { width: 1280, height: 800 },
      },
      keepAlive: false,
    },
  });
}

export async function getDebugUrls(sessionId: string): Promise<BBDebug> {
  return bb<BBDebug>(`/sessions/${sessionId}/debug`, { method: "GET" });
}

export async function endSession(sessionId: string): Promise<void> {
  const { projectId } = env();
  await bb(`/sessions/${sessionId}`, {
    method: "POST",
    json: { projectId, status: "REQUEST_RELEASE" },
  });
}

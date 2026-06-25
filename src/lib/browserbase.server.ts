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

function sanitizeApiBody(text: string): string {
  const noHtml = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return noHtml.length > 300 ? `${noHtml.slice(0, 300)}…` : noHtml;
}

/** Thrown on non-2xx Browserbase REST responses — carries status + sanitized body. */
export class BrowserbaseApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Browserbase ${status}: ${body}`);
    this.name = "BrowserbaseApiError";
    this.status = status;
    this.body = body;
  }
}

export function browserbaseEnvCheck(): { hasApiKey: boolean; hasProjectId: boolean } {
  return {
    hasApiKey: Boolean(process.env.BROWSERBASE_API_KEY),
    hasProjectId: Boolean(process.env.BROWSERBASE_PROJECT_ID),
  };
}

export function parseBrowserbaseError(err: unknown): { status: number | null; message: string } {
  if (err instanceof BrowserbaseApiError) {
    return { status: err.status, message: err.body };
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/^Browserbase (\d+): ([\s\S]*)$/);
  if (match) {
    return { status: Number(match[1]), message: match[2].slice(0, 300) };
  }
  if (msg.includes("BROWSERBASE_API_KEY")) {
    return { status: null, message: "BROWSERBASE_API_KEY is not set" };
  }
  if (msg.includes("BROWSERBASE_PROJECT_ID")) {
    return { status: null, message: "BROWSERBASE_PROJECT_ID is not set" };
  }
  return { status: null, message: msg.slice(0, 300) };
}

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
    throw new BrowserbaseApiError(res.status, sanitizeApiBody(text));
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type BBSession = {
  id: string;
  status: string;
  contextId?: string;
};

export type BBSessionListItem = {
  id: string;
  status: string;
  projectId: string;
  startedAt?: string;
  createdAt?: string;
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

function parseSessionList(raw: unknown): BBSessionListItem[] {
  if (Array.isArray(raw)) return raw as BBSessionListItem[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { sessions?: unknown }).sessions)) {
    return (raw as { sessions: BBSessionListItem[] }).sessions;
  }
  return [];
}

export type ReleaseRunningSessionsOpts = {
  /** Release only sessions started before now − this many ms. Omit to release all running. */
  olderThanMs?: number;
  /** Never release these session IDs (actively tracked in-flight connects). */
  exceptSessionIds?: ReadonlySet<string>;
};

export async function listRunningSessions(): Promise<BBSessionListItem[]> {
  const { projectId } = env();
  const raw = await bb<unknown>("/sessions?status=RUNNING", { method: "GET" });
  return parseSessionList(raw).filter((s) => s.projectId === projectId);
}

export type OrphanCleanupStats = {
  orphanCleanupRan: boolean;
  runningSessionsFound: number;
  sessionsReleased: number;
  listError?: string;
};

/**
 * Release RUNNING sessions for this project except actively-tracked IDs.
 * Call before every new connect attempt to clear orphan/zombie sessions.
 */
export async function releaseOrphanSessions(
  protectedSessionIds: ReadonlySet<string> = new Set(),
): Promise<OrphanCleanupStats> {
  let sessions: BBSessionListItem[];
  try {
    sessions = await listRunningSessions();
  } catch (err) {
    const listError = err instanceof Error ? err.message : String(err);
    console.error("[browserbase] list RUNNING sessions failed:", listError);
    return {
      orphanCleanupRan: true,
      runningSessionsFound: 0,
      sessionsReleased: 0,
      listError: listError.slice(0, 300),
    };
  }

  const runningSessionsFound = sessions.length;
  const toRelease = sessions.filter((s) => !protectedSessionIds.has(s.id));
  if (toRelease.length === 0) {
    return { orphanCleanupRan: true, runningSessionsFound, sessionsReleased: 0 };
  }

  await Promise.all(
    toRelease.map((s) =>
      endSession(s.id).catch((err) => {
        console.warn(
          `[browserbase] endSession ${s.id} failed:`,
          err instanceof Error ? err.message : err,
        );
      }),
    ),
  );
  return {
    orphanCleanupRan: true,
    runningSessionsFound,
    sessionsReleased: toRelease.length,
  };
}

/**
 * List RUNNING sessions for this project and request release on each match.
 * Browserbase enforces a concurrent-session cap (default 3); abandoned sessions
 * from prior connect attempts block new ones with HTTP 429.
 */
export async function releaseRunningSessions(
  opts: ReleaseRunningSessionsOpts = {},
): Promise<number> {
  const sessions = await listRunningSessions();
  const now = Date.now();
  const cutoff = opts.olderThanMs !== undefined ? now - opts.olderThanMs : null;
  const except = opts.exceptSessionIds ?? new Set<string>();

  const toRelease = sessions.filter((s) => {
    if (except.has(s.id)) return false;
    if (cutoff === null) return true;
    const started = s.startedAt ?? s.createdAt;
    if (!started) return true;
    return new Date(started).getTime() < cutoff;
  });

  if (toRelease.length === 0) return 0;

  await Promise.all(
    toRelease.map((s) =>
      endSession(s.id).catch((err) => {
        console.warn(
          `[browserbase] endSession ${s.id} failed:`,
          err instanceof Error ? err.message : err,
        );
      }),
    ),
  );
  return toRelease.length;
}

export class BrowserbaseCapacityError extends Error {
  constructor() {
    super("BROWSERBASE_CAPACITY_EXHAUSTED");
    this.name = "BrowserbaseCapacityError";
  }
}

export function isBrowserbaseConcurrentLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    message.includes("429") ||
    lower.includes("concurrent") ||
    lower.includes("rate limit") ||
    lower.includes("session limit")
  );
}

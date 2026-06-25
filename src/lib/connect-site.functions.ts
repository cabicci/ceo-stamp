/**
 * Connected-sites server functions.
 *
 * SECURITY:
 * - All Browserbase + crypto calls live behind these server functions.
 * - We never accept or persist usernames/passwords. The client logs into
 *   their own site inside Browserbase's managed browser; we only persist
 *   the resulting session handle (Browserbase contextId), encrypted at rest.
 * - Server-only modules are loaded with dynamic import() inside handlers so
 *   nothing from `.server.ts` leaks into route/client bundles.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({ connectedSiteId: z.string().uuid() });
const CaptureInput = z.object({
  connectedSiteId: z.string().uuid(),
  sessionId: z.string().min(1),
});
const AbandonInput = z.object({
  connectedSiteId: z.string().uuid(),
  sessionId: z.string().min(1).optional(),
});

const ACTIVE_CONNECT_MS = 2 * 60 * 1000;

/** TEMPORARY — surfaced in connect error banner when startConnectSession fails. */
export type ConnectStartDebugInfo = {
  hasApiKey: boolean;
  hasProjectId: boolean;
  orphanCleanupRan: boolean;
  runningSessionsFound: number;
  sessionsReleased: number;
  retriedAfter429: boolean;
  createStatus: number | null;
  createMessage: string | null;
  failurePhase: string;
  contextIdPrefix: string | null;
  listError?: string | null;
  supabaseError?: string | null;
};

function truncateDebug(msg: string): string {
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

function buildStartDebugInfo(
  partial: Omit<ConnectStartDebugInfo, "hasApiKey" | "hasProjectId"> & {
    hasApiKey?: boolean;
    hasProjectId?: boolean;
  },
): ConnectStartDebugInfo {
  const env = partial.hasApiKey !== undefined
    ? { hasApiKey: partial.hasApiKey, hasProjectId: partial.hasProjectId! }
    : (() => {
        // Lazy import avoided — env check is sync via process.env in handler
        return {
          hasApiKey: Boolean(process.env.BROWSERBASE_API_KEY),
          hasProjectId: Boolean(process.env.BROWSERBASE_PROJECT_ID),
        };
      })();
  return {
    hasApiKey: partial.hasApiKey ?? env.hasApiKey,
    hasProjectId: partial.hasProjectId ?? env.hasProjectId,
    orphanCleanupRan: partial.orphanCleanupRan,
    runningSessionsFound: partial.runningSessionsFound,
    sessionsReleased: partial.sessionsReleased,
    retriedAfter429: partial.retriedAfter429,
    createStatus: partial.createStatus,
    createMessage: partial.createMessage,
    failurePhase: partial.failurePhase,
    contextIdPrefix: partial.contextIdPrefix,
    listError: partial.listError ?? null,
    supabaseError: partial.supabaseError ?? null,
  };
}

function classifyStartError(err: unknown): string {
  if (err instanceof Error && err.name === "BrowserbaseCapacityError") {
    return "connectedSites.errors.browserbaseCapacity";
  }
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("BROWSERBASE_API_KEY") ||
    message.includes("BROWSERBASE_PROJECT_ID") ||
    message.includes("Browserbase 401") ||
    message.includes("Browserbase 403")
  ) {
    return "connectedSites.errors.browserbaseNotConfigured";
  }
  if (message.includes("SESSION_ENCRYPTION_KEY")) {
    return "connectedSites.errors.sessionEncryptionNotConfigured";
  }
  if (
    message.includes("429") ||
    message.includes("BROWSERBASE_CAPACITY_EXHAUSTED") ||
    message.toLowerCase().includes("concurrent") ||
    message.toLowerCase().includes("rate limit")
  ) {
    return "connectedSites.errors.browserbaseCapacity";
  }
  return "connectedSites.errors.sessionStartFailed";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function getProtectedConnectingSessionIds(sb: SupabaseClient): Promise<{
  ids: Set<string>;
  error: string | null;
}> {
  const cutoff = new Date(Date.now() - ACTIVE_CONNECT_MS).toISOString();
  const { data, error } = await sb
    .from("connected_sites")
    .select("browserbase_session_id")
    .eq("status", "connecting")
    .gte("connect_started_at", cutoff)
    .not("browserbase_session_id", "is", null);

  if (error) {
    return { ids: new Set(), error: error.message };
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.browserbase_session_id) ids.add(row.browserbase_session_id as string);
  }
  return { ids, error: null };
}

/** Mark stale in-flight connects as disconnected so their sessions become orphans. */
async function expireStaleConnectingRows(sb: SupabaseClient): Promise<string | null> {
  const cutoff = new Date(Date.now() - ACTIVE_CONNECT_MS).toISOString();
  const { error } = await sb
    .from("connected_sites")
    .update({
      status: "disconnected",
      browserbase_session_id: null,
      connect_started_at: null,
      error_message: null,
    })
    .eq("status", "connecting")
    .lt("connect_started_at", cutoff);

  return error?.message ?? null;
}

type OpenSessionDebug = {
  orphanCleanupRan: boolean;
  runningSessionsFound: number;
  sessionsReleased: number;
  retriedAfter429: boolean;
  createStatus: number | null;
  createMessage: string | null;
  listError?: string | null;
};

async function openConnectBrowserSession(
  bb: typeof import("./browserbase.server"),
  contextId: string,
  protectedSessionIds: ReadonlySet<string>,
): Promise<{ session: Awaited<ReturnType<typeof bb.createSession>>; debug: OpenSessionDebug }> {
  const cleanup = await bb.releaseOrphanSessions(protectedSessionIds);
  if (cleanup.sessionsReleased > 0) {
    console.warn(
      `[startConnectSession] released ${cleanup.sessionsReleased} orphan Browserbase session(s)`,
    );
  }

  const debug: OpenSessionDebug = {
    orphanCleanupRan: cleanup.orphanCleanupRan,
    runningSessionsFound: cleanup.runningSessionsFound,
    sessionsReleased: cleanup.sessionsReleased,
    retriedAfter429: false,
    createStatus: null,
    createMessage: null,
    listError: cleanup.listError ?? null,
  };

  const attemptCreate = async (): Promise<Awaited<ReturnType<typeof bb.createSession>>> => {
    try {
      return await bb.createSession({ contextId, persist: true });
    } catch (err) {
      const parsed = bb.parseBrowserbaseError(err);
      debug.createStatus = parsed.status;
      debug.createMessage = parsed.message;
      throw err;
    }
  };

  try {
    const session = await attemptCreate();
    return { session, debug };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!bb.isBrowserbaseConcurrentLimitError(msg)) throw err;

    const extraReleased = await bb.releaseRunningSessions();
    debug.sessionsReleased += extraReleased;
    debug.retriedAfter429 = true;
    console.warn(
      `[startConnectSession] concurrent limit — released ${extraReleased} running session(s), retrying`,
    );
    await new Promise((r) => setTimeout(r, 1000));

    try {
      const session = await attemptCreate();
      return { session, debug };
    } catch (retryErr) {
      const parsed = bb.parseBrowserbaseError(retryErr);
      debug.createStatus = parsed.status;
      debug.createMessage = parsed.message;
      throw new bb.BrowserbaseCapacityError();
    }
  }
}

async function endBrowserbaseSession(
  bb: typeof import("./browserbase.server"),
  sessionId: string | null | undefined,
): Promise<void> {
  if (!sessionId) return;
  await bb.endSession(sessionId).catch((err) => {
    console.warn(
      `[connect] endSession ${sessionId} failed:`,
      err instanceof Error ? err.message : err,
    );
  });
}

async function assertOwnsSite(
  supabase: ReturnType<typeof Object>,
  connectedSiteId: string,
  userId: string,
) {
  const sb = supabase as SupabaseClient;
  const { data, error } = await sb
    .from("connected_sites")
    .select("id, project_id, login_url, projects!inner(owner_id)")
    .eq("id", connectedSiteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("الموقع المربوط غير موجود");
  if (data.projects?.owner_id !== userId) throw new Error("غير مصرح");
  return data as { id: string; project_id: string; login_url: string };
}

export const startConnectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const site = await assertOwnsSite(supabase, data.connectedSiteId, userId);

    const bb = await import("./browserbase.server");
    const crypto = await import("./crypto.server");
    const sb = supabase as SupabaseClient;

    let sessionIdToRelease: string | null = null;
    let failurePhase = "init";
    let openDebug: OpenSessionDebug | null = null;
    let contextIdPrefix: string | null = null;
    let supabaseError: string | null = null;
    const envCheck = {
      hasApiKey: Boolean(process.env.BROWSERBASE_API_KEY),
      hasProjectId: Boolean(process.env.BROWSERBASE_PROJECT_ID),
    };

    try {
      failurePhase = "expireStaleConnecting";
      const staleErr = await expireStaleConnectingRows(sb);
      if (staleErr) {
        supabaseError = truncateDebug(staleErr);
        throw new Error(`Supabase expireStaleConnecting: ${staleErr}`);
      }

      failurePhase = "getProtectedIds";
      const protectedSessions = await getProtectedConnectingSessionIds(sb);
      if (protectedSessions.error) {
        supabaseError = truncateDebug(protectedSessions.error);
        throw new Error(`Supabase getProtectedIds: ${protectedSessions.error}`);
      }

      failurePhase = "loadExistingContext";
      const { data: existing, error: existingErr } = await sb
        .from("connected_sites")
        .select("session_data_encrypted")
        .eq("id", site.id)
        .maybeSingle();
      if (existingErr) {
        supabaseError = truncateDebug(existingErr.message);
        throw new Error(existingErr.message);
      }

      let contextId: string | null = null;
      if (existing?.session_data_encrypted) {
        try {
          const parsed = JSON.parse(crypto.decrypt(existing.session_data_encrypted));
          if (parsed?.contextId) contextId = parsed.contextId as string;
        } catch {
          /* corrupt or old shape — fall through and create a new context */
        }
      }

      failurePhase = "createContext";
      if (!contextId) {
        const ctx = await bb.createContext();
        contextId = ctx.id;
      }
      contextIdPrefix = contextId.slice(0, 12);

      failurePhase = "createSession";
      const opened = await openConnectBrowserSession(bb, contextId, protectedSessions.ids);
      openDebug = opened.debug;
      const session = opened.session;
      sessionIdToRelease = session.id;

      failurePhase = "getDebugUrls";
      const debug = await bb.getDebugUrls(session.id);

      failurePhase = "cdpNavigate";
      const cdpNav = await import("./browserbase-cdp.server");
      const nav = await cdpNav.navigateBrowserbaseDebugPage(debug, site.login_url);
      const loginNavigationFailed = !nav.ok;

      failurePhase = "dbUpdateConnecting";
      const connectStartedAt = new Date().toISOString();
      const handle = crypto.encrypt(
        JSON.stringify({
          contextId,
          startedAt: connectStartedAt,
          browserbaseSessionId: session.id,
        }),
      );

      const { error: updateErr } = await sb
        .from("connected_sites")
        .update({
          status: "connecting",
          error_message: null,
          session_data_encrypted: handle,
          browserbase_session_id: session.id,
          connect_started_at: connectStartedAt,
        })
        .eq("id", site.id);
      if (updateErr) {
        supabaseError = truncateDebug(updateErr.message);
        throw new Error(updateErr.message);
      }

      sessionIdToRelease = null;
      return {
        ok: true as const,
        sessionId: session.id,
        contextId,
        loginUrl: site.login_url,
        liveViewUrl: debug.debuggerFullscreenUrl,
        loginNavigationFailed,
        debugInfo: loginNavigationFailed ? nav.debugInfo : undefined,
      };
    } catch (e) {
      const message = classifyStartError(e);
      const parsed = bb.parseBrowserbaseError(e);
      const debugInfo = buildStartDebugInfo({
        ...envCheck,
        orphanCleanupRan: openDebug?.orphanCleanupRan ?? false,
        runningSessionsFound: openDebug?.runningSessionsFound ?? 0,
        sessionsReleased: openDebug?.sessionsReleased ?? 0,
        retriedAfter429: openDebug?.retriedAfter429 ?? false,
        createStatus: openDebug?.createStatus ?? parsed.status,
        createMessage: openDebug?.createMessage ?? (parsed.message ? truncateDebug(parsed.message) : null),
        failurePhase,
        contextIdPrefix,
        listError: openDebug?.listError ?? null,
        supabaseError,
      });

      const { error: errUpdate } = await sb
        .from("connected_sites")
        .update({
          status: "error",
          error_message: message,
          browserbase_session_id: null,
          connect_started_at: null,
        })
        .eq("id", site.id);
      if (errUpdate) {
        debugInfo.supabaseError = truncateDebug(errUpdate.message);
      }

      console.error("[startConnectSession]", e instanceof Error ? e.message : e, debugInfo);
      return { ok: false as const, message, debugInfo };
    } finally {
      await endBrowserbaseSession(bb, sessionIdToRelease);
    }
  });

export const abandonConnectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AbandonInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const site = await assertOwnsSite(supabase, data.connectedSiteId, userId);
    const bb = await import("./browserbase.server");
    const sb = supabase as SupabaseClient;

    const sessionId = data.sessionId ?? null;
    try {
      await sb
        .from("connected_sites")
        .update({
          status: "disconnected",
          error_message: null,
          browserbase_session_id: null,
          connect_started_at: null,
        })
        .eq("id", site.id);
    } finally {
      await endBrowserbaseSession(bb, sessionId);
    }

    return { ok: true as const };
  });

export const captureSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CaptureInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const site = await assertOwnsSite(supabase, data.connectedSiteId, userId);

    const bb = await import("./browserbase.server");
    const crypto = await import("./crypto.server");
    const sb = supabase as SupabaseClient;

    const sessionId = data.sessionId;
    let sessionEnded = false;
    let persisted = false;

    try {
      const { data: row } = await sb
        .from("connected_sites")
        .select("session_data_encrypted")
        .eq("id", site.id)
        .maybeSingle();

      let contextId: string | null = null;
      if (row?.session_data_encrypted) {
        try {
          const parsed = JSON.parse(crypto.decrypt(row.session_data_encrypted));
          if (parsed?.contextId) contextId = parsed.contextId as string;
        } catch {
          /* ignore */
        }
      }

      if (!contextId) {
        return { ok: false as const, message: "connectedSites.errors.sessionSaveFailed" };
      }

      // Flush cookies/localStorage to the Browserbase context (persist=true).
      await endBrowserbaseSession(bb, sessionId);
      sessionEnded = true;

      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const ciphertext = crypto.encrypt(
        JSON.stringify({
          contextId,
          capturedAt: now.toISOString(),
        }),
      );

      const { error } = await sb
        .from("connected_sites")
        .update({
          session_data_encrypted: ciphertext,
          status: "connected",
          last_connected_at: now.toISOString(),
          expires_at: expires.toISOString(),
          error_message: null,
          browserbase_session_id: null,
          connect_started_at: null,
        })
        .eq("id", site.id);
      if (error) throw new Error(error.message);

      persisted = true;
      return {
        ok: true as const,
        expiresAt: expires.toISOString(),
        message: "connectedSites.connectSuccess",
      };
    } catch (e) {
      const message = "connectedSites.errors.sessionSaveFailed";
      if (!persisted) {
        await sb
          .from("connected_sites")
          .update({ status: "error", error_message: message })
          .eq("id", site.id);
      }
      console.error("[captureSession]", e instanceof Error ? e.message : e);
      return { ok: false as const, message };
    } finally {
      if (!sessionEnded) {
        await endBrowserbaseSession(bb, sessionId);
      }
    }
  });

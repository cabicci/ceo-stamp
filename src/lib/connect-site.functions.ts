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

async function getProtectedConnectingSessionIds(sb: SupabaseClient): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - ACTIVE_CONNECT_MS).toISOString();
  const { data } = await sb
    .from("connected_sites")
    .select("browserbase_session_id")
    .eq("status", "connecting")
    .gte("connect_started_at", cutoff)
    .not("browserbase_session_id", "is", null);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.browserbase_session_id) ids.add(row.browserbase_session_id as string);
  }
  return ids;
}

/** Mark stale in-flight connects as disconnected so their sessions become orphans. */
async function expireStaleConnectingRows(sb: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - ACTIVE_CONNECT_MS).toISOString();
  await sb
    .from("connected_sites")
    .update({
      status: "disconnected",
      browserbase_session_id: null,
      connect_started_at: null,
      error_message: null,
    })
    .eq("status", "connecting")
    .lt("connect_started_at", cutoff);
}

async function openConnectBrowserSession(
  bb: typeof import("./browserbase.server"),
  contextId: string,
  protectedSessionIds: ReadonlySet<string>,
): Promise<Awaited<ReturnType<typeof bb.createSession>>> {
  const orphans = await bb.releaseOrphanSessions(protectedSessionIds);
  if (orphans > 0) {
    console.warn(`[startConnectSession] released ${orphans} orphan Browserbase session(s)`);
  }

  try {
    return await bb.createSession({ contextId, persist: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!bb.isBrowserbaseConcurrentLimitError(msg)) throw err;

    const released = await bb.releaseRunningSessions();
    console.warn(
      `[startConnectSession] concurrent limit — released ${released} running session(s), retrying`,
    );
    await new Promise((r) => setTimeout(r, 1000));

    try {
      return await bb.createSession({ contextId, persist: true });
    } catch {
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

    try {
      await expireStaleConnectingRows(sb);
      const protectedIds = await getProtectedConnectingSessionIds(sb);

      const { data: existing } = await sb
        .from("connected_sites")
        .select("session_data_encrypted")
        .eq("id", site.id)
        .maybeSingle();

      let contextId: string | null = null;
      if (existing?.session_data_encrypted) {
        try {
          const parsed = JSON.parse(crypto.decrypt(existing.session_data_encrypted));
          if (parsed?.contextId) contextId = parsed.contextId as string;
        } catch {
          /* corrupt or old shape — fall through and create a new context */
        }
      }
      if (!contextId) {
        const ctx = await bb.createContext();
        contextId = ctx.id;
      }

      const session = await openConnectBrowserSession(bb, contextId, protectedIds);
      sessionIdToRelease = session.id;

      const debug = await bb.getDebugUrls(session.id);

      const cdpNav = await import("./browserbase-cdp.server");
      const nav = await cdpNav.navigateBrowserbaseDebugPage(debug, site.login_url);
      const loginNavigationFailed = !nav.ok;

      const connectStartedAt = new Date().toISOString();
      const handle = crypto.encrypt(
        JSON.stringify({
          contextId,
          startedAt: connectStartedAt,
          browserbaseSessionId: session.id,
        }),
      );

      await sb
        .from("connected_sites")
        .update({
          status: "connecting",
          error_message: null,
          session_data_encrypted: handle,
          browserbase_session_id: session.id,
          connect_started_at: connectStartedAt,
        })
        .eq("id", site.id);

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
      await sb
        .from("connected_sites")
        .update({
          status: "error",
          error_message: message,
          browserbase_session_id: null,
          connect_started_at: null,
        })
        .eq("id", site.id);
      console.error("[startConnectSession]", e instanceof Error ? e.message : e);
      return { ok: false as const, message };
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

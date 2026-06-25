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

const STALE_SESSION_MS = 2 * 60 * 1000;

function classifyStartError(err: unknown): string {
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
    message.toLowerCase().includes("concurrent") ||
    message.toLowerCase().includes("rate limit")
  ) {
    return "connectedSites.errors.browserbaseCapacity";
  }
  return "connectedSites.errors.sessionStartFailed";
}

async function openConnectBrowserSession(
  bb: typeof import("./browserbase.server"),
  contextId: string,
): Promise<Awaited<ReturnType<typeof bb.createSession>>> {
  const staleReleased = await bb.releaseRunningSessions({ olderThanMs: STALE_SESSION_MS });
  if (staleReleased > 0) {
    console.warn(
      `[startConnectSession] proactively released ${staleReleased} stale Browserbase session(s)`,
    );
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
    await new Promise((r) => setTimeout(r, 500));
    return await bb.createSession({ contextId, persist: true });
  }
}

async function assertOwnsSite(
  supabase: ReturnType<typeof Object>,
  connectedSiteId: string,
  userId: string,
) {
  // RLS already enforces this, but we explicitly fetch to get the row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
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

    let sessionIdToRelease: string | null = null;

    try {
      // 1) Create (or reuse) a persistent Browserbase context for this site.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
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

      // 2) Open a session bound to that context with persist=true.
      const session = await openConnectBrowserSession(bb, contextId);
      sessionIdToRelease = session.id;
      const debug = await bb.getDebugUrls(session.id);

      // 3) Navigate to login_url before the client opens the live view.
      const cdpNav = await import("./browserbase-cdp.server");
      const nav = await cdpNav.navigateBrowserbaseDebugPage(debug, site.login_url);
      const loginNavigationFailed = !nav.ok;

      // Persist the (encrypted) contextId now so capture-session can find it
      // even if the browser tab is closed unexpectedly. The cookies still
      // live ONLY inside Browserbase; this row holds an encrypted handle.
      const handle = crypto.encrypt(
        JSON.stringify({ contextId, startedAt: new Date().toISOString() }),
      );
      await sb
        .from("connected_sites")
        .update({
          status: "connecting",
          error_message: null,
          session_data_encrypted: handle,
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
      // Never surface raw API/HTML bodies to the client — use an i18n key.
      const message = classifyStartError(e);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("connected_sites")
        .update({ status: "error", error_message: message })
        .eq("id", site.id);
      console.error("[startConnectSession]", e instanceof Error ? e.message : e);
      return { ok: false as const, message };
    } finally {
      if (sessionIdToRelease) {
        await bb.endSession(sessionIdToRelease).catch(() => undefined);
      }
    }
  });

export const abandonConnectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AbandonInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const site = await assertOwnsSite(supabase, data.connectedSiteId, userId);
    const bb = await import("./browserbase.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    if (data.sessionId) {
      await bb.endSession(data.sessionId).catch(() => undefined);
    }

    await sb
      .from("connected_sites")
      .update({ status: "disconnected", error_message: null })
      .eq("id", site.id);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    try {
      // End the live session — Browserbase persists cookies + localStorage
      // to the bound context (persist=true). We never read the raw values.
      // Re-derive the contextId from the running session.
      // We have to refetch the session to get its contextId (was created
      // with one we passed in; we don't keep client-side state).
      // Browserbase's GET /sessions/{id} returns the session including its
      // contextId, but for safety we accept either path: read what we stored.
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

      // Close the live session so Browserbase flushes the profile to the context.
      await bb.endSession(data.sessionId).catch(() => {
        /* releasing twice is harmless */
      });

      if (!contextId) {
        // The contextId is only known at start; we re-persist it here so
        // subsequent re-connects reuse the same browser profile.
        // If we somehow lost it, mark error.
        throw new Error("لم نتمكن من حفظ الجلسة — حاول الربط مرة تانية");
      }

      // Encrypt the session handle (contextId + metadata). Browserbase holds
      // the actual cookies/localStorage under our project; this row holds
      // only the encrypted pointer.
      const blob = JSON.stringify({
        contextId,
        capturedAt: new Date().toISOString(),
        // We deliberately store NO username, NO password, NO cookies in plaintext.
      });
      const ciphertext = crypto.encrypt(blob);

      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const { error } = await sb
        .from("connected_sites")
        .update({
          session_data_encrypted: ciphertext,
          status: "connected",
          last_connected_at: now.toISOString(),
          expires_at: expires.toISOString(),
          error_message: null,
        })
        .eq("id", site.id);
      if (error) throw new Error(error.message);

      return { ok: true as const, expiresAt: expires.toISOString() };
    } catch (e) {
      const message = "connectedSites.errors.sessionSaveFailed";
      await sb
        .from("connected_sites")
        .update({ status: "error", error_message: message })
        .eq("id", site.id);
      // Best-effort release of the Browserbase session.
      await bb.endSession(data.sessionId).catch(() => {});
      console.error("[captureSession]", e instanceof Error ? e.message : e);
      throw new Error(message);
    }
  });

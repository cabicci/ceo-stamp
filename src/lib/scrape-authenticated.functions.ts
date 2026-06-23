/**
 * scrape-authenticated — SERVER ONLY.
 *
 * Uses the encrypted contextId stored on a connected_site to spin up a
 * Browserbase session that reuses the client's previously-captured browser
 * profile (cookies + localStorage live ONLY in Browserbase). We then drive
 * CDP to crawl the protected pages and feed them into the shared analysis
 * pipeline. Decryption + the Browserbase API key never reach the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ANALYSIS_ERROR,
  clearStaleAnalysisRuns,
  markAnalysisError,
} from "@/lib/analysis-lifecycle.server";

const Input = z.object({
  connectedSiteId: z.string().uuid(),
  targetUrls: z.array(z.string().url()).optional(),
  maxPages: z.number().int().min(1).max(25).optional(),
});

type AuthResult =
  | { ok: true; analysisId: string; pagesCount: number }
  | { ok: false; authExpired: true; message: string }
  | { ok: false; authExpired: false; message: string };

export const scrapeAuthenticated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<AuthResult> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // 1) Load site + verify ownership (RLS would also enforce).
    const { data: site, error: siteErr } = await sb
      .from("connected_sites")
      .select(
        "id, project_id, label, login_url, status, expires_at, session_data_encrypted, projects!inner(id, owner_id, website_url)",
      )
      .eq("id", data.connectedSiteId)
      .maybeSingle();
    if (siteErr) throw new Error(siteErr.message);
    if (!site) throw new Error("الموقع المربوط غير موجود");
    if (site.projects?.owner_id !== userId) throw new Error("غير مصرح");

    // 2) Status / expiry checks.
    const now = Date.now();
    const expired =
      site.status === "expired" ||
      (site.expires_at && new Date(site.expires_at).getTime() < now);
    if (site.status !== "connected" || expired) {
      await sb
        .from("connected_sites")
        .update({ status: "expired" })
        .eq("id", site.id);
      return {
        ok: false,
        authExpired: true,
        message: "الجلسة انتهت — اربط الموقع تاني.",
      };
    }
    if (!site.session_data_encrypted) {
      return {
        ok: false,
        authExpired: true,
        message: "مفيش جلسة محفوظة — اربط الموقع تاني.",
      };
    }

    // 3) Decrypt contextId server-side.
    const crypto = await import("./crypto.server");
    let contextId: string;
    try {
      const handle = JSON.parse(crypto.decrypt(site.session_data_encrypted));
      contextId = handle.contextId as string;
      if (!contextId) throw new Error("missing contextId");
    } catch {
      return {
        ok: false,
        authExpired: true,
        message: "تعذّر قراءة الجلسة المخزّنة — اربط الموقع تاني.",
      };
    }

    // 4) Create the analysis row up front (status='scraping') so the UI polls.
    const projectId: string = site.project_id;
    const websiteUrl: string = site.projects.website_url;

    await clearStaleAnalysisRuns(sb, projectId);

    const { data: priorAnalysis } = await sb
      .from("website_analysis")
      .select("pages_scraped")
      .eq("project_id", projectId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const publicPages = Array.isArray(priorAnalysis?.pages_scraped)
      ? (priorAnalysis!.pages_scraped as Array<{ url: string; text: string }>)
      : [];

    const { data: analysisRow, error: insertErr } = await sb
      .from("website_analysis")
      .insert({ project_id: projectId, status: "scraping", pages_scraped: [], ai_analysis: {} })
      .select("id")
      .single();
    if (insertErr || !analysisRow) throw new Error(insertErr?.message ?? "Insert failed");
    const analysisId: string = analysisRow.id;

    // 5) Drive Browserbase + CDP.
    const bb = await import("./browserbase.server");
    const cdpMod = await import("./cdp.server");

    let sessionId: string | null = null;
    try {
      const session = await bb.createSession({ contextId, persist: true });
      sessionId = session.id;

      const debug = await bb.getDebugUrls(session.id);
      const pageDebugger = debug.pages?.[0]?.debuggerUrl ?? debug.debuggerUrl;
      if (!pageDebugger) throw new Error("لم نستطع فتح المتصفح");

      const cdp = await cdpMod.CDPSession.connect(pageDebugger);

      const loginOrigin = new URL(site.login_url).origin;
      const loginPath = new URL(site.login_url).pathname.toLowerCase();
      const startUrls =
        data.targetUrls && data.targetUrls.length
          ? data.targetUrls
          : [loginOrigin + "/", site.login_url];

      const cap = data.maxPages ?? 15;
      const visited = new Set<string>();
      const queue: string[] = [];
      for (const u of startUrls) if (!visited.has(u)) queue.push(u);

      const collected: Array<{ url: string; text: string }> = [];
      let authExpiredHit = false;

      while (queue.length && collected.length < cap) {
        const url = queue.shift()!;
        if (visited.has(url)) continue;
        visited.add(url);

        let nav: { finalUrl: string; ok: boolean };
        try {
          nav = await cdpMod.navigate(cdp, url, 15_000);
        } catch {
          continue;
        }
        if (!nav.ok) continue;

        // Detect login redirect → session expired.
        const finalPath = (() => {
          try {
            return new URL(nav.finalUrl).pathname.toLowerCase();
          } catch {
            return "";
          }
        })();
        const looksLikeLogin =
          finalPath === loginPath ||
          /\/(login|signin|sign-in|auth)(\/|$)/i.test(finalPath) ||
          nav.finalUrl.includes("?redirect=") ||
          nav.finalUrl.includes("?next=");

        if (looksLikeLogin && collected.length === 0) {
          authExpiredHit = true;
          break;
        }

        let page;
        try {
          page = await cdpMod.extractPage(cdp);
        } catch {
          continue;
        }
        if (page.text && page.text.length > 80) {
          collected.push({ url: page.url, text: page.text });
        }

        // Enqueue same-origin links one level deep.
        for (const link of page.links) {
          if (visited.has(link)) continue;
          let parsed: URL;
          try {
            parsed = new URL(link);
          } catch {
            continue;
          }
          if (parsed.origin !== loginOrigin) continue;
          if (/\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|mp4|mp3|css|js)(\?|$)/i.test(parsed.pathname))
            continue;
          if (queue.length + collected.length < cap * 2) queue.push(parsed.toString());
        }
      }

      cdp.close();

      if (authExpiredHit) {
        await sb
          .from("connected_sites")
          .update({ status: "expired" })
          .eq("id", site.id);
        await markAnalysisError(sb, analysisId, ANALYSIS_ERROR.authSessionExpired);
        return {
          ok: false,
          authExpired: true,
          message: ANALYSIS_ERROR.authSessionExpired,
        };
      }

      if (collected.length === 0) {
        await markAnalysisError(sb, analysisId, ANALYSIS_ERROR.noProtectedPages);
        return {
          ok: false,
          authExpired: false,
          message: ANALYSIS_ERROR.noProtectedPages,
        };
      }

      // 6) Merge with prior public pages (dedup by URL) and run analysis.
      const byUrl = new Map<string, { url: string; text: string }>();
      for (const p of publicPages) byUrl.set(p.url, p);
      for (const p of collected) byUrl.set(p.url, p);
      const merged = Array.from(byUrl.values()).slice(0, 30);

      await sb
        .from("website_analysis")
        .update({ status: "analyzing", pages_scraped: merged as never })
        .eq("id", analysisId);

      const { runAnalysisOverPages } = await import("./analysis-pipeline.server");
      await runAnalysisOverPages({
        supabase,
        projectId,
        websiteUrl,
        analysisId,
        pages: merged,
      });

      return { ok: true, analysisId, pagesCount: collected.length };
    } catch (err) {
      await markAnalysisError(sb, analysisId, err);
      throw err;
    } finally {
      // Always release the Browserbase session — they cost money/time.
      if (sessionId) {
        await bb.endSession(sessionId).catch(() => {});
      }
    }
  });

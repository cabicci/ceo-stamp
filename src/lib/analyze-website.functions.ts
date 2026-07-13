import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ANALYSIS_ERROR,
  AnalysisPipelineError,
  clearStaleAnalysisRuns,
  HOMEPAGE_FETCH_TIMEOUT_MS,
  markAnalysisError,
} from "@/lib/analysis-lifecycle.server";

const WatchdogInputSchema = z.object({
  analysisId: z.string().uuid(),
});

/** Client-side watchdog: mark a stuck in-flight analysis row as error. */
export const failAnalysisWatchdog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => WatchdogInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error: fetchErr } = await supabase
      .from("website_analysis")
      .select("id, status")
      .eq("id", data.analysisId)
      .single();

    if (fetchErr || !row) return { ok: false as const };
    if (row.status !== "scraping" && row.status !== "analyzing") {
      return { ok: true as const };
    }

    await markAnalysisError(supabase, data.analysisId, ANALYSIS_ERROR.watchdogTimeout);
    return { ok: true as const };
  });

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<{ url: string; text: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new AnalysisPipelineError(ANALYSIS_ERROR.pipelineFailed, {
      reason: "FIRECRAWL_API_KEY missing",
    });
  }

  const signal = AbortSignal.timeout(HOMEPAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[analyze] Firecrawl scrape failed [${res.status}]: ${errBody}`);
      throw new AnalysisPipelineError(ANALYSIS_ERROR.fetchHttp, { status: res.status });
    }

    const payload = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string };
      markdown?: string;
      error?: string;
    };
    const markdown = payload.data?.markdown ?? payload.markdown ?? "";
    if (!markdown) {
      throw new AnalysisPipelineError(ANALYSIS_ERROR.thinContent);
    }
    return { url, text: markdown.slice(0, 20_000) };
  } catch (err) {
    if (err instanceof AnalysisPipelineError) throw err;
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AnalysisPipelineError(ANALYSIS_ERROR.fetchTimeout, err);
    }
    throw err;
  }
}

export const analyzeWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("id, website_url")
      .eq("id", data.projectId)
      .single();
    if (projectErr || !project) throw new Error("Project not found");

    await clearStaleAnalysisRuns(supabase, project.id);

    const { data: analysisRow, error: insertErr } = await supabase
      .from("website_analysis")
      .insert({
        project_id: project.id,
        status: "scraping",
        pages_scraped: [],
        ai_analysis: {},
      })
      .select("id")
      .single();
    if (insertErr || !analysisRow) throw new Error(insertErr?.message ?? "Insert failed");

    try {
      const homepage = await fetchPage(project.website_url);
      const pages = [homepage];

      if (homepage.text.length < 400) {
        throw new AnalysisPipelineError(ANALYSIS_ERROR.jsRenderedSite);
      }

      await supabase
        .from("website_analysis")
        .update({ status: "analyzing", pages_scraped: pages })
        .eq("id", analysisRow.id);

      const { runAnalysisOverPages } = await import("./analysis-pipeline.server");
      await runAnalysisOverPages({
        supabase,
        projectId: project.id,
        websiteUrl: project.website_url,
        analysisId: analysisRow.id,
        pages,
      });

      return { analysisId: analysisRow.id, error: null as string | null };
    } catch (err) {
      await markAnalysisError(supabase, analysisRow.id, err);
      const { errorKeyFromUnknown } = await import("@/lib/analysis-lifecycle.server");
      return { analysisId: analysisRow.id, error: errorKeyFromUnknown(err) };
    }
  });


const SaveSchema = z.object({
  projectId: z.string().uuid(),
  analysisId: z.string().uuid(),
  analysis: z.object({
    business_model: z.string(),
    target_audience: z.string(),
    tone_of_voice: z.string(),
    usps: z.array(z.string()),
    pain_points: z.array(z.string()),
    personas: z.array(
      z.object({
        name: z.string(),
        pain_points: z.array(z.string()),
        objections: z.array(z.string()),
      }),
    ),
    content_opportunities: z.array(z.string()),
    content_pillars: z.array(z.string()),
    marketing_angles: z.array(z.string()),
  }),
});

export const saveAnalysisEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const analysisJson = data.analysis as unknown as Record<string, never>;

    const { error: updErr } = await supabase
      .from("website_analysis")
      .update({ ai_analysis: analysisJson })
      .eq("id", data.analysisId);
    if (updErr) throw new Error(updErr.message);

    const { error: upErr } = await supabase.from("brand_profiles").upsert(
      {
        project_id: data.projectId,
        tone_of_voice: data.analysis.tone_of_voice,
        personas: data.analysis.personas as never,
        usps: data.analysis.usps as never,
        content_pillars: data.analysis.content_pillars as never,
      },
      { onConflict: "project_id" },
    );
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

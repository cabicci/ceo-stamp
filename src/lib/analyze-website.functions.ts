import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ar,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`فشل جلب ${url} (HTTP ${res.status})`);
  const html = await res.text();
  return { url, text: stripHtml(html).slice(0, 20_000) };
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

      // JS-rendered-site guard.
      if (homepage.text.length < 400) {
        throw new Error(
          "الموقع يعتمد على رندر JavaScript في المتصفح، فالنسخة المستخرجة فاضية تقريبًا. لو الموقع وراء تسجيل دخول، اربطه واستخدم \"حلّل الصفحات المحمية\".",
        );
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

      return { analysisId: analysisRow.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("website_analysis")
        .update({ status: "error", error_message: message })
        .eq("id", analysisRow.id);
      throw err;
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

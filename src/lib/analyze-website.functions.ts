import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

const SYSTEM_PROMPT = `You are a senior brand strategist analyzing a company's website to produce a structured brand intelligence draft. The output is a DRAFT that a human marketer will review and edit.

Return ONLY valid JSON (no prose, no markdown fences) matching exactly this shape:
{
  "business_model": string,
  "target_audience": string,
  "tone_of_voice": string,
  "usps": string[],
  "pain_points": string[],
  "personas": Array<{ "name": string, "pain_points": string[], "objections": string[] }>,
  "content_gaps": string[],
  "content_pillars": string[]
}

Write all values in Arabic (Modern Standard Arabic). Be concrete and specific to the actual website content, not generic. Each array should contain 3-6 items. Personas should contain 2-3 distinct personas.`;

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

      // JS-rendered-site guard: if the stripped text is too thin, the site is
      // almost certainly client-rendered (React/Next/SPA shell) and our
      // server-side fetch only sees the empty HTML scaffold.
      if (homepage.text.length < 400) {
        throw new Error(
          "الموقع يعتمد على رندر JavaScript في المتصفح، فالنسخة المستخرجة فاضية تقريبًا. محتاجين خدمة رندر (مثل Browserless) لاستخراج المحتوى الفعلي.",
        );
      }

      await supabase
        .from("website_analysis")
        .update({ status: "analyzing", pages_scraped: pages })
        .eq("id", analysisRow.id);

      const userContent = `Website URL: ${project.website_url}\n\n--- PAGE CONTENT ---\n${pages
        .map((p) => `# ${p.url}\n${p.text}`)
        .join("\n\n")}`;

      const { callAI } = await import("@/lib/ai/ai.server");
      const analysis = (await callAI({
        task: "website_analysis",
        systemPrompt: SYSTEM_PROMPT,
        userContent,
        jsonMode: true,
      })) as Record<string, unknown>;

      const analysisJson = analysis as unknown as Record<string, never>;

      await supabase
        .from("website_analysis")
        .update({
          status: "done",
          pages_scraped: pages,
          ai_analysis: analysisJson,
          error_message: null,
        })
        .eq("id", analysisRow.id);

      await supabase.from("brand_profiles").upsert(
        {
          project_id: project.id,
          tone_of_voice: (analysis.tone_of_voice as string) ?? "",
          personas: (analysis.personas as never) ?? [],
          usps: (analysis.usps as never) ?? [],
          content_pillars: (analysis.content_pillars as never) ?? [],
        },
        { onConflict: "project_id" },
      );

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
    content_gaps: z.array(z.string()),
    content_pillars: z.array(z.string()),
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

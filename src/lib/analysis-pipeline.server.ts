/**
 * Shared analysis pipeline — SERVER ONLY.
 * Takes pre-scraped pages and runs the existing AI/DB flow so both the
 * public scraper and the authenticated scraper write the same shape.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ScrapedPage = { url: string; text: string };

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

/**
 * Runs the AI analysis over the given pages and updates the website_analysis
 * row + brand_profiles. Caller is responsible for creating the analysis row
 * and flipping its status to 'analyzing' beforehand.
 *
 * Throws on JS-rendered-site shortfall or AI errors; caller marks 'error'.
 */
export async function runAnalysisOverPages(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  projectId: string;
  websiteUrl: string;
  analysisId: string;
  pages: ScrapedPage[];
}): Promise<{ analysis: Record<string, unknown> }> {
  const { supabase, projectId, websiteUrl, analysisId, pages } = args;

  const totalText = pages.reduce((n, p) => n + p.text.length, 0);
  if (totalText < 400) {
    throw new Error(
      "محتوى الصفحات المستخرجة قليل جدًا للتحليل. لو الموقع بيعتمد على JavaScript محتاجين رندر فعلي.",
    );
  }

  const userContent = `Website URL: ${websiteUrl}\n\n--- PAGE CONTENT ---\n${pages
    .map((p) => `# ${p.url}\n${p.text}`)
    .join("\n\n")}`;

  const { callAI } = await import("@/lib/ai/ai.server");
  const analysis = (await callAI({
    task: "website_analysis",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
  })) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisJson = analysis as any;

  await supabase
    .from("website_analysis")
    .update({
      status: "done",
      pages_scraped: pages as never,
      ai_analysis: analysisJson,
      error_message: null,
    })
    .eq("id", analysisId);

  await supabase.from("brand_profiles").upsert(
    {
      project_id: projectId,
      tone_of_voice: (analysis.tone_of_voice as string) ?? "",
      personas: (analysis.personas as never) ?? [],
      usps: (analysis.usps as never) ?? [],
      content_pillars: (analysis.content_pillars as never) ?? [],
    },
    { onConflict: "project_id" },
  );

  return { analysis };
}

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
  "audience": string,
  "tone_of_voice": string,
  "usps": string[],
  "pain_points": string[],
  "personas": Array<{ "name": string, "description": string }>,
  "content_gaps": string[],
  "content_pillars": string[]
}

Write all values in Arabic. Be concrete and specific to the actual website content, not generic.`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<{ url: string; text: string }> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 MarketingCEO-Bot/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
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
      .insert({ project_id: project.id, status: "running", pages_scraped: [], ai_analysis: {} })
      .select("id")
      .single();
    if (insertErr || !analysisRow) throw new Error(insertErr?.message ?? "Insert failed");

    try {
      const homepage = await fetchPage(project.website_url);
      const pages = [homepage];

      const userContent = `Website URL: ${project.website_url}\n\n--- PAGE CONTENT ---\n${pages
        .map((p) => `# ${p.url}\n${p.text}`)
        .join("\n\n")}`;

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
          status: "complete",
          pages_scraped: pages,
          ai_analysis: analysisJson,
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
        .update({ status: "failed", error_message: message })
        .eq("id", analysisRow.id);
      throw err;
    }
  });

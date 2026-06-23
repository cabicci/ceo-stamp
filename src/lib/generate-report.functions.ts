import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMarketingAnalysis } from "@/lib/report/analysis.types";
import { buildMarketingReportPdf } from "@/lib/report/render-report-pdf";

const InputSchema = z.object({
  projectId: z.string().uuid(),
  locale: z.enum(["ar", "en"]),
});

export const generateAnalysisReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("id, name, website_url")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectErr) throw new Error(projectErr.message);
    if (!project) throw new Error("Project not found or access denied");

    const { data: analysisRow, error: analysisErr } = await supabase
      .from("website_analysis")
      .select("ai_analysis, status")
      .eq("project_id", data.projectId)
      .eq("status", "done")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (analysisErr) throw new Error(analysisErr.message);
    if (!analysisRow?.ai_analysis) {
      throw new Error(
        data.locale === "ar"
          ? "لازم يكون في تحليل مكتمل قبل تصدير التقرير."
          : "Complete website analysis before exporting the report.",
      );
    }

    const analysis = normalizeMarketingAnalysis(
      analysisRow.ai_analysis as Parameters<typeof normalizeMarketingAnalysis>[0],
    );

    const buffer = await buildMarketingReportPdf({
      locale: data.locale,
      project: { name: project.name, websiteUrl: project.website_url },
      analysis,
    });

    const safeName = project.name.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "project";
    const filename = `marketing-report-${safeName}.pdf`;

    return {
      pdfBase64: buffer.toString("base64"),
      filename,
    };
  });

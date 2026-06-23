import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { composeReportDocument, DEFAULT_REPORT_SECTIONS } from "./compose-report";
import { getReportLabels } from "./labels";
import { registerReportFonts } from "./register-fonts";
import type { MarketingAnalysis } from "./analysis.types";
import type { ReportLocale, ReportSectionModule } from "./types";

export type BuildMarketingReportInput = {
  locale: ReportLocale;
  project: { name: string; websiteUrl: string };
  analysis: MarketingAnalysis;
  sections?: ReportSectionModule[];
};

/** Server-side PDF generation — embeds Cairo for correct Arabic shaping. */
export async function buildMarketingReportPdf(input: BuildMarketingReportInput): Promise<Buffer> {
  registerReportFonts();

  const locale = input.locale;
  const ctx = {
    locale,
    isRtl: locale === "ar",
    labels: getReportLabels(locale),
    project: input.project,
    analysis: input.analysis,
    generatedAt: new Date(),
  };

  const doc = composeReportDocument(ctx, input.sections ?? DEFAULT_REPORT_SECTIONS);
  return renderToBuffer(doc as ReactElement<DocumentProps>);
}

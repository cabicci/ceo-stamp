import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { composeReportDocument, CAMPAIGN_REPORT_SECTIONS, DEFAULT_REPORT_SECTIONS } from "./compose-report";
import { getCampaignDocumentTitle, getReportLabels } from "./labels";
import { registerReportFonts } from "./register-fonts";
import type { MarketingAnalysis } from "./analysis.types";
import type { CampaignReportData } from "./campaign-report.types";
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
  const labels = getReportLabels(locale);
  const ctx = {
    locale,
    isRtl: locale === "ar",
    documentTitle: labels.documentTitle,
    labels,
    project: input.project,
    analysis: input.analysis,
    generatedAt: new Date(),
  };

  const doc = composeReportDocument(ctx, input.sections ?? DEFAULT_REPORT_SECTIONS);
  return renderToBuffer(doc as ReactElement<DocumentProps>);
}

export type BuildCampaignReportInput = {
  locale: ReportLocale;
  project: { name: string; websiteUrl: string };
  campaign: CampaignReportData;
  sections?: ReportSectionModule[];
};

/** Server-side campaign PDF — reuses composeReportDocument + Cairo fonts. */
export async function buildCampaignReportPdf(input: BuildCampaignReportInput): Promise<Buffer> {
  registerReportFonts();

  const locale = input.locale;
  const labels = getReportLabels(locale);
  const ctx = {
    locale,
    isRtl: locale === "ar",
    documentTitle: getCampaignDocumentTitle(locale),
    labels,
    project: input.project,
    campaign: input.campaign,
    generatedAt: new Date(),
  };

  const doc = composeReportDocument(ctx, input.sections ?? CAMPAIGN_REPORT_SECTIONS);
  return renderToBuffer(doc as ReactElement<DocumentProps>);
}

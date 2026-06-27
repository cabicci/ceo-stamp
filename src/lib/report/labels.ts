import ar from "@/i18n/locales/ar.json";
import en from "@/i18n/locales/en.json";
import type { ReportLabels, ReportLocale } from "./types";

type Dict = Record<string, unknown>;

function resolvePath(dict: Dict, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Dict)[key] : undefined), dict);
  return typeof value === "string" ? value : path;
}

export function getReportLabels(locale: ReportLocale): ReportLabels {
  const dict = (locale === "ar" ? ar : en) as Dict;
  const t = (key: string) => resolvePath(dict, key);

  return {
    documentTitle: t("report.documentTitle"),
    generatedOn: t("report.generatedOn"),
    pageOf: t("report.pageOf"),
    sections: {
      analysis: t("report.sections.analysis"),
      campaign: t("report.sections.campaign"),
      posts: t("report.sections.posts"),
      ads: t("report.sections.ads"),
    },
    fields: {
      businessModel: t("report.fields.businessModel"),
      targetAudience: t("report.fields.targetAudience"),
      toneOfVoice: t("report.fields.toneOfVoice"),
      usps: t("report.fields.usps"),
      painPoints: t("report.fields.painPoints"),
      personas: t("report.fields.personas"),
      personaPainPoints: t("report.fields.personaPainPoints"),
      personaObjections: t("report.fields.personaObjections"),
      contentOpportunities: t("report.fields.contentOpportunities"),
      marketingAngles: t("report.fields.marketingAngles"),
      contentPillars: t("report.fields.contentPillars"),
      website: t("report.fields.website"),
    },
    campaignFields: {
      packageName: t("report.campaignFields.packageName"),
      description: t("report.campaignFields.description"),
      objective: t("report.campaignFields.objective"),
      channels: t("report.campaignFields.channels"),
      startDate: t("report.campaignFields.startDate"),
      endDate: t("report.campaignFields.endDate"),
      dateRange: t("report.campaignFields.dateRange"),
      funnelFocus: t("report.campaignFields.funnelFocus"),
      frameworks: t("report.campaignFields.frameworks"),
      totalPosts: t("report.campaignFields.totalPosts"),
      adaptationNote: t("report.campaignFields.adaptationNote"),
      platform: t("report.campaignFields.platform"),
      scheduledDate: t("report.campaignFields.scheduledDate"),
      locale: t("report.campaignFields.locale"),
      contentType: t("report.campaignFields.contentType"),
      copy: t("report.campaignFields.copy"),
      frameworkApplied: t("report.campaignFields.frameworkApplied"),
      rationale: t("report.campaignFields.rationale"),
      headline: t("report.campaignFields.headline"),
      body: t("report.campaignFields.body"),
      cta: t("report.campaignFields.cta"),
      variant: t("report.campaignFields.variant"),
      noPosts: t("report.campaignFields.noPosts"),
      noAds: t("report.campaignFields.noAds"),
    },
    emptyList: t("report.emptyList"),
  };
}

export function getCampaignDocumentTitle(locale: ReportLocale): string {
  const dict = (locale === "ar" ? ar : en) as Dict;
  const value = resolvePath(dict, "report.campaignDocumentTitle");
  return typeof value === "string" ? value : "Campaign report";
}

export function formatReportDate(date: Date, locale: ReportLocale): string {
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPageOf(
  labels: ReportLabels,
  pageNumber: number,
  totalPages: number,
): string {
  return labels.pageOf
    .replace("{current}", String(pageNumber))
    .replace("{total}", String(totalPages));
}

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
    emptyList: t("report.emptyList"),
  };
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

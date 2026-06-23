import type { ReactElement } from "react";
import type { MarketingAnalysis } from "./analysis.types";

export type ReportLocale = "ar" | "en";

export type ReportSectionId = "analysis" | "campaign" | "posts";

export type ReportLabels = {
  documentTitle: string;
  generatedOn: string;
  pageOf: string;
  sections: {
    analysis: string;
  };
  fields: {
    businessModel: string;
    targetAudience: string;
    toneOfVoice: string;
    usps: string;
    painPoints: string;
    personas: string;
    personaPainPoints: string;
    personaObjections: string;
    contentOpportunities: string;
    marketingAngles: string;
    contentPillars: string;
    website: string;
  };
  emptyList: string;
};

export type ReportBuildContext = {
  locale: ReportLocale;
  isRtl: boolean;
  labels: ReportLabels;
  project: {
    name: string;
    websiteUrl: string;
  };
  analysis: MarketingAnalysis;
  generatedAt: Date;
  /** Future: campaign plan, content items, etc. */
  campaign?: unknown;
  posts?: unknown;
};

/** A modular report section — add campaign/posts by implementing this interface. */
export type ReportSectionModule = {
  id: ReportSectionId;
  render: (ctx: ReportBuildContext) => ReactElement;
};

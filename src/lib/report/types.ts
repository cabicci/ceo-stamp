import type { ReactElement } from "react";
import type { MarketingAnalysis } from "./analysis.types";
import type { CampaignReportData } from "./campaign-report.types";

export type ReportLocale = "ar" | "en";

export type ReportSectionId = "analysis" | "campaign" | "posts";

export type ReportLabels = {
  documentTitle: string;
  generatedOn: string;
  pageOf: string;
  sections: {
    analysis: string;
    campaign: string;
    posts: string;
    ads: string;
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
  campaignFields: {
    packageName: string;
    description: string;
    objective: string;
    channels: string;
    startDate: string;
    endDate: string;
    dateRange: string;
    funnelFocus: string;
    frameworks: string;
    totalPosts: string;
    adaptationNote: string;
    platform: string;
    scheduledDate: string;
    locale: string;
    contentType: string;
    copy: string;
    frameworkApplied: string;
    rationale: string;
    headline: string;
    body: string;
    cta: string;
    variant: string;
    noPosts: string;
    noAds: string;
  };
  emptyList: string;
};

export type ReportBuildContext = {
  locale: ReportLocale;
  isRtl: boolean;
  /** PDF document title (window / metadata). */
  documentTitle: string;
  labels: ReportLabels;
  project: {
    name: string;
    websiteUrl: string;
  };
  analysis?: MarketingAnalysis;
  campaign?: CampaignReportData;
  generatedAt: Date;
};

/** A modular report section — add campaign/posts by implementing this interface. */
export type ReportSectionModule = {
  id: ReportSectionId;
  render: (ctx: ReportBuildContext) => ReactElement;
};

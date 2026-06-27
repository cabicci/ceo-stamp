/** Normalized campaign data for PDF report sections. */

export type CampaignReportPost = {
  platform: string;
  platformLabel: string;
  copy: string | null;
  frameworkApplied: string | null;
  rationale: string | null;
  scheduledDate: string | null;
  locale: string | null;
  contentType: string | null;
  /** data: URI for @react-pdf Image — null when missing or fetch failed. */
  imageDataUri: string | null;
};

export type CampaignReportAd = {
  platform: string;
  platformLabel: string;
  variantLabel: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  frameworkApplied: string | null;
  rationale: string | null;
  locale: string | null;
};

export type CampaignReportPlan = {
  packageName: string;
  description: string;
  objectiveLabel: string;
  channelsLabel: string;
  funnelFocus: string;
  frameworksLabel: string;
  totalPosts: number;
  adaptationNote: string | null;
};

export type CampaignReportData = {
  startDate: string | null;
  endDate: string | null;
  plan: CampaignReportPlan;
  posts: CampaignReportPost[];
  ads: CampaignReportAd[];
};

export type ImageGenerationStage =
  | "missing_api_key"
  | "imagen_api"
  | "timeout"
  | "storage_upload"
  | "signed_url"
  | "db_update"
  | "unknown";

/** Subset returned to the client after campaign generation (temporary diagnostics). */
export type CampaignImageDiagnostics = {
  imagesAttempted: number;
  imagesSucceeded: number;
  imagesFailed: number;
  imagesSkippedQuota: number;
  hasGeminiKey: boolean;
  firstFailureReason: string | null;
  firstFailureStage: ImageGenerationStage | null;
};

export const CAMPAIGN_IMAGE_DIAGNOSTICS_KEY = (campaignId: string) =>
  `campaign-image-diagnostics:${campaignId}`;

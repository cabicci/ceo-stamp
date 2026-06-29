import { useTranslation } from "@/i18n/I18nProvider";
import type { CampaignImageDiagnostics, ImageGenerationStage } from "@/lib/post-image.types";

const STAGE_I18N: Record<ImageGenerationStage, string> = {
  missing_api_key: "campaign.imageDiagnostics.stageMissingApiKey",
  imagen_api: "campaign.imageDiagnostics.stageImagenApi",
  timeout: "campaign.imageDiagnostics.stageTimeout",
  storage_upload: "campaign.imageDiagnostics.stageStorageUpload",
  signed_url: "campaign.imageDiagnostics.stageSignedUrl",
  db_update: "campaign.imageDiagnostics.stageDbUpdate",
  unknown: "campaign.imageDiagnostics.stageUnknown",
};

type Props = {
  diagnostics: CampaignImageDiagnostics;
  onDismiss: () => void;
};

export function CampaignImageDiagnosticsBanner({ diagnostics, onDismiss }: Props) {
  const { t } = useTranslation();

  const stageLabel = diagnostics.firstFailureStage
    ? t(STAGE_I18N[diagnostics.firstFailureStage])
    : null;

  return (
    <div
      className="mb-6 p-4 font-mono text-[11px] leading-relaxed"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--surface)",
        color: "var(--ink-text)",
      }}
      role="status"
    >
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-2"
        style={{ color: "var(--muted-text)" }}
      >
        {t("campaign.imageDiagnostics.title")}
      </div>
      <p className="mb-2">{t("campaign.imageDiagnostics.summary", {
        attempted: diagnostics.imagesAttempted,
        succeeded: diagnostics.imagesSucceeded,
        failed: diagnostics.imagesFailed,
        skipped: diagnostics.imagesSkippedQuota,
      })}</p>
      <p className="mb-2">
        {t("campaign.imageDiagnostics.hasGeminiKey", {
          value: diagnostics.hasGeminiKey
            ? t("campaign.imageDiagnostics.yes")
            : t("campaign.imageDiagnostics.no"),
        })}
      </p>
      {diagnostics.firstFailureReason && (
        <p className="mb-2" style={{ color: "var(--danger)" }}>
          {stageLabel
            ? t("campaign.imageDiagnostics.firstFailureWithStage", {
                stage: stageLabel,
                reason: diagnostics.firstFailureReason,
              })
            : t("campaign.imageDiagnostics.firstFailure", {
                reason: diagnostics.firstFailureReason,
              })}
        </p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="text-[10px] uppercase tracking-[0.16em] underline"
        style={{ color: "var(--muted-text)" }}
      >
        {t("campaign.imageDiagnostics.dismiss")}
      </button>
    </div>
  );
}

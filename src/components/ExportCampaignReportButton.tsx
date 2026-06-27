import { useState } from "react";
import { FilePdf, CircleNotch } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "@/i18n/I18nProvider";
import { generateCampaignReportPdf } from "@/lib/generate-campaign-report.functions";

type Props = {
  campaignId: string;
  disabled?: boolean;
};

export function ExportCampaignReportButton({ campaignId, disabled }: Props) {
  const { t, locale } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportFn = useServerFn(generateCampaignReportPdf);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await exportFn({ data: { campaignId, locale } });
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("report.campaignExportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || exporting}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        style={{
          backgroundColor: "var(--ink)",
          color: "var(--paper)",
          borderRadius: "3px",
        }}
      >
        {exporting ? (
          <CircleNotch size={14} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <FilePdf size={14} strokeWidth={1.75} />
        )}
        {exporting ? t("report.campaignExporting") : t("report.exportCampaignPdf")}
      </button>
      {error && (
        <div
          className="mt-2 text-sm py-2 px-3"
          style={{
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "3px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

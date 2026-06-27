import { useState } from "react";
import { Copy, ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react";
import { useTranslation } from "@/i18n/I18nProvider";
import { CHANNEL_LABEL } from "@/lib/campaign-packages";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getPlatformComposerUrl, normalizeChannel } from "@/lib/platform-composer";

type Props = {
  copy: string;
  platform: string;
  imageUrl?: string | null;
  copyLocale?: string;
};

export function PostCopyPublishBar({ copy, platform, imageUrl, copyLocale = "ar" }: Props) {
  const { t, dir } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [publishHint, setPublishHint] = useState(false);

  const channel = normalizeChannel(platform);
  const platformName = channel ? CHANNEL_LABEL[channel] : platform;
  const composerUrl = getPlatformComposerUrl(platform);
  const textDir = copyLocale === "en" ? "ltr" : "rtl";
  const textLang = copyLocale === "en" ? "en" : "ar";

  async function handleCopy() {
    await copyTextToClipboard(copy);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handlePublish() {
    await copyTextToClipboard(copy);
    setPublishHint(true);
    if (composerUrl) {
      window.open(composerUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="mt-3 space-y-2" dir={dir}>
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: "var(--muted-text)" }}
        >
          {t("campaignPage.copyTextLabel")}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
          style={{
            border: "1px solid var(--hairline)",
            backgroundColor: copied ? "var(--accent)" : "var(--surface)",
            color: "var(--ink-text)",
          }}
        >
          <Copy size={14} strokeWidth={1.75} />
          {copied ? t("campaignPage.copied") : t("campaignPage.copy")}
        </button>
      </div>

      <div
        className="select-text whitespace-pre-wrap break-words rounded p-3 text-sm leading-relaxed"
        style={{
          color: "var(--ink-text)",
          backgroundColor: "var(--paper)",
          border: "1px solid var(--hairline)",
          fontFamily: copyLocale === "en" ? "inherit" : "var(--font-arabic)",
        }}
        dir={textDir}
        lang={textLang}
      >
        {copy}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!composerUrl}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent-strong)",
            color: "#FFFFFF",
          }}
        >
          <ArrowSquareOut size={16} strokeWidth={1.75} />
          {t("campaignPage.publishOn", { platform: platformName })}
        </button>

        {imageUrl && (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm"
            style={{
              border: "1px solid var(--hairline)",
              color: "var(--ink-text)",
              backgroundColor: "var(--surface)",
            }}
          >
            <DownloadSimple size={16} strokeWidth={1.75} />
            {t("campaignPage.downloadImage")}
          </a>
        )}
      </div>

      {publishHint && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted-text)" }}>
          {t("campaignPage.manualPublishHint")}
        </p>
      )}
    </div>
  );
}

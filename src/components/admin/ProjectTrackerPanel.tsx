import { useState } from "react";
import { CaretDown, CaretUp, Copy, Notebook } from "@phosphor-icons/react";
import { useTranslation } from "@/i18n/I18nProvider";
import { TrackerMarkdown } from "@/components/admin/TrackerMarkdown";
import trackerMarkdown from "../../../PROJECT_TRACKER.md?raw";

export function ProjectTrackerPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(trackerMarkdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="rounded-[3px]"
      style={{ border: "1px solid var(--hairline)", backgroundColor: "var(--paper)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 inline-flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--accent-soft, #FEF3C7)",
              borderRadius: "3px",
              color: "var(--accent-strong)",
            }}
          >
            <Notebook size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div
              className="font-display text-[18px] leading-tight"
              style={{ color: "var(--ink-text)", fontWeight: 500 }}
            >
              {t("admin.tracker.title")}
            </div>
            <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--muted-text)" }}>
              {t("admin.tracker.subtitle")}
            </p>
          </div>
        </div>
        {open ? (
          <CaretUp size={16} strokeWidth={1.75} style={{ color: "var(--muted-text)" }} />
        ) : (
          <CaretDown size={16} strokeWidth={1.75} style={{ color: "var(--muted-text)" }} />
        )}
      </button>

      {open && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <div className="flex items-center justify-end gap-2 py-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm"
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: "3px",
                color: "var(--ink-text)",
                backgroundColor: copied ? "var(--accent)" : "var(--surface)",
              }}
            >
              <Copy size={14} strokeWidth={1.75} />
              {copied ? t("admin.tracker.copied") : t("admin.tracker.copy")}
            </button>
          </div>
          <div
            className="max-h-[min(70vh,720px)] overflow-y-auto p-4 rounded-[3px]"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--hairline)",
            }}
          >
            <TrackerMarkdown source={trackerMarkdown} />
          </div>
        </div>
      )}
    </section>
  );
}

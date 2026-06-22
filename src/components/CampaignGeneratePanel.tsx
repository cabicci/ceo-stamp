import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleNotch, Play, ArrowCounterClockwise } from "@phosphor-icons/react";
import { generateCampaign } from "@/lib/generate-campaign.functions";
import {
  CONTENT_LANGUAGES,
  IMAGE_TEXT_LANGUAGES,
  type ContentLanguage,
  type ImageTextLanguage,
} from "@/lib/campaign-generation.types";
import { useTranslation } from "@/i18n/I18nProvider";

function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 14);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}

type Props = {
  campaignId: string;
  className?: string;
};

const CONTENT_LANGUAGE_KEYS: Record<ContentLanguage, string> = {
  ar: "campaign.generate.contentLanguageAr",
  en: "campaign.generate.contentLanguageEn",
  both: "campaign.generate.contentLanguageBoth",
};

const IMAGE_TEXT_KEYS: Record<ImageTextLanguage, string> = {
  none: "campaign.generate.imageTextNone",
  ar: "campaign.generate.imageTextAr",
  en: "campaign.generate.imageTextEn",
};

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (opt: T) => string;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2 block"
        style={{ color: "var(--muted-text)" }}
      >
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className="px-3 py-2 text-sm transition-colors"
              style={{
                border: `1px solid ${selected ? "var(--accent-strong)" : "var(--hairline)"}`,
                backgroundColor: selected ? "var(--accent)" : "var(--paper)",
                color: "var(--ink-text)",
                borderRadius: "3px",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {optionLabel(opt)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CampaignGeneratePanel({ campaignId, className }: Props) {
  const { t } = useTranslation();
  const defaults = defaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>("ar");
  const [imageTextLanguage, setImageTextLanguage] = useState<ImageTextLanguage>("none");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateFn = useServerFn(generateCampaign);
  const navigate = useNavigate();

  async function startGeneration() {
    if (endDate < startDate) {
      setError(t("campaign.generate.endBeforeStart"));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await generateFn({
        data: { campaignId, startDate, endDate, contentLanguage, imageTextLanguage },
      });
      navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("campaign.generate.generateFailed"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={className}>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
        style={{ color: "var(--muted-text)" }}
      >
        {t("campaign.generate.periodTitle")}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="text-sm" style={{ color: "var(--ink-text)" }}>
          <span className="block mb-1 text-[12px]" style={{ color: "var(--muted-text)" }}>
            {t("common.from")}
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={generating}
            className="px-3 py-2 text-sm"
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "3px",
              backgroundColor: "var(--paper)",
              color: "var(--ink-text)",
            }}
          />
        </label>
        <label className="text-sm" style={{ color: "var(--ink-text)" }}>
          <span className="block mb-1 text-[12px]" style={{ color: "var(--muted-text)" }}>
            {t("common.to")}
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={generating}
            className="px-3 py-2 text-sm"
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "3px",
              backgroundColor: "var(--paper)",
              color: "var(--ink-text)",
            }}
          />
        </label>
      </div>

      <ChoiceGroup
        label={t("campaign.generate.contentLanguageTitle")}
        value={contentLanguage}
        options={CONTENT_LANGUAGES}
        optionLabel={(opt) => t(CONTENT_LANGUAGE_KEYS[opt])}
        onChange={setContentLanguage}
        disabled={generating}
      />

      <ChoiceGroup
        label={t("campaign.generate.imageTextLanguageTitle")}
        value={imageTextLanguage}
        options={IMAGE_TEXT_LANGUAGES}
        optionLabel={(opt) => t(IMAGE_TEXT_KEYS[opt])}
        onChange={setImageTextLanguage}
        disabled={generating}
      />

      {error && (
        <div
          className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={startGeneration}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent-strong)",
          color: "#FFFFFF",
          borderRadius: "3px",
        }}
      >
        {generating ? (
          <>
            <CircleNotch size={14} strokeWidth={2} className="animate-spin" />
            {t("campaign.generate.generating")}
          </>
        ) : error ? (
          <>
            <ArrowCounterClockwise size={14} strokeWidth={1.75} />
            {t("common.retry")}
          </>
        ) : (
          <>
            <Play size={14} strokeWidth={1.75} />
            {t("campaign.generate.start")}
          </>
        )}
      </button>
    </div>
  );
}

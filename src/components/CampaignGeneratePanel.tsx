import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleNotch, Play, ArrowCounterClockwise } from "@phosphor-icons/react";
import { generateCampaign } from "@/lib/generate-campaign.functions";

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

export function CampaignGeneratePanel({ campaignId, className }: Props) {
  const defaults = defaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateFn = useServerFn(generateCampaign);
  const navigate = useNavigate();

  async function startGeneration() {
    if (endDate < startDate) {
      setError("تاريخ النهاية لازم يكون بعد تاريخ البداية.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await generateFn({
        data: { campaignId, startDate, endDate },
      });
      navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل توليد المحتوى");
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
        فترة الحملة
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="text-sm" style={{ color: "var(--ink-text)" }}>
          <span className="block mb-1 text-[12px]" style={{ color: "var(--muted-text)" }}>
            من
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
            إلى
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
            بيتم توليد المحتوى…
          </>
        ) : error ? (
          <>
            <ArrowCounterClockwise size={14} strokeWidth={1.75} />
            حاول تاني
          </>
        ) : (
          <>
            <Play size={14} strokeWidth={1.75} />
            ابدأ التوليد
          </>
        )}
      </button>
    </div>
  );
}

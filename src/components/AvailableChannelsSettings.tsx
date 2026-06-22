import { useEffect, useState } from "react";
import { FloppyDisk, Check } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_CHANNELS, CHANNEL_LABEL, type Channel } from "@/lib/campaign-packages";
import { useTranslation } from "@/i18n/I18nProvider";

type Props = {
  projectId: string;
  onChange?: (channels: Channel[]) => void;
};

export function AvailableChannelsSettings({ projectId, onChange }: Props) {
  const { t, locale } = useTranslation();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brand_profiles")
        .select("available_channels")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data?.available_channels ?? []) as unknown;
      const parsed = Array.isArray(raw)
        ? (raw.filter((c) => ALL_CHANNELS.includes(c as Channel)) as Channel[])
        : [];
      setChannels(parsed);
      onChange?.(parsed);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(c: Channel) {
    if (!channels) return;
    const next = channels.includes(c)
      ? channels.filter((x) => x !== c)
      : [...channels, c];
    setChannels(next);
    setSavedAt(null);
  }

  async function handleSave() {
    if (!channels) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("brand_profiles")
        .upsert(
          { project_id: projectId, available_channels: channels },
          { onConflict: "project_id" },
        );
      if (upErr) throw upErr;
      setSavedAt(
        new Date().toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-GB"),
      );
      onChange?.(channels);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (channels === null) {
    return (
      <div
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--muted-text)" }}
      >
        {t("common.loading")}
      </div>
    );
  }

  const empty = channels.length === 0;

  return (
    <div
      className="p-6"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
        style={{ color: "var(--muted-text)" }}
      >
        {t("channelSettings.title")}
      </div>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ink-text)" }}>
        {t("channelSettings.description")}
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {ALL_CHANNELS.map((c) => {
          const on = channels.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors"
              style={{
                border: `1px solid ${on ? "var(--accent-strong)" : "var(--hairline)"}`,
                backgroundColor: on ? "var(--accent-strong)" : "var(--paper)",
                color: on ? "#FFFFFF" : "var(--ink-text)",
                borderRadius: "3px",
              }}
            >
              {on && <Check size={12} strokeWidth={2} />}
              {CHANNEL_LABEL[c]}
            </button>
          );
        })}
      </div>

      {empty && (
        <div
          className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--danger)" }}
        >
          {t("channelSettings.pickOne")}
        </div>
      )}

      {error && (
        <div
          className="font-mono text-[10px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent-strong)",
            color: "#FFFFFF",
            borderRadius: "3px",
          }}
        >
          <FloppyDisk size={14} strokeWidth={1.75} />
          {saving ? t("channelSettings.saving") : t("channelSettings.save")}
        </button>
        {savedAt && (
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted-text)" }}
          >
            {t("channelSettings.savedAt", { time: savedAt })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PaperPlaneTilt, ChatCircleText, CheckCircle, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { strategistChat, approveCampaignPlan } from "@/lib/strategist-chat.functions";
import { CHANNEL_LABEL, localizedPackageName, localizedPackageDescription, type AdaptedPlan, type Channel } from "@/lib/campaign-packages";
import { getFrameworkDisplayName } from "@/lib/marketing-frameworks";
import { CampaignGeneratePanel } from "@/components/CampaignGeneratePanel";
import { useTranslation } from "@/i18n/I18nProvider";

type Turn = { role: "user" | "assistant"; content: string };

type Props = {
  projectId: string;
  availableChannels: Channel[];
  onApproved?: (campaignId: string, plan: AdaptedPlan) => void;
};

export function StrategistChat({ projectId, availableChannels, onApproved }: Props) {
  const { t, locale, dir } = useTranslation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdaptedPlan | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const chatFn = useServerFn(strategistChat);
  const approveFn = useServerFn(approveCampaignPlan);

  const noChannels = availableChannels.length === 0;
  const channelSep = locale === "en" ? ", " : "، ";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, plan]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy || noChannels) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatFn({ data: { projectId, messages: next } });
      if (res.phase === "clarify") {
        setTurns([...next, { role: "assistant", content: res.message }]);
      } else {
        setTurns([...next, { role: "assistant", content: res.message }]);
        setPlan(res.plan);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!plan) return;
    setApproving(true);
    setError(null);
    try {
      const r = await approveFn({ data: { projectId, plan } });
      setApprovedId(r.campaign_id);
      onApproved?.(r.campaign_id, plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("strategist.approveFailed"));
    } finally {
      setApproving(false);
    }
  }

  function reset() {
    setTurns([]);
    setPlan(null);
    setApprovedId(null);
    setError(null);
  }

  return (
    <div
      className="p-5"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <ChatCircleText size={18} strokeWidth={1.75} style={{ color: "var(--accent-strong)" }} />
        <div className="font-display text-[18px]" style={{ color: "var(--ink-text)", fontWeight: 500 }}>
          {t("strategist.title")}
        </div>
      </div>

      {noChannels && (
        <div
          className="p-3 mb-4 font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{
            border: "1px solid var(--hairline)",
            backgroundColor: "var(--surface)",
            color: "var(--muted-text)",
            borderRadius: "3px",
          }}
        >
          {t("strategist.enableChannelsFirst")}
        </div>
      )}

      <div
        ref={scrollRef}
        className="space-y-3 mb-4 overflow-y-auto p-2"
        style={{ maxHeight: "360px", minHeight: "180px" }}
      >
        {turns.length === 0 && <Bubble role="assistant" text={t("strategist.greeting")} dir={dir} />}
        {turns.map((turn, i) => (
          <Bubble key={i} role={turn.role} text={turn.content} dir={dir} />
        ))}
        {busy && (
          <div
            className="inline-flex items-center gap-2 px-3 py-2 text-sm"
            style={{ color: "var(--muted-text)" }}
          >
            <CircleNotch size={14} strokeWidth={2} className="animate-spin" />
            {t("strategist.thinking")}
          </div>
        )}
      </div>

      {!plan && !approvedId && (
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("strategist.inputPlaceholder")}
            rows={2}
            disabled={busy || noChannels}
            className="flex-1 p-3 text-sm resize-none"
            style={{
              border: "1px solid var(--hairline)",
              backgroundColor: "var(--paper)",
              color: "var(--ink-text)",
              borderRadius: "3px",
              direction: dir,
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || noChannels || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent-strong)",
              color: "#FFFFFF",
              borderRadius: "3px",
            }}
          >
            <PaperPlaneTilt size={14} strokeWidth={1.75} />
            {t("strategist.send")}
          </button>
        </div>
      )}

      {error && (
        <div
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {plan && !approvedId && (
        <div
          className="mt-4 p-4"
          style={{
            border: "1px solid var(--accent-strong)",
            borderRadius: "4px",
            backgroundColor: "var(--surface)",
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
            style={{ color: "var(--muted-text)" }}
          >
            {t("strategist.proposedPlan")}
          </div>
          <div className="font-display text-[18px] mb-1" style={{ color: "var(--ink-text)", fontWeight: 500 }}>
            {localizedPackageName(plan.package_id, plan.package_name_ar, t)}
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--ink-text)" }}>
            {localizedPackageDescription(plan.package_id, plan.description_ar, t)}
          </p>
          <div className="text-sm mb-3" style={{ color: "var(--ink-text)" }}>
            {t("strategist.planSummary", {
              posts: plan.total_posts,
              channels: plan.channels.map((c) => CHANNEL_LABEL[c]).join(channelSep),
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {plan.frameworks.map((f) => (
              <span
                key={f}
                className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-1"
                style={{
                  border: "1px solid var(--hairline)",
                  color: "var(--muted-text)",
                  borderRadius: "2px",
                }}
              >
                {getFrameworkDisplayName(f, locale)}
              </span>
            ))}
          </div>
          {plan.adaptation_note_ar && (
            <div
              className="text-[12px] leading-relaxed mb-3 p-2"
              style={{
                color: "var(--muted-text)",
                backgroundColor: "var(--paper)",
                borderRadius: "3px",
              }}
            >
              {plan.adaptation_note_ar}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={approving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent-strong)",
                color: "#FFFFFF",
                borderRadius: "3px",
              }}
            >
              {approving ? (
                <CircleNotch size={14} strokeWidth={2} className="animate-spin" />
              ) : (
                <Sparkle size={14} strokeWidth={1.75} />
              )}
              {t("strategist.approvePlan")}
            </button>
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="text-sm"
              style={{ color: "var(--muted-text)" }}
            >
              {t("strategist.editInChat")}
            </button>
          </div>
        </div>
      )}

      {approvedId && (
        <div
          className="mt-4 p-4"
          style={{
            border: "1px solid var(--accent-strong)",
            borderRadius: "4px",
            backgroundColor: "var(--surface)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle
                size={18}
                weight="fill"
                style={{ color: "var(--accent-strong)" }}
              />
              <span style={{ color: "var(--ink-text)" }}>{t("strategist.planApproved")}</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-sm"
              style={{ color: "var(--muted-text)" }}
            >
              {t("strategist.newPlan")}
            </button>
          </div>
          <CampaignGeneratePanel campaignId={approvedId} />
        </div>
      )}
    </div>
  );
}

function Bubble({ role, text, dir }: { role: "user" | "assistant"; text: string; dir: "rtl" | "ltr" }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className="px-3 py-2 text-sm max-w-[85%] leading-relaxed"
        style={{
          backgroundColor: isUser ? "var(--accent-strong)" : "var(--surface)",
          color: isUser ? "#FFFFFF" : "var(--ink-text)",
          border: isUser ? "none" : "1px solid var(--hairline)",
          borderRadius: "4px",
          direction: dir,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

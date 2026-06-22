import { useMemo, useState } from "react";
import {
  Lightning,
  Rocket,
  Megaphone,
  UsersThree,
  GraduationCap,
  PaperPlaneTilt,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  CAMPAIGN_PACKAGES,
  CHANNEL_LABEL_AR,
  adaptPackageToAvailable,
  type AdaptedPlan,
  type CampaignPackage,
  type Channel,
} from "@/lib/campaign-packages";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  limited_offer: Lightning,
  product_launch: Rocket,
  brand_awareness: Megaphone,
  lead_gen: UsersThree,
  value_authority: GraduationCap,
  quick_post: PaperPlaneTilt,
};

type Props = {
  availableChannels: Channel[];
  onSelectPlan: (plan: AdaptedPlan) => void;
};

export function PackageGallery({ availableChannels, onSelectPlan }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const adapted = useMemo(() => {
    return CAMPAIGN_PACKAGES.map((pkg) => ({
      pkg,
      result: adaptPackageToAvailable(pkg, availableChannels),
    }));
  }, [availableChannels]);

  const noChannels = availableChannels.length === 0;

  return (
    <div>
      {noChannels && (
        <div
          className="p-4 mb-5 font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{
            border: "1px solid var(--hairline)",
            backgroundColor: "var(--surface)",
            color: "var(--muted-text)",
            borderRadius: "3px",
          }}
        >
          فعّل القنوات المتاحة من فوق الأول علشان نقدر نكيّف الباكدچات على
          قنواتك.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adapted.map(({ pkg, result }) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            disabled={noChannels || !result.ok}
            adaptedChannels={result.ok ? result.plan.channels : []}
            totalPosts={result.ok ? result.plan.total_posts : pkg.default_post_count}
            adaptationNote={
              result.ok ? result.plan.adaptation_note_ar : result.reason_ar
            }
            isSelected={selectedId === pkg.id}
            onPick={() => {
              if (!result.ok) return;
              setSelectedId(pkg.id);
              onSelectPlan(result.plan);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PackageCard({
  pkg,
  adaptedChannels,
  totalPosts,
  adaptationNote,
  disabled,
  isSelected,
  onPick,
}: {
  pkg: CampaignPackage;
  adaptedChannels: Channel[];
  totalPosts: number;
  adaptationNote: string | null;
  disabled: boolean;
  isSelected: boolean;
  onPick: () => void;
}) {
  const Icon = ICONS[pkg.id] ?? Megaphone;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="text-right p-5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        border: `1px solid ${isSelected ? "var(--accent-strong)" : "var(--hairline)"}`,
        backgroundColor: isSelected ? "var(--surface)" : "var(--paper)",
        borderRadius: "4px",
        boxShadow: isSelected ? "0 0 0 2px var(--accent-strong) inset" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 inline-flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent-soft, #FEF3C7)",
              borderRadius: "3px",
              color: "var(--accent-strong)",
            }}
          >
            <Icon size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div
              className="font-display text-[18px] leading-tight"
              style={{ color: "var(--ink-text)", fontWeight: 500 }}
            >
              {pkg.name_ar}
            </div>
            <div
              className="font-mono text-[10px] uppercase tracking-[0.18em] mt-1"
              style={{ color: "var(--muted-text)" }}
            >
              {pkg.funnel_focus}
            </div>
          </div>
        </div>
        {isSelected && (
          <CheckCircle
            size={20}
            strokeWidth={1.75}
            weight="fill"
            style={{ color: "var(--accent-strong)" }}
          />
        )}
      </div>

      <p
        className="text-sm leading-relaxed mb-4"
        style={{ color: "var(--ink-text)" }}
      >
        {pkg.description_ar}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Pill label={`${totalPosts} بوست`} strong />
        {adaptedChannels.length > 0 ? (
          adaptedChannels.map((c) => <Pill key={c} label={CHANNEL_LABEL_AR[c]} />)
        ) : pkg.ideal_channels === "client_choice" ? (
          <Pill label="القنوات: على اختيارك" />
        ) : (
          <Pill
            label={
              "المثالي: " +
              pkg.ideal_channels.map((c) => CHANNEL_LABEL_AR[c]).join("، ")
            }
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {pkg.frameworks.map((f) => (
          <span
            key={f}
            className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-1"
            style={{
              border: "1px solid var(--hairline)",
              color: "var(--muted-text)",
              borderRadius: "2px",
            }}
          >
            {f}
          </span>
        ))}
      </div>

      {adaptationNote && (
        <div
          className="text-[12px] leading-relaxed mt-3 p-2"
          style={{
            color: "var(--muted-text)",
            backgroundColor: "var(--surface)",
            borderRadius: "3px",
          }}
        >
          {adaptationNote}
        </div>
      )}
    </button>
  );
}

function Pill({ label, strong = false }: { label: string; strong?: boolean }) {
  return (
    <span
      className="text-[12px] px-2.5 py-1"
      style={{
        border: `1px solid ${strong ? "var(--accent-strong)" : "var(--hairline)"}`,
        backgroundColor: strong ? "var(--accent-strong)" : "var(--paper)",
        color: strong ? "#FFFFFF" : "var(--ink-text)",
        borderRadius: "2px",
      }}
    >
      {label}
    </span>
  );
}

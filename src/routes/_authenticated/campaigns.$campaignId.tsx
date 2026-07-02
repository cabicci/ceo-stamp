import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { PostPreview, type BrandIdentity, type ContentItemPreview, type ImageSource, type Platform } from "@/components/post-preview";
import { CHANNEL_LABEL, localizedPackageName, localizedPackageDescription, type Channel, ALL_CHANNELS } from "@/lib/campaign-packages";
import type { ContentLanguage } from "@/lib/campaign-generation.types";
import { formatFrameworksDisplay } from "@/lib/marketing-frameworks";
import { useTranslation } from "@/i18n/I18nProvider";
import { PostCopyPublishBar } from "@/components/campaign/PostCopyPublishBar";
import { ExportCampaignReportButton } from "@/components/ExportCampaignReportButton";
import {
  buildPostSlotIndexMap,
  orderContentItemsForDisplay,
  postSlotLabel,
} from "@/lib/campaign-content-order";

export const Route = createFileRoute("/_authenticated/campaigns/$campaignId")({
  head: () => ({ meta: [{ title: "Marketing CEO — Campaign" }] }),
  component: CampaignPage,
});

type CampaignPlan = {
  package_id?: string;
  package_name_ar?: string;
  description_ar?: string;
  objective?: string;
  frameworks?: string[];
  funnel_focus?: string;
  total_posts?: number;
  channels?: string[];
  post_slot_count?: number;
  content_items_expected?: number;
  content_language?: ContentLanguage;
  image_text_enabled?: boolean;
  image_text_language?: string;
};

type ContentRow = {
  id: string;
  platform: string;
  content_type: string | null;
  copy: string | null;
  media_brief: string | null;
  image_url: string | null;
  image_source: string | null;
  framework_applied: string | null;
  rationale: string | null;
  scheduled_date: string | null;
  locale: string;
  adapted_from_id: string | null;
};

type AdRow = {
  id: string;
  platform: string;
  variant_label: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  framework_applied: string | null;
  rationale: string | null;
  locale: string;
  adapted_from_id: string | null;
};

type AdGroup = { original: AdRow; adaptation: AdRow | null };

function resolvePlanChannels(
  plan: CampaignPlan | null,
  items: ContentRow[],
): Channel[] {
  const fromPlan = plan?.channels?.filter((c): c is Channel =>
    ALL_CHANNELS.includes(c as Channel),
  );
  if (fromPlan && fromPlan.length > 0) return fromPlan;
  const seen = new Set<Channel>();
  const out: Channel[] = [];
  for (const item of items) {
    const c = item.platform as Channel;
    if (ALL_CHANNELS.includes(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

function toPreviewPlatform(platform: string): Platform {
  if (platform === "x") return "twitter";
  return platform as Platform;
}

function resolvePackageName(
  t: (key: string) => string,
  plan: CampaignPlan | null,
): string {
  if (!plan?.package_id) return plan?.package_name_ar ?? t("campaignPage.defaultName");
  return localizedPackageName(plan.package_id, plan.package_name_ar ?? t("campaignPage.defaultName"), t);
}

function resolvePackageDescription(
  t: (key: string) => string,
  plan: CampaignPlan | null,
): string | null {
  if (!plan?.package_id) return plan?.description_ar ?? null;
  return localizedPackageDescription(plan.package_id, plan.description_ar ?? "", t) || null;
}

function buildAdGroups(ads: AdRow[]): AdGroup[] {
  const originals = ads.filter((a) => !a.adapted_from_id);
  const adaptationsByParent = new Map<string, AdRow>();
  for (const a of ads) {
    if (a.adapted_from_id) adaptationsByParent.set(a.adapted_from_id, a);
  }
  return originals.map((original) => ({
    original,
    adaptation: adaptationsByParent.get(original.id) ?? null,
  }));
}

function LocaleToggle({
  view,
  onChange,
  hasArabic,
  hasEnglish,
}: {
  view: "ar" | "en";
  onChange: (v: "ar" | "en") => void;
  hasArabic: boolean;
  hasEnglish: boolean;
}) {
  const { t } = useTranslation();
  if (!hasArabic || !hasEnglish) return null;
  return (
    <div className="inline-flex gap-1 mb-2">
      {(["ar", "en"] as const).map((loc) => {
        const active = view === loc;
        const label = loc === "ar" ? t("campaignPage.localeAr") : t("campaignPage.localeEn");
        const disabled = loc === "ar" ? !hasArabic : !hasEnglish;
        return (
          <button
            key={loc}
            type="button"
            disabled={disabled}
            onClick={() => onChange(loc)}
            className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] disabled:opacity-40"
            style={{
              border: `1px solid ${active ? "var(--accent-strong)" : "var(--hairline)"}`,
              backgroundColor: active ? "var(--accent)" : "transparent",
              color: "var(--ink-text)",
              borderRadius: "2px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PostCard({
  row,
  slotNumber,
  brand,
  projectId,
  onImageChange,
}: {
  row: ContentRow;
  slotNumber: number;
  brand: BrandIdentity;
  projectId: string | null;
  onImageChange: (
    contentItemId: string,
    next: { image_url: string | null; image_source: ImageSource | null },
  ) => void;
}) {
  const { t } = useTranslation();
  if (!row.copy) return null;

  const channelLabel = CHANNEL_LABEL[row.platform as Channel] ?? row.platform;
  const languageLabel =
    row.locale === "ar" ? t("campaignPage.localeAr") : t("campaignPage.localeEn");

  const item: ContentItemPreview = {
    id: row.id,
    platform: toPreviewPlatform(row.platform),
    copy: row.copy,
    media_brief: row.media_brief,
    content_type: row.content_type,
    image_url: row.image_url,
    image_source: (row.image_source as ImageSource | null) ?? null,
  };

  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 flex flex-wrap gap-x-2 gap-y-1"
        style={{ color: "var(--ink-text)" }}
      >
        <span style={{ fontWeight: 600 }}>
          {t("campaignPage.postSlot", { number: slotNumber })}
        </span>
        <span style={{ color: "var(--muted-text)" }}>·</span>
        <span>{channelLabel}</span>
        <span style={{ color: "var(--muted-text)" }}>·</span>
        <span>{languageLabel}</span>
      </div>
      <div
        className="font-mono text-[9px] uppercase tracking-[0.16em] mb-2 flex flex-wrap gap-2 items-center"
        style={{ color: "var(--muted-text)" }}
      >
        {row.scheduled_date && <span>{row.scheduled_date}</span>}
      </div>
      {row.framework_applied && (
        <div className="mb-2">
          <span
            className="inline-block px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{
              color: "var(--ink-text)",
              backgroundColor: "var(--accent)",
              border: "1px solid var(--accent-strong)",
              borderRadius: "3px",
            }}
          >
            {t("campaign.results.frameworkLabel")}: {row.framework_applied}
          </span>
        </div>
      )}
      <PostPreview
        item={item}
        brand={brand}
        projectId={projectId ?? undefined}
        editable
        onImageChange={(next) => onImageChange(row.id, next)}
      />
      <PostCopyPublishBar
        copy={row.copy}
        platform={row.platform}
        imageUrl={row.image_url}
        copyLocale={row.locale}
      />
      {row.rationale && (
        <div
          className="mt-2 p-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.16em] mb-1.5"
            style={{ color: "var(--muted-text)" }}
          >
            {t("campaign.results.rationaleLabel")}
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-text)" }}>
            {row.rationale}
          </p>
        </div>
      )}
    </div>
  );
}

function AdGroupCard({ group }: { group: AdGroup }) {
  const { t } = useTranslation();
  const hasPair = !!group.adaptation;
  const defaultView: "ar" | "en" =
    group.original.locale === "en" && !hasPair ? "en" : "ar";
  const [view, setView] = useState<"ar" | "en">(defaultView);

  const active = view === "en" && group.adaptation ? group.adaptation : group.original;

  return (
    <div
      className="p-4"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >
      {hasPair && (
        <LocaleToggle
          view={view}
          onChange={setView}
          hasArabic
          hasEnglish={!!group.adaptation}
        />
      )}
      <div
        className="font-mono text-[9px] uppercase tracking-[0.18em] mb-2"
        style={{ color: "var(--muted-text)" }}
      >
        {CHANNEL_LABEL[active.platform as Channel] ?? active.platform}
        {active.variant_label
          ? ` · ${t("campaignPage.variant", { label: active.variant_label })}`
          : ""}
        {hasPair ? ` · ${t("campaignPage.pairedAd")}` : ""}
        <span>
          {" "}
          · {active.locale === "ar" ? t("campaignPage.localeAr") : t("campaignPage.localeEn")}
        </span>
      </div>
      {active.framework_applied && (
        <div className="mb-2">
          <span
            className="inline-block px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{
              color: "var(--ink-text)",
              backgroundColor: "var(--accent)",
              border: "1px solid var(--accent-strong)",
              borderRadius: "3px",
            }}
          >
            {t("campaign.results.frameworkLabel")}: {active.framework_applied}
          </span>
        </div>
      )}
      {active.headline && (
        <div
          className="font-display text-[16px] mb-1"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
        >
          {active.headline}
        </div>
      )}
      {active.body && (
        <p className="text-sm mb-2" style={{ color: "var(--ink-text)" }}>
          {active.body}
        </p>
      )}
      {active.cta && (
        <div
          className="inline-block text-sm px-3 py-1"
          style={{
            backgroundColor: "var(--accent-strong)",
            color: "#FFFFFF",
            borderRadius: "3px",
          }}
        >
          {active.cta}
        </div>
      )}
      {active.rationale && (
        <div
          className="mt-3 p-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.16em] mb-1.5"
            style={{ color: "var(--muted-text)" }}
          >
            {t("campaign.results.rationaleLabel")}
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-text)" }}>
            {active.rationale}
          </p>
        </div>
      )}
    </div>
  );
}

function CampaignPage() {
  const { campaignId } = Route.useParams();
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [contentItems, setContentItems] = useState<ContentRow[]>([]);
  const [adCopies, setAdCopies] = useState<AdRow[]>([]);
  const [brand, setBrand] = useState<BrandIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: campaign, error: cErr } = await supabase
          .from("campaigns")
          .select("id, project_id, status, start_date, end_date, campaign_plan")
          .eq("id", campaignId)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!campaign) throw new Error(t("campaignPage.notFound"));

        const rawPlan = campaign.campaign_plan as CampaignPlan | null;
        setPlan(rawPlan);
        setProjectId(campaign.project_id);

        const { data: project } = await supabase
          .from("projects")
          .select("name, website_url")
          .eq("id", campaign.project_id)
          .maybeSingle();

        const { data: profile } = await supabase
          .from("brand_profiles")
          .select("brand_colors")
          .eq("project_id", campaign.project_id)
          .maybeSingle();

        setBrand({
          name: project?.name ?? t("campaignPage.defaultBrand"),
          website: project?.website_url ?? undefined,
          brand_colors: Array.isArray(profile?.brand_colors)
            ? (profile.brand_colors as string[])
            : undefined,
        });

        const { data: items, error: iErr } = await supabase
          .from("content_items")
          .select(
            "id, platform, content_type, copy, media_brief, image_url, image_source, framework_applied, rationale, scheduled_date, locale, adapted_from_id",
          )
          .eq("campaign_id", campaignId)
          .order("scheduled_date", { ascending: true });
        if (iErr) throw iErr;
        setContentItems(items ?? []);

        const { data: ads, error: aErr } = await supabase
          .from("ad_copies")
          .select(
            "id, platform, variant_label, headline, body, cta, framework_applied, rationale, locale, adapted_from_id",
          )
          .eq("campaign_id", campaignId)
          .order("platform", { ascending: true });
        if (aErr) throw aErr;
        setAdCopies(ads ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("campaignPage.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  const planDescription = useMemo(() => resolvePackageDescription(t, plan), [t, plan]);
  const displayName = useMemo(() => resolvePackageName(t, plan), [t, plan]);
  const planChannels = useMemo(
    () => resolvePlanChannels(plan, contentItems),
    [plan, contentItems],
  );
  const orderedPosts = useMemo(
    () => orderContentItemsForDisplay(contentItems, planChannels).filter((p) => p.copy),
    [contentItems, planChannels],
  );
  const postSlotMap = useMemo(
    () => buildPostSlotIndexMap(contentItems, planChannels),
    [contentItems, planChannels],
  );
  const adGroups = useMemo(() => buildAdGroups(adCopies), [adCopies]);

  async function handleImageChange(
    contentItemId: string,
    next: { image_url: string | null; image_source: ImageSource | null },
  ) {
    const { error: updErr } = await supabase
      .from("content_items")
      .update({ image_url: next.image_url, image_source: next.image_source })
      .eq("id", contentItemId);
    if (updErr) {
      console.error(updErr);
      return;
    }
    setContentItems((prev) =>
      prev.map((row) =>
        row.id === contentItemId
          ? { ...row, image_url: next.image_url, image_source: next.image_source }
          : row,
      ),
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {projectId && (
          <Link
            to="/projects/$id"
            params={{ id: projectId }}
            className="inline-flex items-center gap-2 text-sm mb-6"
            style={{ color: "var(--muted-text)" }}
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            {t("campaignPage.backToProject")}
          </Link>
        )}

        {loading && (
          <div className="text-sm" style={{ color: "var(--muted-text)" }}>
            {t("common.loading")}
          </div>
        )}

        {error && (
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-8">
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                style={{ color: "var(--muted-text)" }}
              >
                {t("campaignPage.generatedContent")}
              </div>
              <h1
                className="font-display text-[28px] mb-2"
                style={{ color: "var(--ink-text)", fontWeight: 500 }}
              >
                {displayName}
              </h1>
              {planDescription && (
                <p className="text-sm mb-2" style={{ color: "var(--ink-text)" }}>
                  {planDescription}
                </p>
              )}
              {plan?.frameworks && plan.frameworks.length > 0 && (
                <p className="text-sm mb-4" style={{ color: "var(--muted-text)" }}>
                  {t("campaignPage.frameworks", {
                    frameworks: formatFrameworksDisplay(plan.frameworks, locale),
                  })}
                </p>
              )}
              <ExportCampaignReportButton campaignId={campaignId} />
            </div>

            <section className="mb-12 pb-10" style={{ borderBottom: "2px solid var(--hairline)" }}>
              <SectionLabel>
                {t("campaign.results.postsSection", { count: orderedPosts.length })}
              </SectionLabel>
              {orderedPosts.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                  {t("campaignPage.noPosts")}
                </p>
              ) : (
                <div className="grid gap-8 lg:grid-cols-2">
                  {brand &&
                    orderedPosts.map((row) => {
                      const slotIdx = postSlotMap.get(row.id) ?? 0;
                      return (
                        <PostCard
                          key={row.id}
                          row={row}
                          slotNumber={postSlotLabel(slotIdx)}
                          brand={brand}
                          projectId={projectId}
                          onImageChange={handleImageChange}
                        />
                      );
                    })}
                </div>
              )}
            </section>

            <section className="pt-2">
              <SectionLabel>
                {t("campaign.results.adsSection", { count: adGroups.length })}
              </SectionLabel>
              {adGroups.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                  {t("campaignPage.noAds")}
                </p>
              ) : (
                <div className="space-y-4">
                  {adGroups.map((group) => (
                    <AdGroupCard key={group.original.id} group={group} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-[0.22em] mb-4"
      style={{ color: "var(--muted-text)" }}
    >
      {children}
    </div>
  );
}

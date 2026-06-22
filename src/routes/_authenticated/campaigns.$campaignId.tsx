import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { PostPreview, type BrandIdentity, type ContentItemPreview, type Platform } from "@/components/post-preview";
import { CHANNEL_LABEL_AR, type Channel } from "@/lib/campaign-packages";
import { formatFrameworksDisplay } from "@/lib/marketing-frameworks";

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
};

type ContentRow = {
  id: string;
  platform: string;
  content_type: string | null;
  copy: string | null;
  media_brief: string | null;
  framework_applied: string | null;
  rationale: string | null;
  scheduled_date: string | null;
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
};

function toPreviewPlatform(platform: string): Platform {
  if (platform === "x") return "twitter";
  return platform as Platform;
}

function CampaignPage() {
  const { campaignId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
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
        if (!campaign) throw new Error("الحملة مش موجودة.");

        const rawPlan = campaign.campaign_plan as CampaignPlan | null;
        setPlan(rawPlan);
        setCampaignName(rawPlan?.package_name_ar ?? "حملة");
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
          name: project?.name ?? "البراند",
          website: project?.website_url ?? undefined,
          brand_colors: Array.isArray(profile?.brand_colors)
            ? (profile.brand_colors as string[])
            : undefined,
        });

        const { data: items, error: iErr } = await supabase
          .from("content_items")
          .select(
            "id, platform, content_type, copy, media_brief, framework_applied, rationale, scheduled_date",
          )
          .eq("campaign_id", campaignId)
          .order("scheduled_date", { ascending: true });
        if (iErr) throw iErr;
        setContentItems(items ?? []);

        const { data: ads, error: aErr } = await supabase
          .from("ad_copies")
          .select(
            "id, platform, variant_label, headline, body, cta, framework_applied, rationale",
          )
          .eq("campaign_id", campaignId)
          .order("platform", { ascending: true });
        if (aErr) throw aErr;
        setAdCopies(ads ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "فشل تحميل الحملة");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const previews = useMemo(() => {
    if (!brand) return [];
    return contentItems
      .filter((ci) => ci.copy)
      .map((ci) => ({
        id: ci.id,
        item: {
          id: ci.id,
          platform: toPreviewPlatform(ci.platform),
          copy: ci.copy ?? "",
          media_brief: ci.media_brief,
          content_type: ci.content_type,
        } satisfies ContentItemPreview,
        meta: ci,
      }));
  }, [contentItems, brand]);

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
            رجوع للمشروع
          </Link>
        )}

        {loading && (
          <div className="text-sm" style={{ color: "var(--muted-text)" }}>
            بيتحمّل…
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
                المحتوى المولّد
              </div>
              <h1
                className="font-display text-[28px] mb-2"
                style={{ color: "var(--ink-text)", fontWeight: 500 }}
              >
                {campaignName}
              </h1>
              {plan?.description_ar && (
                <p className="text-sm mb-2" style={{ color: "var(--ink-text)" }}>
                  {plan.description_ar}
                </p>
              )}
              {plan?.frameworks && plan.frameworks.length > 0 && (
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                  الأطر: {formatFrameworksDisplay(plan.frameworks)}
                </p>
              )}
            </div>

            <section className="mb-12">
              <SectionLabel>
                البوستات ({contentItems.length})
              </SectionLabel>
              {previews.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                  مفيش بوستات لسه.
                </p>
              ) : (
                <div className="grid gap-8 lg:grid-cols-2">
                  {previews.map(({ id, item, meta }) => (
                    <div key={id}>
                      <div
                        className="font-mono text-[9px] uppercase tracking-[0.18em] mb-2 flex flex-wrap gap-2"
                        style={{ color: "var(--muted-text)" }}
                      >
                        <span>
                          {CHANNEL_LABEL_AR[meta.platform as Channel] ?? meta.platform}
                        </span>
                        {meta.scheduled_date && <span>· {meta.scheduled_date}</span>}
                        {meta.framework_applied && (
                          <span>· {meta.framework_applied}</span>
                        )}
                      </div>
                      {brand && (
                        <PostPreview item={item} brand={brand} projectId={projectId ?? undefined} />
                      )}
                      {meta.rationale && (
                        <p
                          className="mt-2 text-[12px] leading-relaxed p-2"
                          style={{
                            color: "var(--muted-text)",
                            backgroundColor: "var(--surface)",
                            borderRadius: "3px",
                          }}
                        >
                          {meta.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel>الإعلانات ({adCopies.length})</SectionLabel>
              {adCopies.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-text)" }}>
                  مفيش إعلانات لسه.
                </p>
              ) : (
                <div className="space-y-4">
                  {adCopies.map((ad) => (
                    <div
                      key={ad.id}
                      className="p-4"
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: "4px",
                        backgroundColor: "var(--paper)",
                      }}
                    >
                      <div
                        className="font-mono text-[9px] uppercase tracking-[0.18em] mb-2"
                        style={{ color: "var(--muted-text)" }}
                      >
                        {CHANNEL_LABEL_AR[ad.platform as Channel] ?? ad.platform}
                        {ad.variant_label ? ` · variant ${ad.variant_label}` : ""}
                        {ad.framework_applied ? ` · ${ad.framework_applied}` : ""}
                      </div>
                      {ad.headline && (
                        <div
                          className="font-display text-[16px] mb-1"
                          style={{ color: "var(--ink-text)", fontWeight: 500 }}
                        >
                          {ad.headline}
                        </div>
                      )}
                      {ad.body && (
                        <p className="text-sm mb-2" style={{ color: "var(--ink-text)" }}>
                          {ad.body}
                        </p>
                      )}
                      {ad.cta && (
                        <div
                          className="inline-block text-sm px-3 py-1"
                          style={{
                            backgroundColor: "var(--accent-strong)",
                            color: "#FFFFFF",
                            borderRadius: "3px",
                          }}
                        >
                          {ad.cta}
                        </div>
                      )}
                      {ad.rationale && (
                        <p className="mt-2 text-[12px]" style={{ color: "var(--muted-text)" }}>
                          {ad.rationale}
                        </p>
                      )}
                    </div>
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

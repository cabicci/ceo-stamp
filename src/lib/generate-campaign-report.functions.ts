import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ar from "@/i18n/locales/ar.json";
import en from "@/i18n/locales/en.json";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_CHANNELS,
  CHANNEL_LABEL,
  CHANNEL_LABEL_AR,
  localizedPackageDescription,
  localizedPackageName,
  type AdaptedPlan,
  type Channel,
} from "@/lib/campaign-packages";
import { formatFrameworksDisplay } from "@/lib/marketing-frameworks";
import type {
  CampaignReportAd,
  CampaignReportData,
  CampaignReportPost,
} from "@/lib/report/campaign-report.types";
import { fetchImageAsDataUri } from "@/lib/report/fetch-report-image";
import type { ReportLocale } from "@/lib/report/types";
import { buildCampaignReportPdf } from "@/lib/report/render-report-pdf";

const InputSchema = z.object({
  campaignId: z.string().uuid(),
  locale: z.enum(["ar", "en"]),
});

type Dict = Record<string, unknown>;

function resolvePath(dict: Dict, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Dict)[key] : undefined), dict);
  return typeof value === "string" ? value : path;
}

function makeT(locale: ReportLocale): (key: string) => string {
  const dict = (locale === "ar" ? ar : en) as Dict;
  return (key: string) => resolvePath(dict, key);
}

function platformLabel(platform: string, locale: ReportLocale): string {
  const p = platform === "twitter" ? "x" : platform;
  if ((ALL_CHANNELS as readonly string[]).includes(p)) {
    const ch = p as Channel;
    return locale === "ar" ? CHANNEL_LABEL_AR[ch] : CHANNEL_LABEL[ch];
  }
  return platform;
}

function objectiveLabel(objective: string, locale: ReportLocale): string {
  const key = `report.objectives.${objective}`;
  const label = resolvePath((locale === "ar" ? ar : en) as Dict, key);
  return label !== key ? label : objective;
}

function channelsLabel(channels: string[], locale: ReportLocale): string {
  const sep = locale === "ar" ? "، " : ", ";
  return channels
    .map((c) => platformLabel(c, locale))
    .filter(Boolean)
    .join(sep);
}

export const generateCampaignReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const locale: ReportLocale = data.locale;
    const t = makeT(locale);

    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, project_id, start_date, end_date, campaign_plan, status")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (campErr) throw new Error(campErr.message);
    if (!campaign) {
      throw new Error(
        locale === "ar" ? "الحملة مش موجودة أو مفيش صلاحية." : "Campaign not found or access denied.",
      );
    }

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, website_url")
      .eq("id", campaign.project_id)
      .maybeSingle();
    if (projErr) throw new Error(projErr.message);
    if (!project) {
      throw new Error(
        locale === "ar" ? "المشروع مش موجود." : "Project not found or access denied.",
      );
    }

    const rawPlan = campaign.campaign_plan as AdaptedPlan | null;
    if (!rawPlan) {
      throw new Error(
        locale === "ar"
          ? "مفيش خطة معتمدة على الحملة دي."
          : "No approved plan on this campaign.",
      );
    }

    const { data: items, error: itemsErr } = await supabase
      .from("content_items")
      .select(
        "platform, copy, framework_applied, rationale, scheduled_date, locale, content_type, image_url",
      )
      .eq("campaign_id", data.campaignId)
      .order("scheduled_date", { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);

    const { data: ads, error: adsErr } = await supabase
      .from("ad_copies")
      .select(
        "platform, variant_label, headline, body, cta, framework_applied, rationale, locale",
      )
      .eq("campaign_id", data.campaignId)
      .order("platform", { ascending: true });
    if (adsErr) throw new Error(adsErr.message);

    const postsWithImages = await Promise.all(
      (items ?? []).map(async (row) => {
        const imageDataUri = row.image_url
          ? await fetchImageAsDataUri(row.image_url)
          : null;
        const post: CampaignReportPost = {
          platform: row.platform,
          platformLabel: platformLabel(row.platform, locale),
          copy: row.copy,
          frameworkApplied: row.framework_applied,
          rationale: row.rationale,
          scheduledDate: row.scheduled_date,
          locale: row.locale,
          contentType: row.content_type,
          imageDataUri,
        };
        return post;
      }),
    );

    const reportAds: CampaignReportAd[] = (ads ?? []).map((row) => ({
      platform: row.platform,
      platformLabel: platformLabel(row.platform, locale),
      variantLabel: row.variant_label,
      headline: row.headline,
      body: row.body,
      cta: row.cta,
      frameworkApplied: row.framework_applied,
      rationale: row.rationale,
      locale: row.locale,
    }));

    const campaignData: CampaignReportData = {
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      plan: {
        packageName: localizedPackageName(
          rawPlan.package_id,
          rawPlan.package_name_ar,
          t,
        ),
        description: localizedPackageDescription(
          rawPlan.package_id,
          rawPlan.description_ar,
          t,
        ),
        objectiveLabel: objectiveLabel(rawPlan.objective, locale),
        channelsLabel: channelsLabel(rawPlan.channels, locale),
        funnelFocus: rawPlan.funnel_focus,
        frameworksLabel: formatFrameworksDisplay(rawPlan.frameworks, locale),
        totalPosts: rawPlan.total_posts,
        adaptationNote: rawPlan.adaptation_note_ar,
      },
      posts: postsWithImages.filter((p) => (p.copy ?? "").trim().length > 0),
      ads: reportAds,
    };

    const buffer = await buildCampaignReportPdf({
      locale,
      project: { name: project.name, websiteUrl: project.website_url },
      campaign: campaignData,
    });

    const safeName =
      (localizedPackageName(rawPlan.package_id, rawPlan.package_name_ar, t) || project.name)
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim() || "campaign";
    const filename = `campaign-report-${safeName}.pdf`;

    return {
      pdfBase64: buffer.toString("base64"),
      filename,
    };
  });

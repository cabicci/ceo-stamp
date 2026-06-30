/**
 * Campaign workspace server functions — clone, etc.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CampaignIdInput = z.object({
  campaignId: z.string().uuid(),
});

type CampaignPlanJson = {
  package_name_ar?: string;
  [key: string]: unknown;
};

export const cloneCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CampaignIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: source, error: srcErr } = await supabase
      .from("campaigns")
      .select(
        "id, project_id, objective, channels, start_date, end_date, status, campaign_plan, projects!inner(owner_id)",
      )
      .eq("id", data.campaignId)
      .maybeSingle();

    if (srcErr) throw new Error(srcErr.message);
    if (!source) throw new Error("الحملة مش موجودة أو مفيش صلاحية.");

    const ownerId = (source.projects as { owner_id: string }).owner_id;
    if (ownerId !== userId) throw new Error("غير مصرح");

    const rawPlan = source.campaign_plan as CampaignPlanJson | null;
    const clonedPlan: CampaignPlanJson | null = rawPlan
      ? {
          ...rawPlan,
          package_name_ar: rawPlan.package_name_ar
            ? `${rawPlan.package_name_ar} (نسخة)`
            : rawPlan.package_name_ar,
        }
      : null;

    const status = source.status === "generating" ? "draft" : source.status;

    const { data: newCampaign, error: insErr } = await supabase
      .from("campaigns")
      .insert({
        project_id: source.project_id,
        objective: source.objective,
        channels: source.channels,
        start_date: source.start_date,
        end_date: source.end_date,
        status,
        campaign_plan: clonedPlan as unknown as Json,
        cloned_from_id: source.id,
        is_template: false,
        archived: false,
      })
      .select("id")
      .single();

    if (insErr || !newCampaign) {
      throw new Error(insErr?.message ?? "فشل نسخ الحملة");
    }

    const newCampaignId = newCampaign.id;

    const { data: contentItems, error: ciErr } = await supabase
      .from("content_items")
      .select(
        "id, platform, content_type, copy, media_brief, framework_applied, rationale, locale, adapted_from_id, scheduled_date, status, image_url, image_source",
      )
      .eq("campaign_id", source.id)
      .order("created_at", { ascending: true });

    if (ciErr) throw new Error(ciErr.message);

    const contentIdMap = new Map<string, string>();
    const originals = (contentItems ?? []).filter((i) => !i.adapted_from_id);
    const adaptations = (contentItems ?? []).filter((i) => i.adapted_from_id);

    for (const item of originals) {
      const { data: row, error } = await supabase
        .from("content_items")
        .insert({
          campaign_id: newCampaignId,
          platform: item.platform,
          content_type: item.content_type,
          copy: item.copy,
          media_brief: item.media_brief,
          framework_applied: item.framework_applied,
          rationale: item.rationale,
          locale: item.locale,
          adapted_from_id: null,
          scheduled_date: item.scheduled_date,
          status: item.status,
          image_url: item.image_url,
          image_source: item.image_source,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "فشل نسخ البوستات");
      contentIdMap.set(item.id, row.id);
    }

    for (const item of adaptations) {
      const parentId = item.adapted_from_id
        ? contentIdMap.get(item.adapted_from_id)
        : undefined;
      const { error } = await supabase.from("content_items").insert({
        campaign_id: newCampaignId,
        platform: item.platform,
        content_type: item.content_type,
        copy: item.copy,
        media_brief: item.media_brief,
        framework_applied: item.framework_applied,
        rationale: item.rationale,
        locale: item.locale,
        adapted_from_id: parentId ?? null,
        scheduled_date: item.scheduled_date,
        status: item.status,
        image_url: item.image_url,
        image_source: item.image_source,
      });
      if (error) throw new Error(error.message);
    }

    const { data: adCopies, error: adErr } = await supabase
      .from("ad_copies")
      .select(
        "id, platform, variant_label, headline, body, cta, framework_applied, rationale, locale, adapted_from_id, status",
      )
      .eq("campaign_id", source.id)
      .order("created_at", { ascending: true });

    if (adErr) throw new Error(adErr.message);

    const adIdMap = new Map<string, string>();
    const adOriginals = (adCopies ?? []).filter((a) => !a.adapted_from_id);
    const adAdaptations = (adCopies ?? []).filter((a) => a.adapted_from_id);

    for (const ad of adOriginals) {
      const { data: row, error } = await supabase
        .from("ad_copies")
        .insert({
          campaign_id: newCampaignId,
          platform: ad.platform,
          variant_label: ad.variant_label,
          headline: ad.headline,
          body: ad.body,
          cta: ad.cta,
          framework_applied: ad.framework_applied,
          rationale: ad.rationale,
          locale: ad.locale,
          adapted_from_id: null,
          status: ad.status,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "فشل نسخ الإعلانات");
      adIdMap.set(ad.id, row.id);
    }

    for (const ad of adAdaptations) {
      const parentId = ad.adapted_from_id ? adIdMap.get(ad.adapted_from_id) : undefined;
      const { error } = await supabase.from("ad_copies").insert({
        campaign_id: newCampaignId,
        platform: ad.platform,
        variant_label: ad.variant_label,
        headline: ad.headline,
        body: ad.body,
        cta: ad.cta,
        framework_applied: ad.framework_applied,
        rationale: ad.rationale,
        locale: ad.locale,
        adapted_from_id: parentId ?? null,
        status: ad.status,
      });
      if (error) throw new Error(error.message);
    }

    return { campaign_id: newCampaignId };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_CHANNELS,
  CHANNEL_LABEL_AR,
  constrainPlanToAvailableChannels,
  type AdaptedPlan,
  type Channel,
} from "@/lib/campaign-packages";
import {
  getFrameworkAppliedLabel,
  getFrameworkVocabularyForPrompt,
  renderFrameworkKnowledgeForPrompt,
  resolveFrameworkIds,
} from "@/lib/marketing-frameworks";

const GENERATION_CHANNELS = ["instagram", "facebook", "tiktok", "linkedin", "x"] as const;
type GenerationChannel = (typeof GENERATION_CHANNELS)[number];

const InputSchema = z.object({
  campaignId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const AdaptedPlanSchema = z.object({
  package_id: z.string(),
  package_name_ar: z.string(),
  description_ar: z.string(),
  objective: z.enum(["awareness", "leads", "sales"]),
  frameworks: z.array(z.string()),
  funnel_focus: z.string(),
  channels: z.array(z.string()),
  posts_per_channel: z.record(z.string(), z.number()),
  total_posts: z.number(),
  adaptation_note_ar: z.string().nullable(),
});

const SYSTEM_PROMPT_BASE = `أنت استراتيجي تسويق سينيور بتشتغل لعلامة تجارية في السوق العربي. مهمتك تبني خطة محتوى وإعلانات لحملة واحدة، مبنية على بيانات البراند المعطاية، مش كلام عام.

التزم بالقواعد دي:
1) كل النصوص باللهجة المصرية الدارجة (عامية مصرية)، طبيعية ومش حرفية. ممنوع الفصحى وممنوع ترجمة من الإنجليزي.
2) كل عنصر محتوى أو إعلان لازم يحتوي على:
   - framework_applied: اسم الإطار بالظبط من القاموس المعتمد (مثلاً: "Cialdini — Scarcity"، "Eugene Schwartz — Problem Aware"، "StoryBrand"، "AIDA"، "PAS"، "Byron Sharp — Mental Availability")
   - rationale: جملة أو اتنين بالعربي توضّح إزاي طبّقت المبدأ في النص ده تحديداً — مش جملة عامة. لازم تذكر الحركة اللي عملتها (مثلاً: "استخدمت مبدأ الندرة عند Cialdini عبر مهلة ٤٨ ساعة وكمية محدودة ١٢ كود"، "طبّقت مرحلة Problem Aware بإنّي سمّيت مشكلة ضياع الفلوس في الإعلانات من غير ما أذكر المنتج في الهوك").
   أي عنصر من غير framework_applied + rationale تطبيقي يعتبر فشل.
3) المحتوى لازم يستخدم tone_of_voice و usps و personas و content_pillars من بيانات البراند.
4) لكل قناة: استخدم الشكل المناسب — Facebook (post اجتماعي)، Instagram (caption أو reel script)، LinkedIn (post طويل احترافي)، TikTok (script قصير hook-driven)، X (post قصير tweet-style).
5) scheduled_date للـ content_items لازم تبقى بين start_date و end_date موزّعة على المدة.
6) ad_copies: 2 variants لكل قناة (variant_label: "A" و "B") — headline + body + cta.
7) لازم تلتزم بعدد البوستات لكل قناة بالظبط زي ما هو محدد في البرّيف.

قاموس الأطر المعتمد (استخدم applied_label في framework_applied):
${getFrameworkVocabularyForPrompt()}

ارجع JSON صالح فقط، من غير prose ومن غير markdown fences، بالشكل ده بالظبط:
{
  "content_items": Array<{
    "platform": "instagram" | "facebook" | "linkedin" | "tiktok" | "x",
    "content_type": string,
    "copy": string,
    "media_brief": string,
    "framework_applied": string,
    "rationale": string,
    "scheduled_date": "YYYY-MM-DD"
  }>,
  "ad_copies": Array<{
    "platform": "instagram" | "facebook" | "linkedin" | "tiktok" | "x",
    "variant_label": string,
    "headline": string,
    "body": string,
    "cta": string,
    "framework_applied": string,
    "rationale": string
  }>
}`;

function buildSystemPrompt(frameworkIds: string[]): string {
  const knowledge = renderFrameworkKnowledgeForPrompt(frameworkIds);
  return knowledge ? `${SYSTEM_PROMPT_BASE}\n\n${knowledge}` : SYSTEM_PROMPT_BASE;
}

function normalizePlatform(raw: string): GenerationChannel | null {
  const p = raw.trim().toLowerCase();
  if (p === "twitter") return "x";
  if ((GENERATION_CHANNELS as readonly string[]).includes(p)) return p as GenerationChannel;
  return null;
}

function spreadScheduledDates(count: number, startDate: string, endDate: string): string[] {
  if (count <= 0) return [];
  if (count === 1) return [startDate];
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (end < start) throw new Error("تاريخ النهاية لازم يكون بعد البداية.");
  const span = end.getTime() - start.getTime();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start.getTime() + (span * i) / (count - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
}

function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function buildPostsPerChannelBrief(
  channels: Channel[],
  postsPerChannel: Record<string, number>,
): string {
  return channels
    .map((c) => `- ${c} (${CHANNEL_LABEL_AR[c]}): ${postsPerChannel[c] ?? 1} بوست`)
    .join("\n");
}

export const generateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (data.endDate < data.startDate) {
      throw new Error("تاريخ النهاية لازم يكون بعد تاريخ البداية.");
    }

    // 1) Load approved campaign + plan.
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, project_id, status, campaign_plan")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (campErr) throw new Error(`campaigns: ${campErr.message}`);
    if (!campaign) throw new Error("الحملة مش موجودة أو مفيش صلاحية.");

    if (!campaign.campaign_plan) {
      throw new Error("مفيش خطة معتمدة على الحملة دي — اعتمد الخطة الأول.");
    }

    if (campaign.status === "generating") {
      throw new Error("التوليد شغال بالفعل على الحملة دي.");
    }
    if (campaign.status === "ready") {
      throw new Error("المحتوى اتولّد بالفعل للحملة دي.");
    }

    const { data: existingItems } = await supabase
      .from("content_items")
      .select("id")
      .eq("campaign_id", data.campaignId)
      .limit(1);
    if (existingItems && existingItems.length > 0) {
      throw new Error("فيه محتوى موجود بالفعل على الحملة دي.");
    }

    const rawPlan = AdaptedPlanSchema.parse(campaign.campaign_plan) as AdaptedPlan;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, website_url")
      .eq("id", campaign.project_id)
      .maybeSingle();
    if (projErr) throw new Error(`projects: ${projErr.message}`);
    if (!project) throw new Error("Project not found or access denied");

    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("tone_of_voice, usps, personas, content_pillars, brand_colors, available_channels")
      .eq("project_id", campaign.project_id)
      .maybeSingle();

    const { data: analysisRow } = await supabase
      .from("website_analysis")
      .select("ai_analysis, status, analyzed_at")
      .eq("project_id", campaign.project_id)
      .eq("status", "done")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!brand && !analysisRow) {
      throw new Error(
        "لازم تعمل تحليل للموقع الأول علشان نقدر نولّد حملة مبنية على البراند.",
      );
    }

    const rawAvailable = (brand?.available_channels ?? []) as unknown;
    const available: Channel[] = Array.isArray(rawAvailable)
      ? (rawAvailable.filter((c) => ALL_CHANNELS.includes(c as Channel)) as Channel[])
      : [];

    if (available.length === 0) {
      throw new Error("لازم تحدد القنوات المتاحة من إعدادات المشروع قبل التوليد.");
    }

    const plan = constrainPlanToAvailableChannels(rawPlan, available);
    const channels = plan.channels;
    const frameworkIds = resolveFrameworkIds(plan.frameworks);
    const expectedContentTotal = plan.total_posts;
    const expectedAdsPerChannel = 2;

    const brandContext = {
      project_name: project.name,
      website_url: project.website_url,
      brand_profile: brand
        ? {
            tone_of_voice: brand.tone_of_voice,
            usps: brand.usps,
            personas: brand.personas,
            content_pillars: brand.content_pillars,
          }
        : null,
      website_analysis: analysisRow?.ai_analysis ?? null,
    };

    const systemPrompt = buildSystemPrompt(frameworkIds);

    const userContent = `بيانات البراند والتحليل (استخدمها حرفيًا، مفيش كلام عام):
${JSON.stringify(brandContext, null, 2)}

برّيف الحملة المعتمدة:
- campaign_type (package_id): ${plan.package_id}
- package_name_ar: ${plan.package_name_ar}
- description_ar: ${plan.description_ar}
- objective: ${plan.objective}
- funnel_focus: ${plan.funnel_focus}
- start_date: ${data.startDate}
- end_date: ${data.endDate}
- posts_per_channel (التزم بالأعداد دي بالظبط):
${buildPostsPerChannelBrief(channels, plan.posts_per_channel)}
- مجموع content_items المطلوب: ${expectedContentTotal}
- لكل قناة: ${expectedAdsPerChannel} إعلانين (variants A و B)
${frameworkIds.length > 0 ? `- frameworks (طبّقها في النسخ): ${frameworkIds.map((id) => getFrameworkAppliedLabel(id)).join("، ")}` : ""}
${plan.adaptation_note_ar ? `- ملاحظة تكييف: ${plan.adaptation_note_ar}` : ""}

وزّع scheduled_date بشكل متفرّق بين ${data.startDate} و ${data.endDate}. ابدأ توليد JSON دلوقتي.`;

    // 2) Mark generating.
    const { error: genErr } = await supabase
      .from("campaigns")
      .update({ status: "generating" })
      .eq("id", data.campaignId);
    if (genErr) throw new Error(`campaigns update: ${genErr.message}`);

    try {
      const { callAI } = await import("@/lib/ai/ai.server");
      const aiResult = (await callAI({
        task: "content_generation",
        systemPrompt,
        userContent,
        jsonMode: true,
        logContext: { projectId: campaign.project_id },
      })) as {
        content_items?: Array<{
          platform: string;
          content_type?: string;
          copy?: string;
          media_brief?: string;
          framework_applied?: string;
          rationale?: string;
          scheduled_date?: string;
        }>;
        ad_copies?: Array<{
          platform: string;
          variant_label?: string;
          headline?: string;
          body?: string;
          cta?: string;
          framework_applied?: string;
          rationale?: string;
        }>;
      };

      const rawContentItems = Array.isArray(aiResult.content_items) ? aiResult.content_items : [];
      const rawAdCopies = Array.isArray(aiResult.ad_copies) ? aiResult.ad_copies : [];

      if (rawContentItems.length === 0 || rawAdCopies.length === 0) {
        throw new Error("الـ AI رجع نتيجة فاضية. حاول تاني.");
      }

      type NormalizedContent = {
        platform: GenerationChannel;
        content_type?: string;
        copy?: string;
        media_brief?: string;
        framework_applied?: string;
        rationale?: string;
        scheduled_date?: string;
      };

      const contentItems: NormalizedContent[] = [];
      for (const ci of rawContentItems) {
        const platform = normalizePlatform(ci.platform ?? "");
        if (!platform || !channels.includes(platform)) continue;
        contentItems.push({ ...ci, platform });
      }

      const adCopies: Array<{
        platform: GenerationChannel;
        variant_label?: string;
        headline?: string;
        body?: string;
        cta?: string;
        framework_applied?: string;
        rationale?: string;
      }> = [];
      for (const ad of rawAdCopies) {
        const platform = normalizePlatform(ad.platform ?? "");
        if (!platform || !channels.includes(platform)) continue;
        adCopies.push({ ...ad, platform });
      }

      // Per-channel content counts.
      const contentByChannel: Record<string, NormalizedContent[]> = {};
      for (const c of channels) contentByChannel[c] = [];
      for (const ci of contentItems) {
        contentByChannel[ci.platform].push(ci);
      }

      for (const c of channels) {
        const expected = plan.posts_per_channel[c] ?? 1;
        const got = contentByChannel[c]?.length ?? 0;
        if (got !== expected) {
          throw new Error(
            `عدد بوستات ${CHANNEL_LABEL_AR[c]} (${got}) مش مطابق للخطة (${expected}).`,
          );
        }
      }

      if (contentItems.length !== expectedContentTotal) {
        throw new Error(
          `عدد البوستات الإجمالي (${contentItems.length}) مش مطابق للخطة (${expectedContentTotal}).`,
        );
      }

      const adsByChannel: Record<string, typeof adCopies> = {};
      for (const c of channels) adsByChannel[c] = [];
      for (const ad of adCopies) {
        adsByChannel[ad.platform].push(ad);
      }
      for (const c of channels) {
        const got = adsByChannel[c]?.length ?? 0;
        if (got !== expectedAdsPerChannel) {
          throw new Error(
            `عدد إعلانات ${CHANNEL_LABEL_AR[c]} (${got}) لازم يكون ${expectedAdsPerChannel}.`,
          );
        }
      }

      // Marketing-science guard + scheduled dates.
      const allScheduled = spreadScheduledDates(contentItems.length, data.startDate, data.endDate);
      let scheduleIdx = 0;
      for (const c of channels) {
        for (const ci of contentByChannel[c]) {
          if (!ci.framework_applied?.trim() || !ci.rationale?.trim()) {
            throw new Error("عنصر محتوى من غير framework أو rationale — رفض.");
          }
          if (ci.rationale.trim().length < 25) {
            throw new Error("rationale قصير جداً — لازم يشرح إزاي الإطار اتطبّق في النص ده.");
          }
          const aiDate = ci.scheduled_date?.trim();
          ci.scheduled_date =
            aiDate && isDateInRange(aiDate, data.startDate, data.endDate)
              ? aiDate
              : allScheduled[scheduleIdx];
          scheduleIdx += 1;
        }
      }

      for (const ad of adCopies) {
        if (!ad.framework_applied?.trim() || !ad.rationale?.trim()) {
          throw new Error("إعلان من غير framework أو rationale — رفض.");
        }
        if (ad.rationale.trim().length < 25) {
          throw new Error("rationale قصير جداً — لازم يشرح إزاي الإطار اتطبّق في الإعلان ده.");
        }
      }

      const ciRows = contentItems.map((ci) => ({
        campaign_id: data.campaignId,
        platform: ci.platform,
        content_type: ci.content_type ?? null,
        copy: ci.copy ?? null,
        media_brief: ci.media_brief ?? null,
        framework_applied: ci.framework_applied ?? null,
        rationale: ci.rationale ?? null,
        locale: "ar",
        scheduled_date: ci.scheduled_date ?? null,
        status: "draft",
      }));
      const { error: ciErr } = await supabase.from("content_items").insert(ciRows);
      if (ciErr) throw new Error(`content_items insert: ${ciErr.message}`);

      const adRows = adCopies.map((ad) => ({
        campaign_id: data.campaignId,
        platform: ad.platform,
        variant_label: ad.variant_label ?? null,
        headline: ad.headline ?? null,
        body: ad.body ?? null,
        cta: ad.cta ?? null,
        framework_applied: ad.framework_applied ?? null,
        rationale: ad.rationale ?? null,
        locale: "ar",
        status: "draft",
      }));
      const { error: adErr } = await supabase.from("ad_copies").insert(adRows);
      if (adErr) throw new Error(`ad_copies insert: ${adErr.message}`);

      const { error: readyErr } = await supabase
        .from("campaigns")
        .update({
          status: "ready",
          objective: plan.objective,
          channels,
          start_date: data.startDate,
          end_date: data.endDate,
        })
        .eq("id", data.campaignId);
      if (readyErr) throw new Error(`campaigns finalize: ${readyErr.message}`);

      return {
        campaign_id: data.campaignId,
        content_items_count: ciRows.length,
        ad_copies_count: adRows.length,
      };
    } catch (err) {
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", data.campaignId);
      throw err;
    }
  });

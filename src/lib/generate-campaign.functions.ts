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
import type { ContentLanguage, ImageTextLanguage } from "@/lib/campaign-generation.types";
import {
  expectedContentItemTotal,
  languageCount,
  postSlotCountFromPlan,
} from "@/lib/campaign-generation.types";
import {
  getFrameworkAppliedLabel,
  getFrameworkVocabularyForPrompt,
  renderFrameworkKnowledgeForPrompt,
  resolveFrameworkIds,
} from "@/lib/marketing-frameworks";
import {
  autoGenerateImagesForContentItems,
  type ContentItemForAutoImage,
} from "@/lib/post-image.server";

const GENERATION_CHANNELS = ["instagram", "facebook", "tiktok", "linkedin", "x"] as const;
type GenerationChannel = (typeof GENERATION_CHANNELS)[number];

const InputSchema = z.object({
  campaignId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contentLanguage: z.enum(["ar", "en", "both"]).default("ar"),
  imageTextLanguage: z.enum(["none", "ar", "en"]).default("none"),
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
  content_language: z.enum(["ar", "en", "both"]).optional(),
  image_text_language: z.enum(["none", "ar", "en"]).optional(),
});

type RawContentItem = {
  platform: string;
  content_type?: string;
  copy?: string;
  media_brief?: string;
  image_text?: string;
  framework_applied?: string;
  rationale?: string;
  scheduled_date?: string;
};

type RawAdCopy = {
  platform: string;
  variant_label?: string;
  headline?: string;
  body?: string;
  cta?: string;
  framework_applied?: string;
  rationale?: string;
};

type NormalizedContent = {
  platform: GenerationChannel;
  content_type?: string;
  copy?: string;
  media_brief?: string;
  image_text?: string;
  framework_applied?: string;
  rationale?: string;
  scheduled_date?: string;
};

type NormalizedAd = {
  platform: GenerationChannel;
  variant_label?: string;
  headline?: string;
  body?: string;
  cta?: string;
  framework_applied?: string;
  rationale?: string;
};

type AiBatch = {
  content_items?: RawContentItem[];
  ad_copies?: RawAdCopy[];
};

const JSON_OUTPUT_SHAPE = `{
  "content_items": Array<{
    "platform": "instagram" | "facebook" | "linkedin" | "tiktok" | "x",
    "content_type": string,
    "copy": string,
    "media_brief": string,
    "image_text": string,
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

const SYSTEM_PROMPT_AR = `أنت استراتيجي تسويق سينيور بتشتغل لعلامة تجارية في السوق العربي. مهمتك تبني خطة محتوى وإعلانات لحملة واحدة، مبنية على بيانات البراند المعطاية، مش كلام عام.

التزم بالقواعد دي:
1) كل النصوص باللهجة المصرية الدارجة (عامية مصرية)، طبيعية ومش حرفية. ممنوع الفصحى وممنوع ترجمة من الإنجليزي.
2) كل عنصر محتوى أو إعلان لازم يحتوي على:
   - framework_applied: اسم الإطار بالظبط من القاموس المعتمد (مثلاً: "Cialdini — Scarcity"، "Eugene Schwartz — Problem Aware"، "StoryBrand"، "AIDA"، "PAS"، "Byron Sharp — Mental Availability")
   - rationale: جملة أو اتنين بالعربي توضّح إزاي طبّقت المبدأ في النص ده تحديداً — مش جملة عامة. لازم تذكر الحركة اللي عملتها.
   أي عنصر من غير framework_applied + rationale تطبيقي يعتبر فشل.
3) المحتوى لازم يستخدم tone_of_voice و usps و personas و content_pillars من بيانات البراند.
4) لكل قناة: استخدم الشكل المناسب — Facebook (post اجتماعي)، Instagram (caption أو reel script)، LinkedIn (post طويل احترافي)، TikTok (script قصير hook-driven)، X (post قصير tweet-style).
5) scheduled_date للـ content_items لازم تبقى بين start_date و end_date موزّعة على المدة.
6) ad_copies: 2 variants لكل قناة (variant_label: "A" و "B") — headline + body + cta.
7) لكل قناة: ولّد بالظبط عدد البوستات المحدد ليها — كل بوست متكيّف على شكل القناة (مش نسخة واحدة لكل القنوات).
8) المجموع = (عدد البوستات لكل قناة) × (عدد القنوات). كل تركيبة قناة × بوست = content_item منفصل.
9) image_text لكل content_item: هوك قصير وقوي (٣–٦ كلمات كحد أقصى) مخصّص يتكتب على صورة البوست — مش نسخة من الـ copy الكامل. اكتبه بالعامية المصرية ويتطابق مع لغة البوست.

قاموس الأطر المعتمد (استخدم applied_label في framework_applied):
${getFrameworkVocabularyForPrompt()}

ارجع JSON صالح فقط، من غير prose ومن غير markdown fences، بالشكل ده بالظبط:
${JSON_OUTPUT_SHAPE}`;

const SYSTEM_PROMPT_EN = `You are a senior marketing strategist writing for an English-speaking audience. Build one campaign's content and ads grounded in the brand data provided — no generic filler.

Rules:
1) All copy in natural, idiomatic English marketing language (US/international neutral). Not a translation — write natively for English readers while honoring the brand's positioning.
2) Every content item and ad MUST include:
   - framework_applied: exact label from the approved vocabulary (e.g. "Cialdini — Scarcity", "Eugene Schwartz — Problem Aware", "StoryBrand", "AIDA", "PAS", "Byron Sharp — Mental Availability")
   - rationale: one or two sentences in English explaining how you applied the framework in THIS specific copy — not generic. Name the concrete move you made.
   Any item missing framework_applied + specific rationale is a failure.
3) Use tone_of_voice, usps, personas, and content_pillars from the brand data.
4) Per platform: Facebook (social post), Instagram (caption or reel script), LinkedIn (professional long-form), TikTok (short hook-driven script), X (concise tweet-style).
5) scheduled_date for content_items must fall between start_date and end_date, spread across the period.
6) ad_copies: 2 variants per channel (variant_label: "A" and "B") — headline + body + cta.
7) Per channel: generate exactly the post count specified — each post adapted to that channel's format (not one generic post copied everywhere).
8) Total items = (posts per channel) × (number of channels). Each channel × post slot = a separate content_item.
9) image_text per content_item: a very short punchy hook (3–6 words max) meant to be overlaid on the post image — NOT the full copy. Write it in English and match the post's language.

Approved framework vocabulary (use applied_label in framework_applied):
${getFrameworkVocabularyForPrompt()}

Return valid JSON only, no prose, no markdown fences, exactly this shape:
${JSON_OUTPUT_SHAPE}`;

function buildAdaptationSystemPromptEn(frameworkIds: string[]): string {
  const knowledge = renderFrameworkKnowledgeForPrompt(frameworkIds);
  const base = `You are a senior marketing strategist. You will receive Arabic campaign content written for an Egyptian Arabic-speaking audience. Produce culturally ADAPTED English versions for an English-speaking audience.

CRITICAL: This is NOT literal translation. Same offer, intent, framework, and scheduled dates — but native English phrasing and cultural framing that resonates with English readers.

Rules:
1) Keep the same framework_applied label on each paired item (from the vocabulary).
2) Write rationale in English explaining how the framework shows up in the English copy specifically.
3) Match platform, scheduled_date, and variant_label exactly to the Arabic source item you are adapting.
4) Return the same number of content_items and ad_copies as the Arabic source.
5) media_brief: adapt the visual direction for an English context; keep image-text language instructions if present.
6) image_text: adapt to a short English hook (3–6 words) for each paired item — not a literal translation of the Arabic hook.

Approved framework vocabulary:
${getFrameworkVocabularyForPrompt()}

Return valid JSON only, no markdown fences, exactly this shape:
${JSON_OUTPUT_SHAPE}`;
  return knowledge ? `${base}\n\n${knowledge}` : base;
}

function buildSystemPrompt(locale: "ar" | "en", frameworkIds: string[]): string {
  const base = locale === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;
  const knowledge = renderFrameworkKnowledgeForPrompt(frameworkIds);
  return knowledge ? `${base}\n\n${knowledge}` : base;
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

function enrichMediaBrief(brief: string | undefined | null, imageText: ImageTextLanguage): string {
  const base = (brief ?? "").trim();
  const suffix =
    imageText === "none"
      ? "[Image: no text, words, or typography on the image.]"
      : imageText === "ar"
        ? "[Image: if any text appears on the image, it must be in Arabic.]"
        : "[Image: if any text appears on the image, it must be in English.]";
  return base ? `${base} ${suffix}` : suffix;
}

function buildUserContent(args: {
  brandContext: Record<string, unknown>;
  plan: AdaptedPlan;
  startDate: string;
  endDate: string;
  channels: Channel[];
  frameworkIds: string[];
  expectedContentTotal: number;
  postSlotCount: number;
  channelCount: number;
  expectedAdsPerChannel: number;
  locale: "ar" | "en";
}): string {
  const {
    brandContext,
    plan,
    startDate,
    endDate,
    channels,
    frameworkIds,
    expectedContentTotal,
    postSlotCount,
    channelCount,
    expectedAdsPerChannel,
    locale,
  } = args;

  const intro =
    locale === "ar"
      ? "بيانات البراند والتحليل (استخدمها حرفيًا، مفيش كلام عام):"
      : "Brand and analysis data (use concretely — no generic filler):";

  const briefIntro =
    locale === "ar" ? "برّيف الحملة المعتمدة:" : "Approved campaign brief:";

  const close =
    locale === "ar"
      ? `وزّع scheduled_date بشكل متفرّق بين ${startDate} و ${endDate}. ابدأ توليد JSON دلوقتي.`
      : `Spread scheduled_date across ${startDate} to ${endDate}. Generate JSON now.`;

  return `${intro}
${JSON.stringify(brandContext, null, 2)}

${briefIntro}
- campaign_type (package_id): ${plan.package_id}
- package_name_ar: ${plan.package_name_ar}
- description_ar: ${plan.description_ar}
- objective: ${plan.objective}
- funnel_focus: ${plan.funnel_focus}
- start_date: ${startDate}
- end_date: ${endDate}
- posts_per_channel (exact counts — each channel gets its own adapted posts):
${buildPostsPerChannelBrief(channels, plan.posts_per_channel)}
- post slots per channel: ${postSlotCount}
- channels: ${channelCount}
- total content_items in THIS language batch: ${expectedContentTotal} (= ${postSlotCount} × ${channelCount})
- per channel: ${expectedAdsPerChannel} ads (variants A and B)
${frameworkIds.length > 0 ? `- frameworks: ${frameworkIds.map((id) => getFrameworkAppliedLabel(id)).join(locale === "ar" ? "، " : ", ")}` : ""}
${plan.adaptation_note_ar ? `- adaptation note: ${plan.adaptation_note_ar}` : ""}

${close}`;
}

function normalizeBatch(
  aiResult: AiBatch,
  channels: Channel[],
  plan: AdaptedPlan,
  startDate: string,
  endDate: string,
  rationaleMinLen: number,
): { contentItems: NormalizedContent[]; adCopies: NormalizedAd[] } {
  const rawContentItems = Array.isArray(aiResult.content_items) ? aiResult.content_items : [];
  const rawAdCopies = Array.isArray(aiResult.ad_copies) ? aiResult.ad_copies : [];

  if (rawContentItems.length === 0 || rawAdCopies.length === 0) {
    throw new Error("الـ AI رجع نتيجة فاضية. حاول تاني.");
  }

  const contentItems: NormalizedContent[] = [];
  for (const ci of rawContentItems) {
    const platform = normalizePlatform(ci.platform ?? "");
    if (!platform || !channels.includes(platform)) continue;
    contentItems.push({ ...ci, platform });
  }

  const adCopies: NormalizedAd[] = [];
  for (const ad of rawAdCopies) {
    const platform = normalizePlatform(ad.platform ?? "");
    if (!platform || !channels.includes(platform)) continue;
    adCopies.push({ ...ad, platform });
  }

  const expectedContentTotal = plan.total_posts;
  const expectedAdsPerChannel = 2;

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

  const adsByChannel: Record<string, NormalizedAd[]> = {};
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

  const allScheduled = spreadScheduledDates(contentItems.length, startDate, endDate);
  let scheduleIdx = 0;
  for (const c of channels) {
    for (const ci of contentByChannel[c]) {
      if (!ci.framework_applied?.trim() || !ci.rationale?.trim()) {
        throw new Error("عنصر محتوى من غير framework أو rationale — رفض.");
      }
      if (ci.rationale.trim().length < rationaleMinLen) {
        throw new Error("rationale قصير جداً — لازم يشرح إزاي الإطار اتطبّق في النص ده.");
      }
      const trimmedImageText = ci.image_text?.trim();
      ci.image_text = trimmedImageText || undefined;
      const aiDate = ci.scheduled_date?.trim();
      ci.scheduled_date =
        aiDate && isDateInRange(aiDate, startDate, endDate)
          ? aiDate
          : allScheduled[scheduleIdx];
      scheduleIdx += 1;
    }
  }

  for (const ad of adCopies) {
    if (!ad.framework_applied?.trim() || !ad.rationale?.trim()) {
      throw new Error("إعلان من غير framework أو rationale — رفض.");
    }
    if (ad.rationale.trim().length < rationaleMinLen) {
      throw new Error("rationale قصير جداً — لازم يشرح إزاي الإطار اتطبّق في الإعلان ده.");
    }
  }

  return { contentItems, adCopies };
}

/** Deterministic order: channels → posts within channel. */
function orderedContentItems(
  channels: Channel[],
  contentByChannel: Record<string, NormalizedContent[]>,
): NormalizedContent[] {
  const out: NormalizedContent[] = [];
  for (const c of channels) {
    for (const ci of contentByChannel[c] ?? []) {
      out.push(ci);
    }
  }
  return out;
}

function contentByChannelFromList(
  channels: Channel[],
  items: NormalizedContent[],
): Record<string, NormalizedContent[]> {
  const map: Record<string, NormalizedContent[]> = {};
  for (const c of channels) map[c] = [];
  for (const ci of items) {
    map[ci.platform].push(ci);
  }
  return map;
}

export const generateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const contentLanguage: ContentLanguage = data.contentLanguage;
    const imageTextLanguage: ImageTextLanguage = data.imageTextLanguage;

    if (data.endDate < data.startDate) {
      throw new Error("تاريخ النهاية لازم يكون بعد تاريخ البداية.");
    }

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

    const rawPlan = AdaptedPlanSchema.parse(campaign.campaign_plan) as AdaptedPlan & {
      content_language?: ContentLanguage;
      image_text_language?: ImageTextLanguage;
    };

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
    const postSlotCount = postSlotCountFromPlan(plan);
    const expectedContentTotal = plan.total_posts;
    const expectedFinalContentTotal = expectedContentItemTotal(
      expectedContentTotal,
      contentLanguage,
    );
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

    const planWithPrefs = {
      ...plan,
      content_language: contentLanguage,
      image_text_language: imageTextLanguage,
      post_slot_count: postSlotCount,
      content_items_expected: expectedFinalContentTotal,
    };

    const { error: planPersistErr } = await supabase
      .from("campaigns")
      .update({ campaign_plan: planWithPrefs as never })
      .eq("id", data.campaignId);
    if (planPersistErr) throw new Error(`campaigns plan update: ${planPersistErr.message}`);

    const { error: genErr } = await supabase
      .from("campaigns")
      .update({ status: "generating" })
      .eq("id", data.campaignId);
    if (genErr) throw new Error(`campaigns update: ${genErr.message}`);

    try {
      const { callAI } = await import("@/lib/ai/ai.server");

      const generateLocale = contentLanguage === "en" ? "en" : "ar";
      const systemPrompt = buildSystemPrompt(generateLocale, frameworkIds);
      const userContent = buildUserContent({
        brandContext,
        plan,
        startDate: data.startDate,
        endDate: data.endDate,
        channels,
        frameworkIds,
        expectedContentTotal,
        postSlotCount,
        channelCount: channels.length,
        expectedAdsPerChannel,
        locale: generateLocale,
      });

      const primaryResult = (await callAI({
        task: "content_generation",
        systemPrompt,
        userContent,
        jsonMode: true,
        logContext: { projectId: campaign.project_id },
      })) as AiBatch;

      const { contentItems: primaryContent, adCopies: primaryAds } = normalizeBatch(
        primaryResult,
        channels,
        plan,
        data.startDate,
        data.endDate,
        25,
      );

      const primaryByChannel = contentByChannelFromList(channels, primaryContent);
      const orderedPrimary = orderedContentItems(channels, primaryByChannel);

      const applyImageBrief = (items: NormalizedContent[]) =>
        items.map((ci) => ({
          ...ci,
          media_brief: enrichMediaBrief(ci.media_brief, imageTextLanguage),
        }));

      let totalContent = 0;
      let totalAds = 0;
      const insertedForImages: ContentItemForAutoImage[] = [];

      if (contentLanguage === "both") {
        const arContent = applyImageBrief(orderedPrimary);
        const arCiRows = arContent.map((ci) => ({
          campaign_id: data.campaignId,
          platform: ci.platform,
          content_type: ci.content_type ?? null,
          copy: ci.copy ?? null,
          media_brief: ci.media_brief ?? null,
          image_text: ci.image_text?.trim() || null,
          framework_applied: ci.framework_applied ?? null,
          rationale: ci.rationale ?? null,
          locale: "ar",
          adapted_from_id: null,
          scheduled_date: ci.scheduled_date ?? null,
          status: "draft",
        }));

        const { data: insertedCi, error: ciErr } = await supabase
          .from("content_items")
          .insert(arCiRows)
          .select("id, platform, media_brief, copy");
        if (ciErr) throw new Error(`content_items insert: ${ciErr.message}`);
        if (!insertedCi || insertedCi.length !== arCiRows.length) {
          throw new Error("content_items insert: missing ids");
        }
        insertedForImages.push(...insertedCi);

        const arAdRows = primaryAds.map((ad) => ({
          campaign_id: data.campaignId,
          platform: ad.platform,
          variant_label: ad.variant_label ?? null,
          headline: ad.headline ?? null,
          body: ad.body ?? null,
          cta: ad.cta ?? null,
          framework_applied: ad.framework_applied ?? null,
          rationale: ad.rationale ?? null,
          locale: "ar",
          adapted_from_id: null,
          status: "draft",
        }));
        const { data: insertedAds, error: adErr } = await supabase
          .from("ad_copies")
          .insert(arAdRows)
          .select("id, platform, variant_label");
        if (adErr) throw new Error(`ad_copies insert: ${adErr.message}`);
        if (!insertedAds || insertedAds.length !== arAdRows.length) {
          throw new Error("ad_copies insert: missing ids");
        }

        const adaptationPrompt = buildAdaptationSystemPromptEn(frameworkIds);
        const adaptationUser = `Arabic content to adapt (keep pairing by platform, order, scheduled_date, variant_label):

content_items:
${JSON.stringify(arContent, null, 2)}

ad_copies:
${JSON.stringify(primaryAds, null, 2)}

Produce culturally adapted English versions. Same counts and structure.`;

        const enResult = (await callAI({
          task: "content_generation",
          systemPrompt: adaptationPrompt,
          userContent: adaptationUser,
          jsonMode: true,
          logContext: { projectId: campaign.project_id },
        })) as AiBatch;

        const { contentItems: enContent, adCopies: enAds } = normalizeBatch(
          enResult,
          channels,
          plan,
          data.startDate,
          data.endDate,
          20,
        );

        const enByChannel = contentByChannelFromList(channels, enContent);
        const orderedEn = orderedContentItems(channels, enByChannel);
        const enWithBrief = applyImageBrief(orderedEn);

        if (orderedEn.length !== insertedCi.length) {
          throw new Error("English adaptation count mismatch for content_items.");
        }

        const enCiRows = enWithBrief.map((ci, idx) => ({
          campaign_id: data.campaignId,
          platform: ci.platform,
          content_type: ci.content_type ?? null,
          copy: ci.copy ?? null,
          media_brief: ci.media_brief ?? null,
          image_text: ci.image_text?.trim() || null,
          framework_applied: ci.framework_applied ?? null,
          rationale: ci.rationale ?? null,
          locale: "en",
          adapted_from_id: insertedCi[idx].id,
          scheduled_date: ci.scheduled_date ?? null,
          status: "draft",
        }));
        const { data: insertedEnCi, error: enCiErr } = await supabase
          .from("content_items")
          .insert(enCiRows)
          .select("id, platform, media_brief, copy");
        if (enCiErr) throw new Error(`content_items en insert: ${enCiErr.message}`);
        if (insertedEnCi) insertedForImages.push(...insertedEnCi);

        const adKey = (platform: string, variant: string | null | undefined) =>
          `${platform}:${variant ?? ""}`;
        const arAdIdByKey = new Map(
          insertedAds.map((a) => [adKey(a.platform, a.variant_label), a.id]),
        );

        const enAdRows = enAds.map((ad) => {
          const parentId = arAdIdByKey.get(adKey(ad.platform, ad.variant_label));
          if (!parentId) {
            throw new Error(`No Arabic ad parent for ${ad.platform} ${ad.variant_label}`);
          }
          return {
            campaign_id: data.campaignId,
            platform: ad.platform,
            variant_label: ad.variant_label ?? null,
            headline: ad.headline ?? null,
            body: ad.body ?? null,
            cta: ad.cta ?? null,
            framework_applied: ad.framework_applied ?? null,
            rationale: ad.rationale ?? null,
            locale: "en",
            adapted_from_id: parentId,
            status: "draft",
          };
        });
        const { error: enAdErr } = await supabase.from("ad_copies").insert(enAdRows);
        if (enAdErr) throw new Error(`ad_copies en insert: ${enAdErr.message}`);

        totalContent = arCiRows.length + enCiRows.length;
        totalAds = arAdRows.length + enAdRows.length;
      } else {
        const locale = contentLanguage;
        const withBrief = applyImageBrief(orderedPrimary);

        const ciRows = withBrief.map((ci) => ({
          campaign_id: data.campaignId,
          platform: ci.platform,
          content_type: ci.content_type ?? null,
          copy: ci.copy ?? null,
          media_brief: ci.media_brief ?? null,
          image_text: ci.image_text?.trim() || null,
          framework_applied: ci.framework_applied ?? null,
          rationale: ci.rationale ?? null,
          locale,
          adapted_from_id: null,
          scheduled_date: ci.scheduled_date ?? null,
          status: "draft",
        }));
        const { data: insertedCi, error: ciErr } = await supabase
          .from("content_items")
          .insert(ciRows)
          .select("id, platform, media_brief, copy");
        if (ciErr) throw new Error(`content_items insert: ${ciErr.message}`);
        if (insertedCi) insertedForImages.push(...insertedCi);

        const adRows = primaryAds.map((ad) => ({
          campaign_id: data.campaignId,
          platform: ad.platform,
          variant_label: ad.variant_label ?? null,
          headline: ad.headline ?? null,
          body: ad.body ?? null,
          cta: ad.cta ?? null,
          framework_applied: ad.framework_applied ?? null,
          rationale: ad.rationale ?? null,
          locale,
          adapted_from_id: null,
          status: "draft",
        }));
        const { error: adErr } = await supabase.from("ad_copies").insert(adRows);
        if (adErr) throw new Error(`ad_copies insert: ${adErr.message}`);

        totalContent = ciRows.length;
        totalAds = adRows.length;
      }

      if (totalContent !== expectedFinalContentTotal) {
        throw new Error(
          `عدد البوستات (${totalContent}) مش مطابق للمتوقع (${expectedFinalContentTotal} = ${postSlotCount} × ${channels.length} × ${languageCount(contentLanguage)}).`,
        );
      }

      const imageStats = await autoGenerateImagesForContentItems({
        supabase,
        projectId: campaign.project_id,
        projectName: project.name,
        ownerId: userId,
        imageTextLanguage,
        brand: brand
          ? { tone_of_voice: brand.tone_of_voice, brand_colors: brand.brand_colors }
          : null,
        items: insertedForImages,
      });
      console.log("[campaign-gen] auto images:", imageStats);

      const { error: readyErr } = await supabase
        .from("campaigns")
        .update({
          status: "ready",
          objective: plan.objective,
          channels,
          start_date: data.startDate,
          end_date: data.endDate,
          campaign_plan: planWithPrefs as never,
        })
        .eq("id", data.campaignId);
      if (readyErr) throw new Error(`campaigns finalize: ${readyErr.message}`);

      return {
        campaign_id: data.campaignId,
        content_items_count: totalContent,
        ad_copies_count: totalAds,
        content_language: contentLanguage,
        image_text_language: imageTextLanguage,
        images_generated: imageStats.generated,
        images_failed: imageStats.failed,
        images_skipped_quota: imageStats.skippedQuota,
      };
    } catch (err) {
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", data.campaignId);
      throw err;
    }
  });

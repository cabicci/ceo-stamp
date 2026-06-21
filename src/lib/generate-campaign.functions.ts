import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ChannelEnum = z.enum(["instagram", "linkedin", "tiktok", "x"]);

const InputSchema = z.object({
  projectId: z.string().uuid(),
  objective: z.enum(["awareness", "leads", "sales"]),
  channels: z.array(ChannelEnum).min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const SYSTEM_PROMPT = `أنت استراتيجي تسويق سينيور بتشتغل لعلامة تجارية في السوق العربي. مهمتك تبني خطة محتوى وإعلانات لحملة واحدة، مبنية على بيانات البراند المعطاية، مش كلام عام.

التزم بالقواعد دي:
1) كل النصوص باللهجة المصرية الدارجة (عامية مصرية)، طبيعية ومش حرفية. ممنوع الفصحى وممنوع ترجمة من الإنجليزي.
2) كل عنصر محتوى أو إعلان لازم يحتوي على framework_applied (إطار تسويقي مسمى بدقة، مثلاً: "Cialdini - Social Proof"، "Eugene Schwartz - Awareness Stage 3"، "StoryBrand"، "AIDA"، "PAS"، "Byron Sharp - Mental Availability") + rationale بالعربي يشرح ليه الزاوية دي مناسبة للجمهور والهدف ده تحديدًا. أي عنصر من غير framework + rationale يعتبر فشل.
3) المحتوى لازم يستخدم tone_of_voice و usps و personas و content_pillars من بيانات البراند.
4) لكل قناة: استخدم الشكل المناسب — Instagram (caption أو reel script)، LinkedIn (post طويل احترافي)، TikTok (script قصير hook-driven)، X (post قصير tweet-style).
5) scheduled_date للـ content_items لازم تبقى بين start_date و end_date موزّعة على المدة.
6) ad_copies: 2 variants لكل قناة مختارة (headline + body + cta).

ارجع JSON صالح فقط، من غير prose ومن غير markdown fences، بالشكل ده بالظبط:
{
  "content_items": Array<{
    "platform": "instagram" | "linkedin" | "tiktok" | "x",
    "content_type": string,
    "copy": string,
    "media_brief": string,
    "framework_applied": string,
    "rationale": string,
    "scheduled_date": "YYYY-MM-DD"
  }>,
  "ad_copies": Array<{
    "platform": "instagram" | "linkedin" | "tiktok" | "x",
    "variant_label": string,
    "headline": string,
    "body": string,
    "cta": string,
    "framework_applied": string,
    "rationale": string
  }>
}`;

type Channel = z.infer<typeof ChannelEnum>;

function postsPerChannelByObjective(objective: string): number {
  if (objective === "sales") return 4;
  if (objective === "leads") return 5;
  return 6; // awareness
}

export const generateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1) Load project + brand_profile + latest website_analysis. RLS guarantees ownership.
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, website_url, owner_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw new Error(`projects: ${projErr.message}`);
    if (!project) throw new Error("Project not found or access denied");

    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("tone_of_voice, usps, personas, content_pillars, brand_colors")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const { data: analysisRow } = await supabase
      .from("website_analysis")
      .select("ai_analysis, status, analyzed_at")
      .eq("project_id", data.projectId)
      .eq("status", "done")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!brand && !analysisRow) {
      throw new Error(
        "لازم تعمل تحليل للموقع الأول علشان نقدر نولّد حملة مبنية على البراند.",
      );
    }

    const channels: Channel[] = data.channels;
    const itemsPerChannel = postsPerChannelByObjective(data.objective);

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

    const userContent = `بيانات البراند والتحليل (استخدمها حرفيًا، مفيش كلام عام):
${JSON.stringify(brandContext, null, 2)}

برّيف الحملة:
- objective: ${data.objective}
- channels: ${channels.join(", ")}
- start_date: ${data.startDate}
- end_date: ${data.endDate}
- عدد البوستات لكل قناة (تقريبًا): ${itemsPerChannel}
- لكل قناة: 2 إعلانين (variants A و B).

وزّع scheduled_date بشكل متفرّق بين ${data.startDate} و ${data.endDate}. ابدأ توليد JSON دلوقتي.`;

    // 2) Generate via shared AI layer (server-only, secrets never reach client).
    const { callAI } = await import("@/lib/ai/ai.server");
    const aiResult = (await callAI({
      task: "content_generation",
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      jsonMode: true,
    })) as {
      content_items?: Array<{
        platform: Channel;
        content_type?: string;
        copy?: string;
        media_brief?: string;
        framework_applied?: string;
        rationale?: string;
        scheduled_date?: string;
      }>;
      ad_copies?: Array<{
        platform: Channel;
        variant_label?: string;
        headline?: string;
        body?: string;
        cta?: string;
        framework_applied?: string;
        rationale?: string;
      }>;
    };

    const contentItems = Array.isArray(aiResult.content_items) ? aiResult.content_items : [];
    const adCopies = Array.isArray(aiResult.ad_copies) ? aiResult.ad_copies : [];

    if (contentItems.length === 0 || adCopies.length === 0) {
      throw new Error("الـ AI رجع نتيجة فاضية. حاول تاني.");
    }
    // Marketing-science guard: every item must carry framework + rationale.
    for (const ci of contentItems) {
      if (!ci.framework_applied?.trim() || !ci.rationale?.trim()) {
        throw new Error("عنصر محتوى من غير framework أو rationale — رفض.");
      }
    }
    for (const ad of adCopies) {
      if (!ad.framework_applied?.trim() || !ad.rationale?.trim()) {
        throw new Error("إعلان من غير framework أو rationale — رفض.");
      }
    }

    // 3) Persist (RLS scopes to owner).
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .insert({
        project_id: data.projectId,
        objective: data.objective,
        channels: channels,
        start_date: data.startDate,
        end_date: data.endDate,
        status: "draft",
      })
      .select("id")
      .single();
    if (cErr || !campaign) throw new Error(`campaigns insert: ${cErr?.message}`);

    const ciRows = contentItems.map((ci) => ({
      campaign_id: campaign.id,
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
      campaign_id: campaign.id,
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

    return {
      campaign_id: campaign.id,
      content_items_count: ciRows.length,
      ad_copies_count: adRows.length,
    };
  });

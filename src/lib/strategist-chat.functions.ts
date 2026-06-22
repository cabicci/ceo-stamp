import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_CHANNELS,
  CAMPAIGN_PACKAGES,
  CHANNEL_LABEL_AR,
  adaptPackageToAvailable,
  type Channel,
  type AdaptedPlan,
} from "@/lib/campaign-packages";
import {
  getFrameworkVocabularyForPrompt,
  MARKETING_FRAMEWORKS,
  renderFrameworkKnowledgeForPrompt,
  resolveFrameworkIds,
} from "@/lib/marketing-frameworks";

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const InputSchema = z.object({
  projectId: z.string().uuid(),
  messages: z.array(TurnSchema).min(1).max(20),
});

const SYSTEM_PROMPT = `أنت استراتيجي تسويق سينيور بتشتغل للسوق العربي (لهجة مصرية دارجة). مهمتك: تساعد العميل يبني خطة حملة واحدة مبنية على بيانات برانده.

قواعد ملزمة:
1) كل ردودك بالعامية المصرية، قصيرة ومباشرة. مفيش فصحى، مفيش كلام عام.
2) تتكلم كاستراتيجي سينيور: بتشرح "ليه" الزاوية دي مناسبة في جملة أو اتنين، وبتختار أطر تطبّقها فعلاً مش بس تسمّيها.
3) استخدم فقط framework ids من القاموس المعتمد (في حقل frameworks في الخطة). ممنوع أسماء حرة أو نصوص عربية في frameworks.
4) تقترح فقط القنوات اللي العميل فعلاً عنده (available_channels). أي قناة تانية ممنوع تقترحها.
5) لو وصف العميل قريب من باكدچ من الباكدچات الجاهزة (limited_offer, product_launch, brand_awareness, lead_gen, value_authority, quick_post)، اقترحها بالاسم العربي كنقطة بداية موصى بيها، بس سيب له حرية يطلب خطة مخصصة.
6) أسئلة التوضيح: لو في معلومة أساسية ناقصة (الهدف، فترة الحملة، نوع العرض، الخ)، اسأل سؤال واحد قصير لكل رد، بحد أقصى 3 أسئلة كلها. لو المعلومات كافية، اقفز للخطة النهائية.

قاموس الأطر (frameworks في الخطة = ids بالظبط):
${getFrameworkVocabularyForPrompt()}

طريقة الرد:
- لو لسه بتجمع معلومات: ابعت JSON بالشكل ده:
{"phase":"clarify","message":"<سؤالك بالعربي>"}
- لو في رأيك معلومات كافية أو العميل طلب الخطة النهائية: ابعت JSON بالشكل ده:
{"phase":"plan","message":"<شرح قصير بالعربي ليه الخطة دي مناسبة، 2-4 جمل>","plan":{
  "package_id":"custom" أو id باكدچ موصى بيه،
  "package_name_ar":"<اسم الحملة بالعربي>",
  "description_ar":"<وصف قصير>",
  "objective":"awareness" | "leads" | "sales",
  "frameworks":["<framework id من القاموس، مثلاً cialdini_scarcity>"],
  "funnel_focus":"<TOFU / MOFU / BOFU / Full Funnel / Most Aware ... بالإنجليزي>",
  "channels":["instagram"|"facebook"|"tiktok"|"linkedin"|"x", ...],
  "posts_per_channel":{"instagram":N,...},
  "total_posts":N,
  "adaptation_note_ar": "<ملاحظة بالعربي لو حصل تكييف، أو null>"
}}

قواعد الخطة:
- channels لازم تكون subset من available_channels.
- لو بتنصح بباكدچ، خلي package_id يساوي id الباكدچ، واتبع نفس framework ids بتاعته كأساس.
- مجموع posts_per_channel = total_posts.
- مفيش markdown، مفيش prose خارج JSON. JSON صالح بس.`;

export const strategistChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1) Load brand + analysis + available_channels (RLS scopes by owner).
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, website_url")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw new Error(`projects: ${projErr.message}`);
    if (!project) throw new Error("Project not found or access denied");

    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("tone_of_voice, usps, personas, content_pillars, available_channels")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const { data: analysisRow } = await supabase
      .from("website_analysis")
      .select("ai_analysis")
      .eq("project_id", data.projectId)
      .eq("status", "done")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rawChannels = (brand?.available_channels ?? []) as unknown;
    const available: Channel[] = Array.isArray(rawChannels)
      ? (rawChannels.filter((c) => ALL_CHANNELS.includes(c as Channel)) as Channel[])
      : [];

    if (available.length === 0) {
      throw new Error(
        "لازم تحدد القنوات المتاحة من إعدادات الحملة قبل ما تكلم الاستراتيجي.",
      );
    }

    const brandContext = {
      project_name: project.name,
      website_url: project.website_url,
      available_channels: available.map((c) => ({ id: c, label_ar: CHANNEL_LABEL_AR[c] })),
      brand_profile: brand
        ? {
            tone_of_voice: brand.tone_of_voice,
            usps: brand.usps,
            personas: brand.personas,
            content_pillars: brand.content_pillars,
          }
        : null,
      website_analysis: analysisRow?.ai_analysis ?? null,
      available_packages: CAMPAIGN_PACKAGES.map((p) => ({
        id: p.id,
        name_ar: p.name_ar,
        description_ar: p.description_ar,
        frameworks: p.frameworks,
        funnel_focus: p.funnel_focus,
        objective: p.objective,
        default_post_count: p.default_post_count,
      })),
    };

    // Union of framework ids across packages — inject knowledge for strategist planning.
    const packageFrameworkIds = [
      ...new Set(CAMPAIGN_PACKAGES.flatMap((p) => p.frameworks)),
    ].filter((id) => id in MARKETING_FRAMEWORKS);

    const frameworkKnowledge = renderFrameworkKnowledgeForPrompt(packageFrameworkIds);

    // 2) Inject brand context as the first user turn (or merge with system).
    // We append it to the system prompt so it stays out of the chat transcript.
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${frameworkKnowledge}\n\nبيانات البراند والقنوات المتاحة (استخدمها حرفيًا):\n${JSON.stringify(brandContext, null, 2)}`;

    const { callAIChat } = await import("@/lib/ai/ai.server");
    const aiResult = (await callAIChat({
      task: "campaign_strategy",
      systemPrompt,
      messages: data.messages,
      jsonMode: true,
    })) as {
      phase?: "clarify" | "plan";
      message?: string;
      plan?: {
        package_id?: string;
        package_name_ar?: string;
        description_ar?: string;
        objective?: "awareness" | "leads" | "sales";
        frameworks?: string[];
        funnel_focus?: string;
        channels?: Channel[];
        posts_per_channel?: Record<string, number>;
        total_posts?: number;
        adaptation_note_ar?: string | null;
      };
    };

    if (aiResult.phase === "clarify") {
      return {
        phase: "clarify" as const,
        message: aiResult.message ?? "",
      };
    }

    if (aiResult.phase !== "plan" || !aiResult.plan) {
      throw new Error("الاستراتيجي رجع رد غير متوقع. حاول تاني.");
    }

    // 3) Guard: enforce available_channels and re-adapt if needed.
    const proposed = (aiResult.plan.channels ?? []).filter((c) =>
      available.includes(c),
    );

    let finalPlan: AdaptedPlan;

    if (proposed.length === 0) {
      // Fallback: if AI suggested a package id we know, re-adapt from config.
      const pkg = CAMPAIGN_PACKAGES.find((p) => p.id === aiResult.plan!.package_id);
      if (pkg) {
        const r = adaptPackageToAvailable(pkg, available);
        if (!r.ok) throw new Error(r.reason_ar);
        finalPlan = r.plan;
      } else {
        throw new Error("الخطة المقترحة مفيهاش قنوات متاحة عند العميل.");
      }
    } else {
      // Use AI's custom split, but cap per channel using the same logic.
      const cap = Math.max(
        1,
        Math.ceil((aiResult.plan.total_posts ?? proposed.length) / proposed.length) + 2,
      );
      const split: Record<string, number> = {};
      let total = 0;
      for (const c of proposed) {
        const n = Math.max(1, Math.min(cap, Number(aiResult.plan.posts_per_channel?.[c] ?? 1)));
        split[c] = n;
        total += n;
      }
      const droppedNote =
        proposed.length < (aiResult.plan.channels?.length ?? 0)
          ? "اتشال قنوات مش متاحة عند العميل من الخطة."
          : null;
      const note = [aiResult.plan.adaptation_note_ar ?? null, droppedNote]
        .filter(Boolean)
        .join(" ");

      finalPlan = {
        package_id: aiResult.plan.package_id ?? "custom",
        package_name_ar: aiResult.plan.package_name_ar ?? "حملة مخصصة",
        description_ar: aiResult.plan.description_ar ?? "",
        objective: aiResult.plan.objective ?? "awareness",
        frameworks: resolveFrameworkIds(
          Array.isArray(aiResult.plan.frameworks) ? aiResult.plan.frameworks : [],
        ),
        funnel_focus: aiResult.plan.funnel_focus ?? "Full Funnel",
        channels: proposed,
        posts_per_channel: split,
        total_posts: total,
        adaptation_note_ar: note.length > 0 ? note : null,
      };
    }

    return {
      phase: "plan" as const,
      message: aiResult.message ?? "",
      plan: finalPlan,
    };
  });

// ---------------------------------------------------------------------------
// Approve plan — writes campaigns.campaign_plan. Same column for both entry
// points (packages gallery and strategist chat).
// ---------------------------------------------------------------------------

const ApproveSchema = z.object({
  projectId: z.string().uuid(),
  plan: z.object({
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
  }),
});

export const approveCampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ApproveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("campaigns")
      .insert({
        project_id: data.projectId,
        objective: data.plan.objective,
        channels: data.plan.channels,
        status: "draft",
        campaign_plan: data.plan,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(`campaigns insert: ${error?.message}`);
    return { campaign_id: row.id };
  });

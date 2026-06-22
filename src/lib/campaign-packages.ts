// Shared config — safe to import from both client and server.
// The 5 supported social channels across the app.
export type Channel = "instagram" | "facebook" | "tiktok" | "linkedin" | "x";

export const ALL_CHANNELS: Channel[] = ["instagram", "facebook", "tiktok", "linkedin", "x"];

export const CHANNEL_LABEL_AR: Record<Channel, string> = {
  instagram: "إنستجرام",
  facebook: "فيسبوك",
  tiktok: "تيك توك",
  linkedin: "لينكدإن",
  x: "إكس (تويتر)",
};

export type Objective = "awareness" | "leads" | "sales";

export type CampaignPackage = {
  id: string;
  name_ar: string;
  description_ar: string;
  default_post_count: number;
  // Channels that fit this package best. Will be intersected with the
  // project's available_channels. "client_choice" = no preference; use
  // whatever the client has.
  ideal_channels: Channel[] | "client_choice";
  frameworks: string[];
  funnel_focus: string; // Arabic, e.g. "Most Aware" / "TOFU" etc.
  objective: Objective;
  // Soft cap: don't pile too many posts on a single channel.
  max_per_channel?: number;
};

export const CAMPAIGN_PACKAGES: CampaignPackage[] = [
  {
    id: "limited_offer",
    name_ar: "عرض / خصم محدود بوقت",
    description_ar:
      "حملة ضغط شراء قصيرة. بتشتغل على العملاء اللي عارفين البراند بالفعل وقربين من القرار.",
    default_post_count: 8,
    ideal_channels: ["instagram", "facebook"],
    frameworks: ["Cialdini — Scarcity", "Cialdini — Urgency"],
    funnel_focus: "Most Aware (BOFU)",
    objective: "sales",
    max_per_channel: 6,
  },
  {
    id: "product_launch",
    name_ar: "إطلاق منتج / خدمة جديدة",
    description_ar:
      "تعريف السوق بحاجة جديدة وبناء قصة واضحة حواليها، من أول الوعي لحد القرار.",
    default_post_count: 12,
    ideal_channels: ["instagram", "facebook", "tiktok", "linkedin", "x"],
    frameworks: ["Eugene Schwartz — Awareness Stages", "StoryBrand"],
    funnel_focus: "Full Funnel",
    objective: "awareness",
    max_per_channel: 5,
  },
  {
    id: "brand_awareness",
    name_ar: "توعية بالبراند",
    description_ar:
      "بناء حضور ذهني (mental availability) وأصول مميزة يفتكرها الجمهور بسرعة.",
    default_post_count: 10,
    ideal_channels: ["instagram", "tiktok", "facebook"],
    frameworks: ["Byron Sharp — Mental Availability", "Distinctive Brand Assets"],
    funnel_focus: "TOFU",
    objective: "awareness",
    max_per_channel: 5,
  },
  {
    id: "lead_gen",
    name_ar: "جذب عملاء محتملين",
    description_ar:
      "حملة هدفها لفت الانتباه لمشكلة محددة ودفع المهتم يسيب بياناته.",
    default_post_count: 8,
    ideal_channels: ["facebook", "linkedin"],
    frameworks: ["AIDA", "PAS"],
    funnel_focus: "MOFU",
    objective: "leads",
    max_per_channel: 5,
  },
  {
    id: "value_authority",
    name_ar: "محتوى قيمة / تأسيس سلطة",
    description_ar:
      "محتوى تعليمي بيخلي البراند هو المرشد (Guide) في مجاله، وبيبني ثقة طويلة المدى.",
    default_post_count: 6,
    ideal_channels: ["linkedin", "instagram"],
    frameworks: ["StoryBrand — Brand as Guide", "Educational Content"],
    funnel_focus: "TOFU → MOFU",
    objective: "awareness",
    max_per_channel: 4,
  },
  {
    id: "quick_post",
    name_ar: "بوست واحد سريع",
    description_ar:
      "بوست مفرد بهدف محدد. الإطار التسويقي بيتحدد حسب الهدف وقت التوليد.",
    default_post_count: 1,
    ideal_channels: "client_choice",
    frameworks: ["يتحدد حسب الهدف"],
    funnel_focus: "حسب الهدف",
    objective: "awareness",
    max_per_channel: 1,
  },
];

// -----------------------------------------------------------------------------
// Plan adaptation
// -----------------------------------------------------------------------------

export type AdaptedPlan = {
  package_id: string;
  package_name_ar: string;
  description_ar: string;
  objective: Objective;
  frameworks: string[];
  funnel_focus: string;
  // Final channels actually used (subset of available_channels).
  channels: Channel[];
  // Per-channel post distribution.
  posts_per_channel: Record<string, number>;
  total_posts: number;
  // Arabic note shown to the user when adaptation changed anything.
  adaptation_note_ar: string | null;
};

export type AdaptResult =
  | { ok: true; plan: AdaptedPlan }
  | { ok: false; reason_ar: string };

/**
 * Intersect a package's ideal channels with what the client actually has,
 * then distribute the post count. If none of the ideal channels are
 * available, fall back to all available channels and surface an Arabic note.
 */
export function adaptPackageToAvailable(
  pkg: CampaignPackage,
  available: Channel[],
): AdaptResult {
  const avail = available.filter((c) => ALL_CHANNELS.includes(c));
  if (avail.length === 0) {
    return {
      ok: false,
      reason_ar:
        "لازم تحدد القنوات المتاحة عندك الأول من إعدادات المشروع قبل اختيار الباكدچ.",
    };
  }

  // 1) Decide which channels to use.
  let chosen: Channel[];
  let note: string | null = null;

  if (pkg.ideal_channels === "client_choice") {
    chosen = avail.slice();
  } else {
    const intersect = pkg.ideal_channels.filter((c) => avail.includes(c));
    if (intersect.length > 0) {
      chosen = intersect;
      const dropped = pkg.ideal_channels.filter((c) => !avail.includes(c));
      if (dropped.length > 0) {
        note = `الباكدچ ده مظبوط لـ ${pkg.ideal_channels
          .map((c) => CHANNEL_LABEL_AR[c])
          .join("، ")}. اشتغلنا على ${chosen
          .map((c) => CHANNEL_LABEL_AR[c])
          .join("، ")} لأن باقي القنوات مش متاحة عندك.`;
      }
    } else {
      chosen = avail.slice();
      note = `مفيش أي قناة من قنوات الباكدچ المثالية (${pkg.ideal_channels
        .map((c) => CHANNEL_LABEL_AR[c])
        .join("، ")}) متاحة عندك، فاشتغلنا على ${chosen
        .map((c) => CHANNEL_LABEL_AR[c])
        .join("، ")}.`;
    }
  }

  // 2) Distribute posts, respecting max_per_channel cap.
  const cap = pkg.max_per_channel ?? Math.ceil(pkg.default_post_count / 2);
  const naive = Math.max(1, Math.round(pkg.default_post_count / chosen.length));
  const perChannel = Math.min(naive, cap);
  const total = perChannel * chosen.length;

  // If we had to reduce the total because of caps, mention it.
  if (total < pkg.default_post_count && pkg.default_post_count > 1) {
    const reduceNote = `قللنا عدد البوستات الإجمالي إلى ${total} علشان نحافظ على توازن التوزيع على القنوات المتاحة (بدل ${pkg.default_post_count}).`;
    note = note ? `${note} ${reduceNote}` : reduceNote;
  }

  const posts_per_channel: Record<string, number> = {};
  for (const c of chosen) posts_per_channel[c] = perChannel;

  return {
    ok: true,
    plan: {
      package_id: pkg.id,
      package_name_ar: pkg.name_ar,
      description_ar: pkg.description_ar,
      objective: pkg.objective,
      frameworks: pkg.frameworks,
      funnel_focus: pkg.funnel_focus,
      channels: chosen,
      posts_per_channel,
      total_posts: total,
      adaptation_note_ar: note,
    },
  };
}

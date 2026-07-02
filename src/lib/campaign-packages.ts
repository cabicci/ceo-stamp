import type { Locale } from "@/i18n/I18nProvider";

export type Channel = "instagram" | "facebook" | "tiktok" | "linkedin" | "x";

export const ALL_CHANNELS: Channel[] = ["instagram", "facebook", "tiktok", "linkedin", "x"];

export const CHANNEL_LABEL_AR: Record<Channel, string> = {
  instagram: "إنستجرام",
  facebook: "فيسبوك",
  tiktok: "تيك توك",
  linkedin: "لينكدإن",
  x: "إكس (تويتر)",
};

/** Native platform names — same in AR and EN UI. */
export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
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
  /** Framework ids from marketing-frameworks.ts */
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
    frameworks: ["cialdini_scarcity", "cialdini_commitment_consistency"],
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
    frameworks: [
      "schwartz_unaware",
      "schwartz_problem_aware",
      "schwartz_solution_aware",
      "schwartz_product_aware",
      "schwartz_most_aware",
      "storybrand",
    ],
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
    frameworks: ["sharp_mental_availability", "sharp_distinctive_assets", "sharp_reach_over_persuasion"],
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
    frameworks: ["aida", "pas"],
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
    frameworks: ["storybrand", "cialdini_authority"],
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
    frameworks: [],
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
  /** Framework ids from marketing-frameworks.ts */
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

function channelListLabel(channels: Channel[], locale: Locale): string {
  const sep = locale === "en" ? ", " : "، ";
  const labels = channels.map((c) => (locale === "en" ? CHANNEL_LABEL[c] : CHANNEL_LABEL_AR[c]));
  return labels.join(sep);
}

export function localizedPackageName(
  packageId: string,
  fallbackAr: string,
  t: (key: string) => string,
): string {
  const key = `campaign.packages.${packageId}.name`;
  const translated = t(key);
  return translated !== key ? translated : fallbackAr;
}

export function localizedPackageDescription(
  packageId: string,
  fallbackAr: string,
  t: (key: string) => string,
): string {
  const key = `campaign.packages.${packageId}.description`;
  const translated = t(key);
  return translated !== key ? translated : fallbackAr;
}

/**
 * Intersect a package's ideal channels with what the client actually has,
 * then distribute the post count. If none of the ideal channels are
 * available, fall back to all available channels and surface a note.
 */
export function adaptPackageToAvailable(
  pkg: CampaignPackage,
  available: Channel[],
  locale: Locale = "ar",
): AdaptResult {
  const avail = available.filter((c) => ALL_CHANNELS.includes(c));
  if (avail.length === 0) {
    return {
      ok: false,
      reason_ar:
        locale === "en"
          ? "Set your available channels in project settings before choosing a package."
          : "لازم تحدد القنوات المتاحة عندك الأول من إعدادات المشروع قبل اختيار الباكدچ.",
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
        const ideal = channelListLabel(pkg.ideal_channels, locale);
        const picked = channelListLabel(chosen, locale);
        note =
          locale === "en"
            ? `This package is designed for ${ideal}. We adapted it to ${picked} because the other channels aren't available.`
            : `الباكدچ ده مظبوط لـ ${ideal}. اشتغلنا على ${picked} لأن باقي القنوات مش متاحة عندك.`;
      }
    } else {
      chosen = avail.slice();
      const ideal = channelListLabel(pkg.ideal_channels, locale);
      const picked = channelListLabel(chosen, locale);
      note =
        locale === "en"
          ? `None of the package's ideal channels (${ideal}) are available, so we used ${picked}.`
          : `مفيش أي قناة من قنوات الباكدچ المثالية (${ideal}) متاحة عندك، فاشتغلنا على ${picked}.`;
    }
  }

  // 2) Posts per channel = package post count (capped), then × channels for one language.
  const cap = pkg.max_per_channel ?? pkg.default_post_count;
  const perChannel = Math.min(Math.max(1, pkg.default_post_count), cap);
  const total = perChannel * chosen.length;

  if (perChannel < pkg.default_post_count) {
    const capNote =
      locale === "en"
        ? `Post count per channel was capped at ${perChannel} (package default is ${pkg.default_post_count}).`
        : `عدد البوستات لكل قناة اتقفّ عند ${perChannel} (الافتراضي في الباكدچ ${pkg.default_post_count}).`;
    note = note ? `${note} ${capNote}` : capNote;
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

/**
 * Hard ceiling: only channels in available_channels survive.
 * Recomputes posts_per_channel and total_posts for the filtered set.
 */
export function constrainPlanToAvailableChannels(
  plan: AdaptedPlan,
  available: Channel[],
): AdaptedPlan {
  const allowed = new Set(available.filter((c) => ALL_CHANNELS.includes(c)));
  const channels = plan.channels.filter((c) => allowed.has(c));
  if (channels.length === 0) {
    throw new Error("مفيش قنوات من الخطة متاحة عند المشروع.");
  }

  const posts_per_channel: Record<string, number> = {};
  let total_posts = 0;
  for (const c of channels) {
    const n = Math.max(1, Number(plan.posts_per_channel[c] ?? 1));
    posts_per_channel[c] = n;
    total_posts += n;
  }

  const dropped =
    channels.length < plan.channels.length
      ? "اتشالت قنوات مش متاحة عند المشروع من الخطة وقت التوليد."
      : null;
  const adaptation_note_ar = [plan.adaptation_note_ar, dropped].filter(Boolean).join(" ") || null;

  return {
    ...plan,
    channels,
    posts_per_channel,
    total_posts,
    adaptation_note_ar,
  };
}

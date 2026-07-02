/** Content language choice at generation time (stored on campaign_plan). */
export type ContentLanguage = "ar" | "en" | "both";

/** On-image text preference for AI-generated images (legacy; prefer image_text_enabled). */
export type ImageTextLanguage = "none" | "ar" | "en";

export const CONTENT_LANGUAGES: ContentLanguage[] = ["ar", "en", "both"];
export const IMAGE_TEXT_LANGUAGES: ImageTextLanguage[] = ["none", "ar", "en"];

/** Burn image_text hook when true; language follows each content_item.locale. */
export type ImageTextEnabled = boolean;

/** Number of locale variants produced at generation time. */
export function languageCount(contentLanguage: ContentLanguage): number {
  return contentLanguage === "both" ? 2 : 1;
}

/**
 * Total content_items after generation = post slots per channel × channels × languages.
 * `plan.total_posts` is the per-language batch size (slots × channels).
 */
export function expectedContentItemTotal(
  totalPostsPerLanguage: number,
  contentLanguage: ContentLanguage,
): number {
  return totalPostsPerLanguage * languageCount(contentLanguage);
}

/** Posts per channel from an adapted plan (uniform slot count). */
export function postSlotCountFromPlan(plan: {
  posts_per_channel: Record<string, number>;
}): number {
  const values = Object.values(plan.posts_per_channel).map((n) => Number(n));
  if (values.length === 0) return 1;
  return Math.max(1, ...values);
}


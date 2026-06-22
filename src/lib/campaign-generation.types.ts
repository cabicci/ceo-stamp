/** Content language choice at generation time (stored on campaign_plan). */
export type ContentLanguage = "ar" | "en" | "both";

/** On-image text preference for AI-generated images (stored on campaign_plan). */
export type ImageTextLanguage = "none" | "ar" | "en";

export const CONTENT_LANGUAGES: ContentLanguage[] = ["ar", "en", "both"];
export const IMAGE_TEXT_LANGUAGES: ImageTextLanguage[] = ["none", "ar", "en"];

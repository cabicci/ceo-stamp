/**
 * Shared post-image generation — SERVER ONLY.
 * Used by generate-post-image (manual) and generate-campaign (auto per post).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage, type ImageAspectRatio } from "./ai/ai.server";
import type { ImageTextLanguage } from "./campaign-generation.types";
import { get_plan_limits } from "./plan-limits";

export const POST_IMAGE_GEN_TIMEOUT_MS = 60_000;

type Platform = "facebook" | "instagram" | "tiktok" | "linkedin" | "twitter" | "x";

const PLATFORM_RATIO: Record<string, ImageAspectRatio> = {
  instagram: "1:1",
  facebook: "16:9",
  linkedin: "16:9",
  twitter: "16:9",
  x: "16:9",
  tiktok: "9:16",
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizePlatform(platform: string): Platform {
  if (platform === "x") return "twitter";
  return platform as Platform;
}

export function imageTextPromptLine(imageText: ImageTextLanguage | undefined): string {
  switch (imageText) {
    case "ar":
      return "If any text appears on the image, it must be in Arabic.";
    case "en":
      return "If any text appears on the image, it must be in English.";
    default:
      return "No embedded text, words, typography, logos, or watermarks on the image.";
  }
}

export function buildPostImagePrompt(args: {
  platform: string;
  projectName: string;
  mediaBrief: string | null;
  copy: string | null;
  toneOfVoice?: string | null;
  brandColors?: unknown;
  imageTextLanguage?: ImageTextLanguage;
  extraStyle?: string;
}): string {
  const platform = normalizePlatform(args.platform);
  const colors = asStringArray(args.brandColors).slice(0, 4);
  const brief = (args.mediaBrief || args.copy || "").toString().slice(0, 600);
  const tone = args.toneOfVoice ? `Tone: ${args.toneOfVoice}.` : "";
  const palette = colors.length ? `Brand color palette: ${colors.join(", ")}.` : "";
  const extra = args.extraStyle ? ` Additional direction: ${args.extraStyle}.` : "";
  const textRule = imageTextPromptLine(args.imageTextLanguage);

  return [
    `High-quality social media image for ${platform}.`,
    `Brand: ${args.projectName}.`,
    tone,
    palette,
    `Scene / subject: ${brief}`,
    `Style: clean, modern, photographic where appropriate, on-brand. ${textRule}`,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function aspectRatioForPlatform(platform: string): ImageAspectRatio {
  return PLATFORM_RATIO[platform] ?? PLATFORM_RATIO[normalizePlatform(platform)] ?? "1:1";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Best-effort remaining image quota for the owner this month.
 * Returns null when subscription/usage data is unavailable (no gate).
 */
export async function getRemainingImageQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  ownerId: string,
): Promise<number | null> {
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("owner_id", ownerId)
      .maybeSingle();
    const limit = get_plan_limits(sub?.plan).images_per_month;
    const periodMonth = currentPeriodMonth();
    const { data: usage } = await supabase
      .from("usage_counters")
      .select("images_generated")
      .eq("owner_id", ownerId)
      .eq("period_month", periodMonth)
      .maybeSingle();
    const used = usage?.images_generated ?? 0;
    return Math.max(0, limit - used);
  } catch {
    return null;
  }
}

async function incrementImagesGenerated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  ownerId: string,
): Promise<void> {
  const periodMonth = currentPeriodMonth();
  const { data: row } = await supabase
    .from("usage_counters")
    .select("id, images_generated")
    .eq("owner_id", ownerId)
    .eq("period_month", periodMonth)
    .maybeSingle();
  if (row?.id) {
    await supabase
      .from("usage_counters")
      .update({ images_generated: (row.images_generated ?? 0) + 1 })
      .eq("id", row.id);
  } else {
    await supabase.from("usage_counters").insert({
      owner_id: ownerId,
      period_month: periodMonth,
      images_generated: 1,
    });
  }
}

export type GeneratePostImageResult = {
  imageUrl: string;
  storagePath: string;
};

/** Generate via Imagen, upload to campaign-media, update content_items. */
export async function generateAndStorePostImage(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  contentItemId: string;
  projectId: string;
  projectName: string;
  platform: string;
  mediaBrief: string | null;
  copy: string | null;
  toneOfVoice?: string | null;
  brandColors?: unknown;
  imageTextLanguage?: ImageTextLanguage;
  extraStyle?: string;
  ownerId?: string;
}): Promise<GeneratePostImageResult> {
  const prompt = buildPostImagePrompt({
    platform: args.platform,
    projectName: args.projectName,
    mediaBrief: args.mediaBrief,
    copy: args.copy,
    toneOfVoice: args.toneOfVoice,
    brandColors: args.brandColors,
    imageTextLanguage: args.imageTextLanguage,
    extraStyle: args.extraStyle,
  });
  const aspectRatio = aspectRatioForPlatform(args.platform);

  const img = await withTimeout(
    generateImage({ prompt, aspectRatio }),
    POST_IMAGE_GEN_TIMEOUT_MS,
    "Imagen generateImage",
  );

  const ext = img.mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `${args.projectId}/ai/${crypto.randomUUID()}.${ext}`;
  const bytes = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));

  const { error: upErr } = await args.supabase.storage
    .from("campaign-media")
    .upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: img.mimeType,
    });
  if (upErr) throw new Error(`فشل رفع الصورة: ${upErr.message}`);

  const { data: signed, error: signErr } = await args.supabase.storage
    .from("campaign-media")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    throw new Error("تعذّر إنشاء رابط الصورة");
  }

  const { error: updErr } = await args.supabase
    .from("content_items")
    .update({ image_url: signed.signedUrl, image_source: "ai" })
    .eq("id", args.contentItemId);
  if (updErr) throw new Error(updErr.message);

  if (args.ownerId) {
    await incrementImagesGenerated(args.supabase, args.ownerId).catch((err) => {
      console.warn("[post-image] usage counter increment failed:", err);
    });
  }

  return { imageUrl: signed.signedUrl, storagePath: path };
}

export type ContentItemForAutoImage = {
  id: string;
  platform: string;
  media_brief: string | null;
  copy: string | null;
};

export type AutoImageGenerationStats = {
  generated: number;
  failed: number;
  skippedQuota: number;
};

/**
 * Generate AI images for all content items — resilient per-item failures.
 * Does not throw; logs failures and continues.
 */
export async function autoGenerateImagesForContentItems(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  projectId: string;
  projectName: string;
  ownerId: string;
  imageTextLanguage: ImageTextLanguage;
  brand: { tone_of_voice?: string | null; brand_colors?: unknown } | null;
  items: ContentItemForAutoImage[];
}): Promise<AutoImageGenerationStats> {
  const stats: AutoImageGenerationStats = { generated: 0, failed: 0, skippedQuota: 0 };
  if (args.items.length === 0) return stats;

  let remaining = await getRemainingImageQuota(args.supabase, args.ownerId);

  for (const item of args.items) {
    if (remaining !== null && remaining <= 0) {
      stats.skippedQuota += 1;
      console.warn(
        `[campaign-gen] image skipped (quota): content_item=${item.id} platform=${item.platform}`,
      );
      continue;
    }

    try {
      await generateAndStorePostImage({
        supabase: args.supabase,
        contentItemId: item.id,
        projectId: args.projectId,
        projectName: args.projectName,
        platform: item.platform,
        mediaBrief: item.media_brief,
        copy: item.copy,
        toneOfVoice: args.brand?.tone_of_voice,
        brandColors: args.brand?.brand_colors,
        imageTextLanguage: args.imageTextLanguage,
        ownerId: args.ownerId,
      });
      stats.generated += 1;
      if (remaining !== null) remaining -= 1;
    } catch (err) {
      stats.failed += 1;
      const detail = err instanceof Error ? err.message : String(err);
      console.error(
        `[campaign-gen] image failed: content_item=${item.id} platform=${item.platform} — ${detail.slice(0, 200)}`,
      );
      await args.supabase
        .from("content_items")
        .update({ image_url: null, image_source: null })
        .eq("id", item.id);
    }
  }

  return stats;
}

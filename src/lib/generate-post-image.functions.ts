/**
 * generate-post-image server function.
 *
 * SECURITY: GEMINI_API_KEY + Imagen calls live strictly server-side.
 * The client only receives a signed storage URL.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateImage, type ImageAspectRatio } from "./ai/ai.server";

const Input = z.object({
  contentItemId: z.string().uuid(),
  extraStyle: z.string().max(500).optional(),
});

type Platform = "facebook" | "instagram" | "tiktok" | "linkedin" | "twitter";

// Imagen supports: 1:1, 9:16, 16:9, 4:3, 3:4
// Map platform → closest supported ratio.
const PLATFORM_RATIO: Record<Platform, ImageAspectRatio> = {
  instagram: "1:1",
  facebook: "16:9",
  linkedin: "16:9",
  twitter: "16:9",
  tiktok: "9:16",
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // 1) Load the content item + parent campaign/project + brand profile.
    const { data: item, error: itemErr } = await sb
      .from("content_items")
      .select(
        "id, platform, copy, media_brief, campaigns!inner(project_id, projects!inner(id, name, owner_id))",
      )
      .eq("id", data.contentItemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("العنصر غير موجود");

    const project = item.campaigns?.projects;
    if (!project || project.owner_id !== userId) throw new Error("غير مصرح");
    const projectId: string = project.id;

    const { data: brand } = await sb
      .from("brand_profiles")
      .select("tone_of_voice, brand_colors")
      .eq("project_id", projectId)
      .maybeSingle();

    // 2) Build the image prompt.
    const platform = (item.platform as Platform) ?? "instagram";
    const aspectRatio = PLATFORM_RATIO[platform] ?? "1:1";
    const colors = asStringArray(brand?.brand_colors).slice(0, 4);
    const brief = (item.media_brief || item.copy || "").toString().slice(0, 600);
    const tone = brand?.tone_of_voice ? `Tone: ${brand.tone_of_voice}.` : "";
    const palette = colors.length ? `Brand color palette: ${colors.join(", ")}.` : "";
    const extra = data.extraStyle ? ` Additional direction: ${data.extraStyle}.` : "";

    const prompt = [
      `High-quality social media image for ${platform}.`,
      `Brand: ${project.name}.`,
      tone,
      palette,
      `Scene / subject: ${brief}`,
      `Style: clean, modern, photographic where appropriate, on-brand, no embedded text or logos, no watermarks.`,
      extra,
    ]
      .filter(Boolean)
      .join(" ");

    // 3) Generate via Imagen.
    const img = await generateImage({ prompt, aspectRatio });

    // 4) Upload to campaign-media bucket under projectId/.
    const ext = img.mimeType === "image/jpeg" ? "jpg" : "png";
    const path = `${projectId}/ai/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));

    const { error: upErr } = await sb.storage
      .from("campaign-media")
      .upload(path, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: img.mimeType,
      });
    if (upErr) throw new Error(`فشل رفع الصورة: ${upErr.message}`);

    const { data: signed, error: signErr } = await sb.storage
      .from("campaign-media")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) {
      throw new Error("تعذّر إنشاء رابط الصورة");
    }

    // 5) Persist on the content item.
    const { error: updErr } = await sb
      .from("content_items")
      .update({ image_url: signed.signedUrl, image_source: "ai" })
      .eq("id", item.id);
    if (updErr) throw new Error(updErr.message);

    return { imageUrl: signed.signedUrl as string };
  });

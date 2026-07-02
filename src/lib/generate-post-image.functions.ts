/**
 * generate-post-image server function.
 *
 * SECURITY: GEMINI_API_KEY + Imagen calls live strictly server-side.
 * The client only receives a signed storage URL.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImageTextLanguage } from "./campaign-generation.types";
import { generateAndStorePostImage } from "./post-image.server";

const Input = z.object({
  contentItemId: z.string().uuid(),
  extraStyle: z.string().max(500).optional(),
});

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: item, error: itemErr } = await sb
      .from("content_items")
      .select(
        "id, platform, copy, media_brief, image_text, locale, campaigns!inner(project_id, campaign_plan, projects!inner(id, name, owner_id))",
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

    const campaignPlan = item.campaigns?.campaign_plan as
      | { image_text_enabled?: boolean; image_text_language?: ImageTextLanguage }
      | null
      | undefined;
    const imageTextEnabled =
      campaignPlan?.image_text_enabled ??
      (campaignPlan?.image_text_language !== undefined &&
        campaignPlan.image_text_language !== "none");
    const burnLocale = item.locale === "en" ? "en" : "ar";

    const { imageUrl } = await generateAndStorePostImage({
      supabase: sb,
      contentItemId: item.id,
      projectId,
      projectName: project.name,
      platform: item.platform,
      mediaBrief: item.media_brief,
      copy: item.copy,
      imageText: item.image_text,
      toneOfVoice: brand?.tone_of_voice,
      brandColors: brand?.brand_colors,
      imageTextEnabled,
      burnLocale,
      extraStyle: data.extraStyle,
      ownerId: userId,
    });

    return { imageUrl };
  });

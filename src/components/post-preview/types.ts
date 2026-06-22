export type Platform = "facebook" | "instagram" | "tiktok" | "linkedin" | "twitter";

export type ImageSource = "ai" | "upload" | "url";

export type ContentItemPreview = {
  id?: string;
  platform: Platform;
  copy: string;
  media_brief?: string | null;
  content_type?: string | null;
  image_url?: string | null;
  image_source?: ImageSource | null;
};

export type BrandIdentity = {
  name: string;
  handle?: string;          // @handle (LTR)
  avatar_url?: string | null;
  logo_url?: string | null;
  brand_colors?: string[];  // hex
  headline?: string;        // LinkedIn subtitle
  website?: string;
};

export function extractHashtags(copy: string): string[] {
  const matches = copy.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? Array.from(new Set(matches)) : [];
}

export function stripHashtags(copy: string): string {
  return copy.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+\n/g, "\n").trim();
}

export function brandInitial(name: string): string {
  return (name?.trim()?.[0] ?? "•").toUpperCase();
}

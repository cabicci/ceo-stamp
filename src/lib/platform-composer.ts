import type { Channel } from "./campaign-packages";

/** Native composer / upload URLs for manual publishing (no API). */
const COMPOSER_URLS: Record<Channel, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/create/select/",
  linkedin: "https://www.linkedin.com/post/new/",
  tiktok: "https://www.tiktok.com/upload",
  x: "https://x.com/compose/post",
};

export function normalizeChannel(platform: string): Channel | null {
  const p = platform.trim().toLowerCase();
  if (p === "twitter") return "x";
  if (p in COMPOSER_URLS) return p as Channel;
  return null;
}

export function getPlatformComposerUrl(platform: string): string | null {
  const channel = normalizeChannel(platform);
  if (!channel) return null;
  return COMPOSER_URLS[channel];
}

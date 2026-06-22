import { z } from "zod";

/** Prepends https:// when the user enters a bare domain (e.g. masaarat.ai). */
export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export const websiteUrlSchema = z
  .string()
  .trim()
  .transform(normalizeWebsiteUrl)
  .pipe(z.string().url().max(2048));

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  website_url: websiteUrlSchema,
});

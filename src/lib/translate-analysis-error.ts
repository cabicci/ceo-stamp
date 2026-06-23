import type { TranslateFn } from "@/i18n/I18nProvider";

/** Resolve website_analysis.error_message — i18n key (with optional JSON params) or legacy raw string. */
export function translateAnalysisError(
  message: string | null | undefined,
  t: TranslateFn,
): string {
  if (!message) return t("analysis.unknownError");
  if (!message.startsWith("analysis.errors.")) return message;

  const colon = message.indexOf(":");
  if (colon > 0) {
    const key = message.slice(0, colon);
    const rawParams = message.slice(colon + 1);
    if (key.startsWith("analysis.errors.")) {
      try {
        const params = JSON.parse(rawParams) as Record<string, string | number>;
        return t(key, params);
      } catch {
        return t(key);
      }
    }
  }

  return t(message);
}

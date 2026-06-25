import type { TranslateFn } from "@/i18n/I18nProvider";

/** Resolve connected_sites.error_message — i18n key or legacy raw string. */
export function translateConnectedSitesError(
  message: string | null | undefined,
  t: TranslateFn,
): string {
  if (!message) return "";
  if (message.startsWith("connectedSites.")) return t(message);
  return message;
}

/**
 * Shared Browserbase CDP helpers — SERVER ONLY.
 * Used by connect-site and scrape-authenticated flows.
 */

import type { BBDebug } from "./browserbase.server";

export const BROWSERBASE_NAV_TIMEOUT_MS = 15_000;

export function resolvePageDebuggerUrl(debug: BBDebug): string | null {
  return debug.pages?.[0]?.debuggerUrl ?? debug.debuggerUrl ?? null;
}

/** Connect CDP to a Browserbase debug page and navigate; closes CDP when done. */
export async function navigateBrowserbaseDebugPage(
  debug: BBDebug,
  url: string,
  timeoutMs = BROWSERBASE_NAV_TIMEOUT_MS,
): Promise<{ ok: boolean; finalUrl: string }> {
  const cdpMod = await import("./cdp.server");
  const pageDebugger = resolvePageDebuggerUrl(debug);
  if (!pageDebugger) return { ok: false, finalUrl: url };

  const cdp = await cdpMod.CDPSession.connect(pageDebugger);
  try {
    return await cdpMod.navigate(cdp, url, timeoutMs);
  } catch {
    return { ok: false, finalUrl: url };
  } finally {
    cdp.close();
  }
}

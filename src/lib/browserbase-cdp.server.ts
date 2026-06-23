/**
 * Shared Browserbase CDP helpers — SERVER ONLY.
 * Connect flow uses session wsUrl (CDP). Scraping uses per-page debuggerUrl separately.
 */

import type { BBDebug } from "./browserbase.server";
import type { CDPSession } from "./cdp.server";

export const BROWSERBASE_NAV_TIMEOUT_MS = 15_000;

/** Session-level CDP WebSocket — not the HTML debugger UI URLs. */
export function resolveSessionCdpWsUrl(debug: BBDebug): string | null {
  const ws = debug.wsUrl?.trim();
  return ws || null;
}

/**
 * Navigate the Browserbase session to a URL before the client opens the live view.
 * Returns success/failure only — never page body or HTML.
 */
export async function navigateBrowserbaseDebugPage(
  debug: BBDebug,
  url: string,
  timeoutMs = BROWSERBASE_NAV_TIMEOUT_MS,
): Promise<{ ok: boolean }> {
  const cdpMod = await import("./cdp.server");
  const wsUrl = resolveSessionCdpWsUrl(debug);
  if (!wsUrl) return { ok: false };

  let cdp: CDPSession | null = null;
  try {
    cdp = await cdpMod.CDPSession.connect(wsUrl);
    const result = await cdpMod.navigate(cdp, url, timeoutMs, {
      readFinalUrl: false,
      dismissDialogs: true,
    });
    return { ok: result.ok };
  } catch {
    return { ok: false };
  } finally {
    cdp?.close();
  }
}

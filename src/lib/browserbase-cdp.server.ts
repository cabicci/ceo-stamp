/**
 * Shared Browserbase CDP helpers — SERVER ONLY.
 * Connect + scrape both use page-level debuggerUrl (not session wsUrl).
 */

import type { BBDebug } from "./browserbase.server";
import type { CDPSession } from "./cdp.server";

export const BROWSERBASE_NAV_TIMEOUT_MS = 15_000;

export type ConnectNavigateErrorCode =
  | "NO_CDP_URL"
  | "CDP_CONNECT_FAILED"
  | "CDP_NAVIGATE_FAILED"
  | "CDP_UNEXPECTED";

function logConnectNavigateFailure(
  code: ConnectNavigateErrorCode,
  detail?: string,
): void {
  const safe =
    detail && detail.length > 200 ? `${detail.slice(0, 200)}…` : detail;
  console.error("[connect-nav]", code, safe ?? "");
}

/**
 * Page-level CDP WebSocket — same resolution as scrape-authenticated.functions.ts.
 * NOT debuggerFullscreenUrl (live view) and NOT wsUrl (session-level).
 */
export function resolvePageCdpUrl(debug: BBDebug): string | null {
  const url = debug.pages?.[0]?.debuggerUrl ?? debug.debuggerUrl;
  const trimmed = url?.trim();
  return trimmed || null;
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
  const pageDebugger = resolvePageCdpUrl(debug);
  if (!pageDebugger) {
    logConnectNavigateFailure("NO_CDP_URL");
    return { ok: false };
  }

  let cdp: CDPSession | null = null;
  try {
    cdp = await cdpMod.CDPSession.connect(pageDebugger);
    const result = await cdpMod.navigate(cdp, url, timeoutMs, {
      readFinalUrl: false,
      dismissDialogs: true,
    });
    if (!result.ok) {
      logConnectNavigateFailure("CDP_NAVIGATE_FAILED");
    }
    return { ok: result.ok };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const code: ConnectNavigateErrorCode =
      detail.includes("WebSocket") || detail.includes("upgrade")
        ? "CDP_CONNECT_FAILED"
        : "CDP_UNEXPECTED";
    logConnectNavigateFailure(code, detail);
    return { ok: false };
  } finally {
    cdp?.close();
  }
}

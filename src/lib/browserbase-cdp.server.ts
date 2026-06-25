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

/** TEMPORARY — surfaced in ConnectModal when auto-navigation fails. */
export type ConnectNavigateDebugInfo = {
  code: ConnectNavigateErrorCode;
  message: string;
  cdpUrlField: "pages[0].debuggerUrl" | "debuggerUrl" | "none";
  /** Normalized wss URL prefix actually passed to CDPSession.connect. */
  cdpUrlPrefix: string | null;
  /** Raw debuggerUrl from Browserbase before normalization. */
  rawCdpUrlPrefix: string | null;
  pagesEmpty: boolean;
  pagesCount: number;
  page0DebuggerUrlDefined: boolean;
  debuggerUrlDefined: boolean;
  /** Set when CDPSession.connect fetch+Upgrade fails. */
  upgradeStatus?: number;
  upgradeContentType?: string | null;
  hasWebSocket?: boolean;
};

export type ConnectNavigateResult = {
  ok: boolean;
  /** Present only when ok is false — temporary client debug surfacing. */
  debugInfo?: ConnectNavigateDebugInfo;
};

function truncateDetail(detail: string): string {
  return detail.length > 200 ? `${detail.slice(0, 200)}…` : detail;
}

function logConnectNavigateFailure(
  code: ConnectNavigateErrorCode,
  detail?: string,
): void {
  const safe = detail ? truncateDetail(detail) : detail;
  console.error("[connect-nav]", code, safe ?? "");
}

export type CdpUrlResolution = {
  url: string | null;
  field: ConnectNavigateDebugInfo["cdpUrlField"];
  prefix: string | null;
  pagesEmpty: boolean;
  pagesCount: number;
  page0DebuggerUrlDefined: boolean;
  debuggerUrlDefined: boolean;
};

/** Inspect which CDP URL field would be used (same logic as scrape). */
export function inspectCdpUrlResolution(debug: BBDebug): CdpUrlResolution {
  const pagesCount = debug.pages?.length ?? 0;
  const pagesEmpty = pagesCount === 0;
  const page0DebuggerUrlDefined = Boolean(debug.pages?.[0]?.debuggerUrl?.trim());
  const debuggerUrlDefined = Boolean(debug.debuggerUrl?.trim());

  const page0 = debug.pages?.[0]?.debuggerUrl?.trim();
  if (page0) {
    return {
      url: page0,
      field: "pages[0].debuggerUrl",
      prefix: page0.slice(0, 70),
      pagesEmpty,
      pagesCount,
      page0DebuggerUrlDefined,
      debuggerUrlDefined,
    };
  }

  const fallback = debug.debuggerUrl?.trim();
  if (fallback) {
    return {
      url: fallback,
      field: "debuggerUrl",
      prefix: fallback.slice(0, 70),
      pagesEmpty,
      pagesCount,
      page0DebuggerUrlDefined,
      debuggerUrlDefined,
    };
  }

  return {
    url: null,
    field: "none",
    prefix: null,
    pagesEmpty,
    pagesCount,
    page0DebuggerUrlDefined,
    debuggerUrlDefined,
  };
}

/**
 * Page-level debugger URL from Browserbase — same resolution as scrape.
 * May be an HTML inspector page URL, not a raw WebSocket endpoint.
 * NOT debuggerFullscreenUrl (live view) and NOT wsUrl (session-level).
 */
export function resolvePageCdpUrl(debug: BBDebug): string | null {
  return inspectCdpUrlResolution(debug).url;
}

/**
 * Browserbase returns debuggerUrl as an HTML DevTools inspector page whose
 * `wss` query param holds the real CDP WebSocket target. Raw ws(s) URLs pass through.
 */
export function normalizeCdpWebSocketUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    // URLSearchParams handles encoding; do not naive-split on "wss=" (breaks tokens).
    let wssParam = parsed.searchParams.get("wss");
    if (!wssParam) {
      // Rare malformed URLs: recover value after first "wss=" in the query string.
      const marker = "wss=";
      const q = parsed.search;
      const idx = q.indexOf(marker);
      if (idx === -1) return null;
      wssParam = q.slice(idx + marker.length);
      const amp = wssParam.indexOf("&");
      if (amp !== -1) wssParam = wssParam.slice(0, amp);
    }
    if (!wssParam) return null;

    const decoded = decodeURIComponent(wssParam.replace(/\+/g, "%20"));
    if (/^wss?:\/\//i.test(decoded)) {
      return decoded;
    }
    const hostPath = decoded.replace(/^\/+/, "");
    return hostPath ? `wss://${hostPath}` : null;
  } catch {
    return null;
  }
}

/** Resolved page debugger URL normalized to a CDP WebSocket endpoint. */
export function resolvePageCdpWebSocketUrl(debug: BBDebug): string | null {
  const raw = resolvePageCdpUrl(debug);
  if (!raw) return null;
  return normalizeCdpWebSocketUrl(raw);
}

function buildDebugInfo(
  code: ConnectNavigateErrorCode,
  message: string,
  cdp: CdpUrlResolution,
  connectWsUrl: string | null,
  upgrade?: {
    upgradeStatus?: number;
    upgradeContentType?: string | null;
    hasWebSocket?: boolean;
  },
): ConnectNavigateDebugInfo {
  return {
    code,
    message: truncateDetail(message),
    cdpUrlField: cdp.field,
    cdpUrlPrefix: connectWsUrl ? connectWsUrl.slice(0, 70) : null,
    rawCdpUrlPrefix: cdp.prefix,
    pagesEmpty: cdp.pagesEmpty,
    pagesCount: cdp.pagesCount,
    page0DebuggerUrlDefined: cdp.page0DebuggerUrlDefined,
    debuggerUrlDefined: cdp.debuggerUrlDefined,
    ...(upgrade?.upgradeStatus !== undefined && { upgradeStatus: upgrade.upgradeStatus }),
    ...(upgrade?.upgradeContentType !== undefined && {
      upgradeContentType: upgrade.upgradeContentType,
    }),
    ...(upgrade?.hasWebSocket !== undefined && { hasWebSocket: upgrade.hasWebSocket }),
  };
}

/**
 * Navigate the Browserbase session to a URL before the client opens the live view.
 * Returns success/failure only — never page body or HTML.
 */
export async function navigateBrowserbaseDebugPage(
  debug: BBDebug,
  url: string,
  timeoutMs = BROWSERBASE_NAV_TIMEOUT_MS,
): Promise<ConnectNavigateResult> {
  const cdpMod = await import("./cdp.server");
  const cdpMeta = inspectCdpUrlResolution(debug);
  const pageDebugger = cdpMeta.url;

  if (!pageDebugger) {
    logConnectNavigateFailure("NO_CDP_URL");
    return {
      ok: false,
      debugInfo: buildDebugInfo(
        "NO_CDP_URL",
        "No page-level debuggerUrl available",
        cdpMeta,
        null,
      ),
    };
  }

  const wsUrl = normalizeCdpWebSocketUrl(pageDebugger);
  if (!wsUrl) {
    logConnectNavigateFailure("NO_CDP_URL", "Could not extract wss from debuggerUrl");
    return {
      ok: false,
      debugInfo: buildDebugInfo(
        "NO_CDP_URL",
        "Could not extract wss URL from debuggerUrl",
        cdpMeta,
        null,
      ),
    };
  }

  console.error("[connect-nav] CDPSession.connect wsUrl prefix:", wsUrl.slice(0, 70));

  let cdp: CDPSession | null = null;
  try {
    cdp = await cdpMod.CDPSession.connect(wsUrl);
    const result = await cdpMod.navigate(cdp, url, timeoutMs, {
      readFinalUrl: false,
      dismissDialogs: true,
    });
    if (!result.ok) {
      logConnectNavigateFailure("CDP_NAVIGATE_FAILED");
      return {
        ok: false,
        debugInfo: buildDebugInfo(
          "CDP_NAVIGATE_FAILED",
          "Page.navigate returned ok:false",
          cdpMeta,
          wsUrl,
        ),
      };
    }
    return { ok: true };
  } catch (err) {
    const cdpErr = err instanceof cdpMod.CdpConnectError ? err : null;
    const detail = err instanceof Error ? err.message : String(err);
    const code: ConnectNavigateErrorCode =
      detail.includes("WebSocket") || detail.includes("upgrade")
        ? "CDP_CONNECT_FAILED"
        : "CDP_UNEXPECTED";
    logConnectNavigateFailure(code, detail);
    return {
      ok: false,
      debugInfo: buildDebugInfo(code, detail, cdpMeta, wsUrl, {
        upgradeStatus: cdpErr?.upgradeStatus,
        upgradeContentType: cdpErr?.upgradeContentType,
        hasWebSocket: cdpErr?.hasWebSocket,
      }),
    };
  } finally {
    cdp?.close();
  }
}

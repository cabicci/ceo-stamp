/**
 * Minimal Chrome DevTools Protocol client over WebSocket — SERVER ONLY.
 *
 * Designed for Cloudflare Workers (workerd) using the fetch+Upgrade pattern.
 * Also works in any runtime that exposes that pattern on `fetch()`.
 *
 * Scope is intentionally tiny: connect to a Browserbase per-page debuggerUrl,
 * Page.enable, Page.navigate (with load + redirect detection), and
 * Runtime.evaluate to read DOM data. We do NOT pull in playwright/puppeteer
 * because they require Node-only APIs not present in workerd.
 */

type Resolver = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export class CDPSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ws: any;
  private nextId = 1;
  private pending = new Map<number, Resolver>();
  private listeners = new Map<string, Array<(params: unknown) => void>>();
  private closed = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(ws: any) {
    this.ws = ws;
    ws.addEventListener("message", (e: MessageEvent) => {
      try {
        const data =
          typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
        const msg = JSON.parse(data) as {
          id?: number;
          method?: string;
          params?: unknown;
          result?: unknown;
          error?: { message: string };
        };
        if (msg.id !== undefined) {
          const r = this.pending.get(msg.id);
          if (!r) return;
          this.pending.delete(msg.id);
          if (msg.error) r.reject(new Error(`CDP ${msg.id}: ${msg.error.message}`));
          else r.resolve(msg.result);
        } else if (msg.method) {
          const ls = this.listeners.get(msg.method);
          if (ls) for (const fn of ls) fn(msg.params);
        }
      } catch {
        /* ignore malformed CDP frame */
      }
    });
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const r of this.pending.values()) r.reject(new Error("CDP connection closed"));
      this.pending.clear();
    });
  }

  static async connect(wsUrl: string): Promise<CDPSession> {
    // workerd: outbound WebSocket via fetch+Upgrade
    const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const resp = await fetch(httpUrl, { headers: { Upgrade: "websocket" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (resp as any).webSocket;
    if (!ws) throw new Error(`WebSocket upgrade failed (status ${resp.status})`);
    ws.accept();
    return new CDPSession(ws);
  }

  on(method: string, fn: (params: unknown) => void): void {
    const arr = this.listeners.get(method) ?? [];
    arr.push(fn);
    this.listeners.set(method, arr);
  }

  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params: params ?? {} });
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      try {
        this.ws.send(payload);
      } catch (e) {
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  close(): void {
    try {
      this.ws.close(1000, "done");
    } catch {
      /* ignore */
    }
    this.closed = true;
  }
}

/** Navigate the page, wait until load fires (or timeout), then return final URL. */
export async function navigate(
  cdp: CDPSession,
  url: string,
  timeoutMs = 15_000,
): Promise<{ finalUrl: string; ok: boolean }> {
  await cdp.send("Page.enable");
  const loaded = new Promise<void>((resolve) => {
    const onLoad = () => {
      cdp.send("Page.disable").catch(() => {});
      resolve();
    };
    cdp.on("Page.loadEventFired", onLoad);
    cdp.on("Page.frameStoppedLoading", onLoad);
  });
  try {
    await cdp.send("Page.navigate", { url });
  } catch (e) {
    return { finalUrl: url, ok: false };
  }
  await Promise.race([
    loaded,
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
  // Small settle delay for SPA hydration
  await new Promise((r) => setTimeout(r, 600));
  const res = (await cdp.send("Runtime.evaluate", {
    expression: "location.href",
    returnByValue: true,
  })) as { result?: { value?: string } };
  return { finalUrl: res.result?.value ?? url, ok: true };
}

/** Extract visible text + same-host links from the current page. */
export async function extractPage(cdp: CDPSession): Promise<{
  url: string;
  title: string;
  text: string;
  links: string[];
}> {
  const expr = `
    (function() {
      const doc = document;
      const drop = doc.querySelectorAll('script,style,noscript');
      drop.forEach(n => n.remove());
      const text = (doc.body && doc.body.innerText) ? doc.body.innerText : '';
      const links = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => a.href).filter(Boolean);
      return JSON.stringify({
        url: location.href,
        title: doc.title || '',
        text: text.replace(/\\s+/g, ' ').trim().slice(0, 20000),
        links,
      });
    })()
  `;
  const res = (await cdp.send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
  })) as { result?: { value?: string } };
  const raw = res.result?.value ?? '{"url":"","title":"","text":"","links":[]}';
  return JSON.parse(raw) as { url: string; title: string; text: string; links: string[] };
}

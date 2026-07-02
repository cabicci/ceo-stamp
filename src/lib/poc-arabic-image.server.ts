/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Asset strategy (no self-fetch to the Worker's own origin, no public/, no
 * runtime node:fs):
 *   - Font: embedded as base64 at build time (Cairo Regular ~600 KB → ~800 KB
 *     base64). Small enough to inline and 100% reliable in every runtime.
 *   - Wasm: obtained via a chain of loader strategies that each work in one of
 *     our environments (workerd/nitro at runtime, Vite SSR dev in Node).
 *     Order:
 *       1. Direct `import "…index_bg.wasm"` (nitro/wrangler-style — yields a
 *          real `WebAssembly.Module`).
 *       2. Vite `?init` (returns an instantiator; we instead re-fetch via
 *          `?url` when needed — see step 3).
 *       3. `?url` + `fetch(new URL(url, import.meta.url))` — resolves to a
 *          `file://` URL in Node dev, which undici's fetch DOES support (it
 *          reads the file from disk, no HTTP self-fetch involved).
 */

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import RESVG_WASM_URL from "@resvg/resvg-wasm/index_bg.wasm?url";
import { CAIRO_REGULAR_BASE64 } from "./poc-cairo-font.base64";

let wasmInit: Promise<void> | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Load the resvg wasm as a WebAssembly.Module or raw bytes, without any
 * self-fetch to the Worker origin.
 */
async function loadResvgWasm(): Promise<WebAssembly.Module | ArrayBuffer | Uint8Array> {
  const attempts: string[] = [];

  // Strategy 1: direct wasm import. On workerd/nitro this returns a real
  // `WebAssembly.Module` compiled at build time (no fetch, no fs).
  try {
    const wasmSpecifier = "@resvg/resvg-wasm/index_bg.wasm";
    const mod: unknown = await import(/* @vite-ignore */ wasmSpecifier);
    const value = (mod as { default?: unknown })?.default ?? mod;
    if (value instanceof WebAssembly.Module) return value;
    if (value instanceof ArrayBuffer) return value;
    if (value instanceof Uint8Array) return value;
    attempts.push(`direct-import: unexpected type ${Object.prototype.toString.call(value)}`);
  } catch (err) {
    attempts.push(`direct-import: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Strategy 2: Node dev — read the ?url asset from disk via node:fs. In Vite
  // SSR the URL is a served path (e.g. "/@fs/abs/path" or "/node_modules/…");
  // we resolve it against the on-disk node_modules copy.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFile } = await import("node:fs/promises");
    // Node's require.resolve isn't available in ESM; use import.meta.resolve
    // when present, else fall back to the well-known node_modules path.
    let filePath: string | null = null;
    try {
      const metaResolve = (import.meta as unknown as { resolve?: (s: string) => string | Promise<string> }).resolve;
      const resolved: string | undefined = metaResolve ? await metaResolve("@resvg/resvg-wasm/index_bg.wasm") : undefined;
      if (resolved?.startsWith("file://")) {
        filePath = new URL(resolved).pathname;
      }
    } catch {
      // ignore
    }
    if (!filePath) filePath = "/dev-server/node_modules/@resvg/resvg-wasm/index_bg.wasm";
    const buf = await readFile(filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (err) {
    attempts.push(`node-fs: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Strategy 3: fetch the ?url asset relative to this module. Last resort.
  try {
    const resolved = new URL(RESVG_WASM_URL, import.meta.url);
    const res = await fetch(resolved);
    if (!res.ok) {
      attempts.push(`fetch-url ${resolved.toString()}: ${res.status}`);
    } else {
      return await res.arrayBuffer();
    }
  } catch (err) {
    attempts.push(`fetch-url: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`Could not load resvg wasm. Attempts: ${attempts.join(" | ")}`);
}

async function ensureResvgWasm(): Promise<void> {
  if (!wasmInit) {
    wasmInit = (async () => {
      const asset = await loadResvgWasm();
      try {
        // initWasm accepts BufferSource | WebAssembly.Module | Promise<…> | Response
        await initWasm(asset as WebAssembly.Module);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("already initialized")) {
          throw err;
        }
      }
    })();
  }
  await wasmInit;
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Cairo';
        src: url('${fontData}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    ]]></style>
  </defs>
  <rect width="800" height="800" fill="#1a1a1a"/>
  <text x="400" y="300" direction="rtl" text-anchor="middle" font-family="Cairo" font-size="52" fill="#ffffff" xml:lang="ar">جرّب مجاناً</text>
  <text x="400" y="400" direction="rtl" text-anchor="middle" font-family="Cairo" font-size="36" fill="#ffffff" xml:lang="ar">من غير ما تكتب سطر كود</text>
  <text x="400" y="500" direction="rtl" text-anchor="middle" font-family="Cairo" font-size="44" fill="#ffffff" xml:lang="ar">ابدأ النهاردة</text>
</svg>`;
}

/** Render 800×800 Arabic text PNG; returns raw base64 (no data: prefix). */
export async function runArabicImagePoc(): Promise<string> {
  const fontBytes = base64ToBytes(CAIRO_REGULAR_BASE64);
  const svg = buildArabicPocSvg(CAIRO_REGULAR_BASE64);

  await ensureResvgWasm();

  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [fontBytes],
      defaultFontFamily: "Cairo",
      sansSerifFamily: "Cairo",
    },
    fitTo: { mode: "width", value: 800 },
  });

  try {
    const rendered = resvg.render();
    try {
      const png = rendered.asPng();
      return bytesToBase64(png);
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}

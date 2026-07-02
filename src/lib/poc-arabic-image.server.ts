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
  // Strategy 1: direct wasm import. On workerd/nitro this returns a
  // real WebAssembly.Module compiled at build time.
  try {
    const mod: unknown = await import(
      /* @vite-ignore */ "@resvg/resvg-wasm/index_bg.wasm"
    );
    const value = (mod as { default?: unknown })?.default ?? mod;
    if (value instanceof WebAssembly.Module) return value;
    if (value instanceof ArrayBuffer) return value;
    if (value instanceof Uint8Array) return value;
  } catch {
    // fall through
  }

  // Strategy 2: fetch the ?url asset. In Vite SSR dev the URL is like
  // "/src/…" or "/@fs/…"; resolving it against import.meta.url yields a
  // file:// URL, which Node's undici fetch reads from disk (no HTTP call).
  // On workerd the ?url resolves to an absolute asset URL served by the
  // static asset binding — still no origin self-fetch.
  const resolved = new URL(RESVG_WASM_URL, import.meta.url);
  const res = await fetch(resolved);
  if (!res.ok) {
    throw new Error(`Failed to load resvg wasm from ${resolved.toString()} (${res.status})`);
  }
  return await res.arrayBuffer();
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

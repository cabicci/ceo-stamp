/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Wasm + font are bundled as Vite URL assets (?url) and fetched at runtime —
 * no node:fs / createRequire (unavailable on Cloudflare Workers).
 */

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import RESVG_WASM_URL from "@resvg/resvg-wasm/index_bg.wasm?url";
import CAIRO_FONT_URL from "./report/fonts/Cairo-Regular.ttf?url";

let wasmInit: Promise<void> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadCairoFontBytes(): Promise<Uint8Array> {
  const res = await fetch(CAIRO_FONT_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Cairo font (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function ensureResvgWasm(): Promise<void> {
  if (!wasmInit) {
    wasmInit = (async () => {
      const res = await fetch(RESVG_WASM_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch resvg wasm (${res.status})`);
      }
      const wasmBytes = await res.arrayBuffer();
      try {
        await initWasm(wasmBytes);
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
  const fontBytes = await loadCairoFontBytes();
  const cairoBase64 = bytesToBase64(fontBytes);
  const svg = buildArabicPocSvg(cairoBase64);

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

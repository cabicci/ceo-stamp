/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

let wasmInit: Promise<void> | null = null;

function loadCairoFontBase64(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const ttf = path.join(dir, "report", "fonts", "Cairo-Regular.ttf");
  return readFileSync(ttf).toString("base64");
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

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadResvgWasmBytes(): Promise<Uint8Array> {
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    return readFileSync(wasmPath);
  } catch {
    // workerd / Cloudflare: no node_modules on disk — fetch published wasm bytes.
    const res = await fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
    if (!res.ok) {
      throw new Error(`Failed to fetch resvg wasm (${res.status})`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}

async function ensureResvgWasm(): Promise<void> {
  if (!wasmInit) {
    wasmInit = (async () => {
      const wasmBytes = await loadResvgWasmBytes();
      await initWasm(wasmBytes);
    })();
  }
  await wasmInit;
}

/** Render 800×800 Arabic text PNG; returns raw base64 (no data: prefix). */
export async function runArabicImagePoc(): Promise<string> {
  const cairoBase64 = loadCairoFontBase64();
  const svg = buildArabicPocSvg(cairoBase64);
  const fontBytes = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "report", "fonts", "Cairo-Regular.ttf"),
  );

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
      return uint8ToBase64(png);
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}

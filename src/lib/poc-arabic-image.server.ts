/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Bidi comparison: three render strategies for mixed Arabic + Latin hooks.
 */

import { Resvg } from "@resvg/resvg-wasm";
import {
  bytesToBase64,
  cairoResvgFontOptions,
  ensureResvgWasm,
  getCairoFontBase64,
} from "./resvg-cairo.server";

/** Reproduces production bidi bug — Latin "AI" misplaced in RTL hook. */
const BIDI_TEST_STRING = "زملاؤك سبقوك بالـ AI";

const LRI = "\u2066";
const PDI = "\u2069";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap each Latin/digit run in LRI…PDI isolates (approach b). */
export function isolateLatinRuns(text: string): string {
  return text.replace(/[A-Za-z0-9]+/g, (run) => `${LRI}${run}${PDI}`);
}

function rtlHookText(args: {
  y: number;
  text: string;
  unicodeBidi?: "embed";
}): string {
  const bidiAttr = args.unicodeBidi ? ` unicode-bidi="${args.unicodeBidi}"` : "";
  return `<text x="400" y="${args.y}" direction="rtl" text-anchor="middle" font-family="Cairo" font-size="40" fill="#ffffff" xml:lang="ar"${bidiAttr}>${escapeXml(args.text)}</text>`;
}

function labelText(y: number, label: string): string {
  return `<text x="400" y="${y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="16" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const isolated = isolateLatinRuns(BIDI_TEST_STRING);

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

  ${labelText(100, "V1 — baseline (direction=rtl only)")}
  ${rtlHookText({ y: 200, text: BIDI_TEST_STRING })}

  ${labelText(320, "V2 — LRI/PDI isolates on Latin runs")}
  ${rtlHookText({ y: 420, text: isolated })}

  ${labelText(540, "V3 — V2 + svg direction=rtl + unicode-bidi=embed")}
  <svg x="0" y="560" width="800" height="200" viewBox="0 0 800 200" direction="rtl">
    ${rtlHookText({ y: 100, text: isolated, unicodeBidi: "embed" })}
  </svg>
</svg>`;
}

/** Render 800×800 bidi comparison PNG; returns raw base64 (no data: prefix). */
export async function runArabicImagePoc(): Promise<string> {
  const svg = buildArabicPocSvg(getCairoFontBase64());

  await ensureResvgWasm();

  const resvg = new Resvg(svg, {
    font: cairoResvgFontOptions(),
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

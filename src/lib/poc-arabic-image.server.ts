/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Bidi via bidi-js (UAX#9): visual paint string + direction=ltr for resvg.
 */

import { Resvg } from "@resvg/resvg-wasm";
import { computeVisualPaintString } from "./bidi-visual.server";
import {
  bytesToBase64,
  cairoResvgFontOptions,
  ensureResvgWasm,
  getCairoFontBase64,
} from "./resvg-cairo.server";

const BIDI_TESTS = [
  {
    label: "mixed Latin end: زملاؤك سبقوك بالـ AI",
    logical: "زملاؤك سبقوك بالـ AI",
  },
  {
    label: "embedded Latin: ابدأ مع masaarat دلوقتي",
    logical: "ابدأ مع masaarat دلوقتي",
  },
  {
    label: "pure Arabic: جرّب مجاناً النهاردة",
    logical: "جرّب مجاناً النهاردة",
  },
  {
    label: "Arabic + digits: وفّر 50% دلوقتي",
    logical: "وفّر 50% دلوقتي",
  },
] as const;

/** Re-export for future production burn pipeline. */
export { computeVisualPaintString as visualPaintStringForRtl } from "./bidi-visual.server";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hookText(args: { y: number; text: string; fontSize?: number }): string {
  const fontSize = args.fontSize ?? 28;
  return `<text x="400" y="${args.y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#ffffff" xml:lang="ar">${escapeXml(args.text)}</text>`;
}

function labelText(y: number, label: string, fontSize = 12): string {
  return `<text x="400" y="${y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const hookFont = 28;
  const lineGap = 88;
  const topPad = 48;
  const height = topPad + BIDI_TESTS.length * lineGap + 40;

  const lines = BIDI_TESTS.map((test, index) => {
    const labelY = topPad + index * lineGap;
    const textY = labelY + 36;
    const paintText = computeVisualPaintString(test.logical);
    return `${labelText(labelY, `bidi-js — ${test.label}`)}
  ${hookText({ y: textY, text: paintText, fontSize: hookFont })}`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}">
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
  <rect width="800" height="${height}" fill="#1a1a1a"/>
  ${lines}
</svg>`;
}

/** Render bidi-js comparison PNG; returns raw base64 (no data: prefix). */
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

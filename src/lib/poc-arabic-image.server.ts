/**
 * POC — per-word absolute layout for resvg (isolated).
 * ISOLATED: not wired into production flows.
 *
 * bidi-js visual word order + fontkit-measured widths + separate <text> per word.
 */

import { Resvg } from "@resvg/resvg-wasm";
import { measureWordWidthPx, wordGapPx } from "./cairo-text-metrics.server";
import { getVisualWordOrder } from "./bidi-visual.server";
import {
  bytesToBase64,
  cairoResvgFontOptions,
  ensureResvgWasm,
  getCairoFontBase64,
} from "./resvg-cairo.server";

// Verified: getVisualWordOrder("زملاؤك سبقوك بالـ AI") → ["AI","بالـ","سبقوك","زملاؤك"] (index 0 = leftmost)
const CANONICAL_ORDER_CHECK = getVisualWordOrder("زملاؤك سبقوك بالـ AI");
if (
  CANONICAL_ORDER_CHECK.join("|") !== ["AI", "بالـ", "سبقوك", "زملاؤك"].join("|")
) {
  console.warn(
    "[poc-arabic-image] unexpected visual word order:",
    CANONICAL_ORDER_CHECK,
    'expected ["AI","بالـ","سبقوك","زملاؤك"]',
  );
}

const BIDI_TESTS = [
  { label: "mixed Latin end", logical: "زملاؤك سبقوك بالـ AI" },
  { label: "embedded Latin", logical: "ابدأ مع masaarat دلوقتي" },
  { label: "pure Arabic", logical: "جرّب مجاناً النهاردة" },
  { label: "Arabic + digits", logical: "وفّر 50% دلوقتي" },
] as const;

/** Re-export for future production burn pipeline. */
export { getVisualWordOrder } from "./bidi-visual.server";
export { measureWordWidthPx, wordGapPx } from "./cairo-text-metrics.server";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function layoutWordLine(args: {
  words: string[];
  y: number;
  cx: number;
  fontSize: number;
}): Promise<string> {
  const { words, y, cx, fontSize } = args;
  if (words.length === 0) return "";

  const gap = wordGapPx(fontSize);
  const widths = await Promise.all(words.map((word) => measureWordWidthPx(word, fontSize)));
  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, words.length - 1);

  let x = cx - totalWidth / 2;

  return words
    .map((word, index) => {
      const xPos = Math.round(x);
      x += widths[index] + gap;
      return `<text x="${xPos}" y="${y}" text-anchor="start" font-family="Cairo" font-size="${fontSize}" fill="#ffffff" xml:lang="ar">${escapeXml(word)}</text>`;
    })
    .join("\n  ");
}

function labelText(y: number, label: string): string {
  return `<text x="400" y="${y}" text-anchor="middle" font-family="Cairo" font-size="12" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

async function buildArabicPocSvg(cairoBase64: string): Promise<string> {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const hookFont = 28;
  const cx = 400;
  const lineGap = 88;
  const topPad = 48;
  const height = topPad + BIDI_TESTS.length * lineGap + 40;

  const lineBlocks = await Promise.all(
    BIDI_TESTS.map(async (test, index) => {
      const labelY = topPad + index * lineGap;
      const textY = labelY + 36;
      const words = getVisualWordOrder(test.logical);
      const wordSvg = await layoutWordLine({ words, y: textY, cx, fontSize: hookFont });
      return `${labelText(labelY, `${test.label}: ${test.logical}`)}
  ${wordSvg}`;
    }),
  );

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
  ${lineBlocks.join("\n  ")}
</svg>`;
}

/** Render per-word layout POC PNG; returns raw base64 (no data: prefix). */
export async function runArabicImagePoc(): Promise<string> {
  const svg = await buildArabicPocSvg(getCairoFontBase64());

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

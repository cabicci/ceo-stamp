/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Per-word SVG layout: bidi-js for visual token order, manual x positions (no resvg bidi).
 */

import { Resvg } from "@resvg/resvg-wasm";
import { getVisualWordOrder } from "./bidi-visual.server";
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

const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_DIGIT_RE = /[A-Za-z0-9]/;

/** Re-export for future production burn pipeline. */
export { getVisualWordOrder } from "./bidi-visual.server";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function widthFactorForWord(word: string): number {
  const hasArabic = [...word].some((ch) => ARABIC_RE.test(ch));
  const hasLatinDigit = [...word].some((ch) => LATIN_DIGIT_RE.test(ch));
  if (hasLatinDigit && !hasArabic) return 0.6;
  return 0.55;
}

function estimateWordWidth(word: string, fontSize: number): number {
  return word.length * fontSize * widthFactorForWord(word);
}

function wordGap(fontSize: number): number {
  return fontSize * 0.28;
}

/** Build one line of separate <text> nodes at computed x positions (L→R visual order). */
function layoutWordTexts(args: {
  words: string[];
  y: number;
  cx: number;
  fontSize: number;
}): string {
  const { words, y, cx, fontSize } = args;
  if (words.length === 0) return "";

  const gap = wordGap(fontSize);
  const widths = words.map((word) => estimateWordWidth(word, fontSize));
  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, words.length - 1);

  let x = cx - totalWidth / 2;

  return words
    .map((word, index) => {
      const xPos = Math.round(x);
      x += widths[index] + gap;
      return `<text x="${xPos}" y="${y}" text-anchor="start" direction="ltr" font-family="Cairo" font-size="${fontSize}" fill="#ffffff" xml:lang="ar">${escapeXml(word)}</text>`;
    })
    .join("\n  ");
}

function labelText(y: number, label: string, fontSize = 12): string {
  return `<text x="400" y="${y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const hookFont = 28;
  const cx = 400;
  const lineGap = 88;
  const topPad = 48;
  const height = topPad + BIDI_TESTS.length * lineGap + 40;

  const lines = BIDI_TESTS.map((test, index) => {
    const labelY = topPad + index * lineGap;
    const textY = labelY + 36;
    const words = getVisualWordOrder(test.logical);
    return `${labelText(labelY, `per-word layout — ${test.label}`)}
  ${layoutWordTexts({ words, y: textY, cx, fontSize: hookFont })}`;
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

/** Render per-word bidi POC PNG; returns raw base64 (no data: prefix). */
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

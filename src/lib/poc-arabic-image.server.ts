/**
 * POC — resvg text positioning diagnostic (isolated).
 * ISOLATED: not wired into production flows.
 *
 * Tests absolute x placement of separate <text> elements vs direction=rtl.
 */

import { Resvg } from "@resvg/resvg-wasm";
import {
  bytesToBase64,
  cairoResvgFontOptions,
  ensureResvgWasm,
  getCairoFontBase64,
} from "./resvg-cairo.server";

const FONT_SIZE = 32;
const WORD_X = [100, 250, 400, 550] as const;
const WORDS = ["زملاؤك", "سبقوك", "بالـ", "AI"] as const;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function labelText(y: number, label: string): string {
  return `<text x="400" y="${y}" text-anchor="middle" font-family="Cairo" font-size="13" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function verticalGuides(args: { xPositions: readonly number[]; yTop: number; yBottom: number }): string {
  return args.xPositions
    .map(
      (x) =>
        `<line x1="${x}" y1="${args.yTop}" x2="${x}" y2="${args.yBottom}" stroke="#ff5555" stroke-width="1" stroke-opacity="0.85"/>` +
        `<text x="${x}" y="${args.yBottom + 14}" text-anchor="middle" font-family="Cairo" font-size="10" fill="#ff5555" xml:lang="en">x=${x}</text>`,
    )
    .join("\n  ");
}

function wordTextsAtFixedX(args: {
  y: number;
  direction?: "rtl";
}): string {
  return WORDS.map((word, index) => {
    const x = WORD_X[index];
    const directionAttr = args.direction ? ` direction="${args.direction}"` : "";
    return `<text x="${x}" y="${args.y}" text-anchor="start" font-family="Cairo" font-size="${FONT_SIZE}" fill="#ffffff" xml:lang="ar"${directionAttr}>${escapeXml(word)}</text>`;
  }).join("\n  ");
}

function buildDiagnosticSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;

  const testAY = 100;
  const testBY = 240;
  const testCY = 380;
  const guideTop = 72;
  const guideBottom = 128;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
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
  <rect width="800" height="480" fill="#1a1a1a"/>

  ${labelText(36, "Test A — separate <text> per word, NO direction attr, text-anchor=start, x=100/250/400/550")}
  ${verticalGuides({ xPositions: WORD_X, yTop: guideTop, yBottom: guideBottom })}
  ${wordTextsAtFixedX({ y: testAY })}

  ${labelText(176, "Test B — same as A but direction=rtl on each <text>")}
  ${verticalGuides({ xPositions: WORD_X, yTop: 212, yBottom: 268 })}
  ${wordTextsAtFixedX({ y: testBY, direction: "rtl" })}

  ${labelText(316, "Test C — single <text> direction=rtl, text-anchor=start, x=400, content: بالـ AI")}
  <line x1="400" y1="348" x2="400" y2="404" stroke="#ff5555" stroke-width="1" stroke-opacity="0.85"/>
  <text x="400" y="418" text-anchor="middle" font-family="Cairo" font-size="10" fill="#ff5555" xml:lang="en">x=400</text>
  <text x="400" y="${testCY}" direction="rtl" text-anchor="start" font-family="Cairo" font-size="${FONT_SIZE}" fill="#ffffff" xml:lang="ar">بالـ AI</text>
</svg>`;
}

/** Render diagnostic PNG; returns raw base64 (no data: prefix). */
export async function runArabicImagePoc(): Promise<string> {
  const svg = buildDiagnosticSvg(getCairoFontBase64());

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

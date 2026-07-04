/**
 * POC — burn Arabic text onto a PNG via @resvg/resvg-wasm (workerd / Cloudflare).
 * ISOLATED: not wired into production flows.
 *
 * Bidi comparison: V1–V3 (resvg attrs/isolates) vs V4 (manual run reorder).
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
const PURE_ARABIC_TEST_STRING = "جرّب مجاناً النهاردة";

const LRI = "\u2066";
const PDI = "\u2069";

const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_DIGIT_RE = /[A-Za-z0-9]/;

type TextRunKind = "arabic" | "latin" | "neutral";

type TextRun = { kind: TextRunKind; text: string };

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap each Latin/digit run in LRI…PDI isolates (approach b — resvg ignores these). */
export function isolateLatinRuns(text: string): string {
  return text.replace(/[A-Za-z0-9]+/g, (run) => `${LRI}${run}${PDI}`);
}

function splitIntoRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (LATIN_DIGIT_RE.test(ch)) {
      let j = i + 1;
      while (j < text.length && LATIN_DIGIT_RE.test(text[j])) j += 1;
      runs.push({ kind: "latin", text: text.slice(i, j) });
      i = j;
    } else if (ARABIC_RE.test(ch)) {
      let j = i + 1;
      while (j < text.length && ARABIC_RE.test(text[j])) j += 1;
      runs.push({ kind: "arabic", text: text.slice(i, j) });
      i = j;
    } else {
      let j = i + 1;
      while (
        j < text.length &&
        !LATIN_DIGIT_RE.test(text[j]) &&
        !ARABIC_RE.test(text[j])
      ) {
        j += 1;
      }
      runs.push({ kind: "neutral", text: text.slice(i, j) });
      i = j;
    }
  }

  return runs;
}

/**
 * Manual visual-order string for resvg (approach c).
 * resvg renders logical storage order LTR with no UBA — reverse run order for mixed lines.
 * Pure Arabic (no Latin/digits) is returned unchanged.
 */
export function reorderForRtl(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const runs = splitIntoRuns(trimmed);
  if (!runs.some((run) => run.kind === "latin")) {
    return text;
  }

  return runs
    .slice()
    .reverse()
    .map((run) => run.text)
    .join("");
}

function rtlHookText(args: {
  y: number;
  text: string;
  fontSize?: number;
  unicodeBidi?: "embed";
}): string {
  const fontSize = args.fontSize ?? 28;
  const bidiAttr = args.unicodeBidi ? ` unicode-bidi="${args.unicodeBidi}"` : "";
  return `<text x="400" y="${args.y}" direction="rtl" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#ffffff" xml:lang="ar"${bidiAttr}>${escapeXml(args.text)}</text>`;
}

function labelText(y: number, label: string, fontSize = 13): string {
  return `<text x="400" y="${y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const isolated = isolateLatinRuns(BIDI_TEST_STRING);
  const reorderedMixed = reorderForRtl(BIDI_TEST_STRING);
  const reorderedPure = reorderForRtl(PURE_ARABIC_TEST_STRING);
  const hookFont = 28;

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

  ${labelText(36, "V1 — baseline (direction=rtl only)")}
  ${rtlHookText({ y: 72, text: BIDI_TEST_STRING, fontSize: hookFont })}

  ${labelText(118, "V2 — LRI/PDI isolates on Latin runs")}
  ${rtlHookText({ y: 154, text: isolated, fontSize: hookFont })}

  ${labelText(200, "V3 — V2 + svg direction=rtl + unicode-bidi=embed")}
  <svg x="0" y="210" width="800" height="70" viewBox="0 0 800 70" direction="rtl">
    ${rtlHookText({ y: 48, text: isolated, fontSize: hookFont, unicodeBidi: "embed" })}
  </svg>

  ${labelText(300, "V4 — manual run reorder (reorderForRtl)")}
  ${rtlHookText({ y: 336, text: reorderedMixed, fontSize: hookFont })}
  ${labelText(378, "V4 — pure Arabic control (should match original)", 11)}
  ${rtlHookText({ y: 408, text: reorderedPure, fontSize: hookFont })}
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

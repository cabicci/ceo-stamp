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

/** Reproduces production bidi bug — Latin "AI" at end of RTL hook. */
const BIDI_TEST_STRING = "زملاؤك سبقوك بالـ AI";
const PURE_ARABIC_TEST_STRING = "جرّب مجاناً النهاردة";
/** Embedded Latin mid-line — harder bidi case. */
const EMBEDDED_LATIN_TEST_STRING = "ابدأ مع masaarat دلوقتي";

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
 * Minimal UAX#9 visual paint string for resvg (approach c).
 *
 * resvg paints the storage string left→right with no bidi. For an RTL paragraph,
 * reverse run order so screen reading (right→left) matches logical order. Each run
 * keeps internal character order (Arabic shaping, Latin upright).
 *
 * Must pair mixed output with `direction="ltr"` on `<text>` — `direction="rtl"` would
 * re-reverse Arabic runs and break word order while Latin stays misplaced.
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

/** SVG `direction` for resvg: pre-reordered mixed hooks paint LTR; pure Arabic stays RTL. */
export function resvgPaintDirection(text: string): "ltr" | "rtl" {
  const trimmed = text.trim();
  if (!trimmed) return "rtl";
  return splitIntoRuns(trimmed).some((run) => run.kind === "latin") ? "ltr" : "rtl";
}

function hookText(args: {
  y: number;
  text: string;
  fontSize?: number;
  direction?: "ltr" | "rtl";
  unicodeBidi?: "embed";
}): string {
  const fontSize = args.fontSize ?? 24;
  const direction = args.direction ?? "rtl";
  const bidiAttr = args.unicodeBidi ? ` unicode-bidi="${args.unicodeBidi}"` : "";
  const lang = "ar";
  return `<text x="400" y="${args.y}" direction="${direction}" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#ffffff" xml:lang="${lang}"${bidiAttr}>${escapeXml(args.text)}</text>`;
}

function labelText(y: number, label: string, fontSize = 12): string {
  return `<text x="400" y="${y}" direction="ltr" text-anchor="middle" font-family="Cairo" font-size="${fontSize}" fill="#888888" xml:lang="en">${escapeXml(label)}</text>`;
}

function v4HookLine(y: number, logicalText: string, fontSize = 24): string {
  const paintText = reorderForRtl(logicalText);
  const direction = resvgPaintDirection(logicalText);
  return hookText({ y, text: paintText, fontSize, direction });
}

function buildArabicPocSvg(cairoBase64: string): string {
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const isolated = isolateLatinRuns(BIDI_TEST_STRING);
  const hookFont = 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960">
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
  <rect width="800" height="960" fill="#1a1a1a"/>

  ${labelText(32, "V1 — baseline (direction=rtl only)")}
  ${hookText({ y: 64, text: BIDI_TEST_STRING, fontSize: hookFont, direction: "rtl" })}

  ${labelText(108, "V2 — LRI/PDI isolates on Latin runs")}
  ${hookText({ y: 140, text: isolated, fontSize: hookFont, direction: "rtl" })}

  ${labelText(184, "V3 — V2 + svg direction=rtl + unicode-bidi=embed")}
  <svg x="0" y="192" width="800" height="56" viewBox="0 0 800 56" direction="rtl">
    ${hookText({ y: 40, text: isolated, fontSize: hookFont, direction: "rtl", unicodeBidi: "embed" })}
  </svg>

  ${labelText(268, "V4 — reorderForRtl + direction=ltr for mixed (fixed)")}
  ${labelText(288, "mixed: زملاؤك سبقوك بالـ AI", 10)}
  ${v4HookLine(316, BIDI_TEST_STRING, hookFont)}

  ${labelText(352, "pure Arabic control (no-op, direction=rtl)", 10)}
  ${v4HookLine(380, PURE_ARABIC_TEST_STRING, hookFont)}

  ${labelText(416, "embedded Latin: ابدأ مع masaarat دلوقتي", 10)}
  ${v4HookLine(444, EMBEDDED_LATIN_TEST_STRING, hookFont)}
</svg>`;
}

/** Render bidi comparison PNG; returns raw base64 (no data: prefix). */
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

/**
 * Burn image_text hook onto an Imagen PNG via resvg + Cairo (server-only).
 */

import { Resvg } from "@resvg/resvg-wasm";
import {
  bytesToBase64,
  cairoResvgFontOptions,
  ensureResvgWasm,
  getCairoFontBase64,
} from "./resvg-cairo.server";

const MAX_LINES = 3;
const LINE_HEIGHT_FACTOR = 1.35;
const HORIZONTAL_PADDING_RATIO = 0.8;
const VERTICAL_MARGIN_RATIO = 0.75;
const CHAR_WIDTH_FACTOR = 0.55;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mimeFromImageBase64(b64: string): "image/png" | "image/jpeg" {
  try {
    const head = atob(b64.slice(0, 24));
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return "image/jpeg";
  } catch {
    // default png
  }
  return "image/png";
}

/** Guard against AI returning a full sentence instead of a short hook. */
function sanitizeHookText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 40) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.slice(0, 6).join(" ");
}

function truncateWithEllipsis(line: string, maxChars: number): string {
  if (line.length <= maxChars) return line;
  if (maxChars <= 1) return "…";
  return `${line.slice(0, maxChars - 1).trimEnd()}…`;
}

function maxCharsPerLine(imageWidth: number, fontSize: number): number {
  const usableWidth = imageWidth * HORIZONTAL_PADDING_RATIO;
  return Math.max(4, Math.floor(usableWidth / (fontSize * CHAR_WIDTH_FACTOR)));
}

/** Word-boundary wrap into at most maxLines rows. */
function wrapTextLines(text: string, maxLines: number, charsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let i = 0;

  while (i < words.length && lines.length < maxLines - 1) {
    let line = "";
    while (i < words.length) {
      const candidate = line ? `${line} ${words[i]}` : words[i];
      if (candidate.length <= charsPerLine || !line) {
        line = candidate;
        i += 1;
      } else {
        break;
      }
    }
    if (line) lines.push(line);
    else break;
  }

  if (i < words.length) {
    lines.push(truncateWithEllipsis(words.slice(i).join(" "), charsPerLine));
  }

  return lines.slice(0, maxLines);
}

function blockHeight(lineCount: number, fontSize: number, lineHeight: number): number {
  if (lineCount <= 0) return 0;
  return (lineCount - 1) * lineHeight + fontSize;
}

function layoutBurnText(
  text: string,
  width: number,
  height: number,
): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  firstBaselineY: number;
  cx: number;
} {
  let fontSize = Math.max(16, Math.round(width / 14));

  const measure = (fs: number) => {
    const lineHeight = fs * LINE_HEIGHT_FACTOR;
    const charsPerLine = maxCharsPerLine(width, fs);
    const lines = wrapTextLines(text, MAX_LINES, charsPerLine);
    const heightUsed = blockHeight(lines.length, fs, lineHeight);
    return { lines, fontSize: fs, lineHeight, heightUsed, charsPerLine };
  };

  let layout = measure(fontSize);
  if (layout.heightUsed > height * VERTICAL_MARGIN_RATIO) {
    const smaller = Math.max(14, Math.round(fontSize * 0.85));
    const retry = measure(smaller);
    if (retry.heightUsed <= layout.heightUsed) {
      layout = retry;
    }
  }

  const firstBaselineY = (height - layout.heightUsed) / 2 + layout.fontSize * 0.85;

  return {
    lines: layout.lines,
    fontSize: layout.fontSize,
    lineHeight: layout.lineHeight,
    firstBaselineY,
    cx: width / 2,
  };
}

function buildBurnSvg(args: {
  imageBase64: string;
  imageMime: "image/png" | "image/jpeg";
  text: string;
  language: "ar" | "en";
  width: number;
  height: number;
  cairoBase64: string;
}): string {
  const { width, height, language, imageBase64, imageMime, cairoBase64 } = args;
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const safeText = sanitizeHookText(args.text);
  const { lines, fontSize, lineHeight, firstBaselineY, cx } = layoutBurnText(
    safeText,
    width,
    height,
  );
  const direction = language === "ar" ? "rtl" : "ltr";
  const langAttr = language === "ar" ? ' xml:lang="ar"' : ' xml:lang="en"';

  const maxLineChars = Math.max(...lines.map((line) => line.length), 1);
  const textBlockWidth = maxLineChars * fontSize * CHAR_WIDTH_FACTOR;
  const textBlockHeight = lines.length * lineHeight;
  const pad = fontSize * 0.5;
  const boxW = textBlockWidth + pad * 2;
  const boxH = textBlockHeight + pad * 2;
  const boxX = cx - boxW / 2;
  const boxY = (height - boxH) / 2;
  const boxRx = fontSize * 0.3;
  const contrastRect = `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${boxRx}" ry="${boxRx}" fill="black" fill-opacity="0.4"/>`;

  const textElements = lines
    .map((line, index) => {
      const y = Math.round(firstBaselineY + index * lineHeight);
      return `<text
    x="${cx}"
    y="${y}"
    direction="${direction}"
    text-anchor="middle"
    font-family="Cairo"
    font-size="${fontSize}"
    fill="#ffffff"
    filter="url(#textShadow)"${langAttr}>${escapeXml(line)}</text>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Cairo';
        src: url('${fontData}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    ]]></style>
  </defs>
  <image href="data:${imageMime};base64,${imageBase64}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${contrastRect}
  ${textElements}
</svg>`;
}

/** Overlay text on an Imagen image; returns burned PNG base64 (no data: prefix). */
export async function burnTextOnImage(args: {
  imageBase64: string;
  text: string;
  language: "ar" | "en";
  width: number;
  height: number;
}): Promise<string> {
  const trimmed = args.text.trim();
  if (!trimmed) {
    throw new Error("burnTextOnImage: text is empty");
  }

  await ensureResvgWasm();

  const imageMime = mimeFromImageBase64(args.imageBase64);
  const svg = buildBurnSvg({
    imageBase64: args.imageBase64,
    imageMime,
    text: trimmed,
    language: args.language,
    width: args.width,
    height: args.height,
    cairoBase64: getCairoFontBase64(),
  });

  const resvg = new Resvg(svg, {
    font: cairoResvgFontOptions(),
    fitTo: { mode: "width", value: args.width },
  });

  try {
    const rendered = resvg.render();
    try {
      return bytesToBase64(rendered.asPng());
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}

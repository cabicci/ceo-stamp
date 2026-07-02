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

function wrapTextLines(text: string, maxLines: number, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  let i = 0;

  while (i < words.length) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
      i += 1;
      continue;
    }
    lines.push(current);
    current = "";
    if (lines.length >= maxLines - 1) {
      lines.push(words.slice(i).join(" "));
      return lines.slice(0, maxLines);
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
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
  const { width, height, language, text, imageBase64, imageMime, cairoBase64 } = args;
  const fontData = `data:font/truetype;base64,${cairoBase64}`;
  const fontSize = Math.max(18, Math.round(width / 12));
  const lineHeight = Math.round(fontSize * 1.25);
  const maxCharsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.5)));
  const lines = wrapTextLines(text, 3, maxCharsPerLine);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round((height - blockHeight) / 2 + lineHeight * 0.85);
  const direction = language === "ar" ? "rtl" : "ltr";
  const langAttr = language === "ar" ? ' xml:lang="ar"' : ' xml:lang="en"';
  const cx = width / 2;

  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${cx}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n    ");

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
  <text
    direction="${direction}"
    text-anchor="middle"
    font-family="Cairo"
    font-size="${fontSize}"
    fill="#ffffff"
    filter="url(#textShadow)"${langAttr}>
    ${tspans}
  </text>
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

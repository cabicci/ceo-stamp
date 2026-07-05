/**
 * bidi-js wrapper — isolated import path to avoid bundler dedupe with @react-pdf/layout.
 * SERVER ONLY.
 */

import createBidiEngine from "bidi-js/dist/bidi.mjs";

const bidiEngine = createBidiEngine();

function rankTokensByVisualOrder(text: string, baseDirection: "rtl" | "ltr") {
  const embeddingLevels = bidiEngine.getEmbeddingLevels(text, baseDirection);
  const indices = bidiEngine.getReorderedIndices(text, embeddingLevels);
  const tokens = text.match(/\S+|\s+/g) ?? [text];

  let logicalPos = 0;
  return tokens.map((token) => {
    const visPositions = Array.from({ length: token.length }, (_, j) =>
      indices.indexOf(logicalPos + j),
    );
    logicalPos += token.length;
    return { token, minVis: Math.min(...visPositions) };
  });
}

/**
 * Words in left-to-right visual paint order (whitespace omitted).
 * Uses UAX#9 reordered indices at token granularity — graphemes stay intact per word.
 */
export function getVisualWordOrder(text: string, baseDirection: "rtl" | "ltr" = "rtl"): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  return rankTokensByVisualOrder(trimmed, baseDirection)
    .filter(({ token }) => !/^\s+$/.test(token))
    .sort((a, b) => a.minVis - b.minVis)
    .map(({ token }) => token);
}

/**
 * @deprecated Single-string paint — resvg re-applies bidi. Prefer per-word SVG layout.
 */
export function computeVisualPaintString(text: string, baseDirection: "rtl" | "ltr" = "rtl"): string {
  return getVisualWordOrder(text, baseDirection).join(" ");
}

/**
 * bidi-js wrapper — isolated import path to avoid bundler dedupe with @react-pdf/layout.
 * SERVER ONLY.
 */

import createBidiEngine from "bidi-js/dist/bidi.mjs";

const bidiEngine = createBidiEngine();

/**
 * UAX#9 visual paint string for resvg (L→R storage, no renderer bidi).
 * Token-level reorder preserves Arabic/Latin grapheme clusters for shaping.
 */
export function computeVisualPaintString(text: string, baseDirection: "rtl" | "ltr" = "rtl"): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const embeddingLevels = bidiEngine.getEmbeddingLevels(trimmed, baseDirection);
  const indices = bidiEngine.getReorderedIndices(trimmed, embeddingLevels);
  const tokens = trimmed.match(/\S+|\s+/g) ?? [trimmed];

  let logicalPos = 0;
  const ranked = tokens.map((token) => {
    const visPositions = Array.from({ length: token.length }, (_, j) =>
      indices.indexOf(logicalPos + j),
    );
    logicalPos += token.length;
    return { token, minVis: Math.min(...visPositions) };
  });

  ranked.sort((a, b) => a.minVis - b.minVis);
  return ranked.map((r) => r.token).join("");
}

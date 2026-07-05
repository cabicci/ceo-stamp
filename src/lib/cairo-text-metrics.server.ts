/**
 * Cairo word width metrics via fontkit — SERVER ONLY.
 * Uses the same embedded Cairo bytes as resvg rendering.
 */

import { create, type Font } from "fontkit";
import { getCairoFontBytes } from "./resvg-cairo.server";

let cairoFont: Font | null = null;

function getCairoFont(): Font {
  if (!cairoFont) {
    cairoFont = create(getCairoFontBytes());
  }
  return cairoFont;
}

/** Sum of glyph xAdvances for `word`, scaled to `fontSize` pixels. */
export function measureWordWidthPx(word: string, fontSize: number): number {
  if (!word) return 0;

  const font = getCairoFont();
  const run = font.layout(word);
  const units = run.positions.reduce((sum, pos) => sum + (pos.xAdvance ?? 0), 0);
  const px = (units * fontSize) / font.unitsPerEm;

  // Never return zero — prevents words stacking at the same x.
  return Math.max(px, fontSize * 0.12);
}

/** Inter-word gap (fontkit widths are tight; small gap is enough). */
export function wordGapPx(fontSize: number): number {
  return Math.max(fontSize * 0.14, 4);
}

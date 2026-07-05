/**
 * Cairo word width metrics via fontkit — SERVER ONLY.
 * fontkit is dynamic-imported on first measure (not at Worker startup).
 */

import { getCairoFontBytes } from "./resvg-cairo.server";

type LayoutRun = {
  positions: Array<{ xAdvance?: number }>;
};

type CairoFontFace = {
  layout: (text: string) => LayoutRun;
  unitsPerEm: number;
};

let cairoFontPromise: Promise<CairoFontFace> | null = null;

function loadCairoFontFace(): Promise<CairoFontFace> {
  if (!cairoFontPromise) {
    cairoFontPromise = (async () => {
      const { create } = await import("fontkit");
      return create(getCairoFontBytes()) as CairoFontFace;
    })();
  }
  return cairoFontPromise;
}

/** Sum of glyph xAdvances for `word`, scaled to `fontSize` pixels. */
export async function measureWordWidthPx(word: string, fontSize: number): Promise<number> {
  if (!word) return 0;

  const font = await loadCairoFontFace();
  const run = font.layout(word);
  const units = run.positions.reduce((sum, pos) => sum + (pos.xAdvance ?? 0), 0);
  const px = (units * fontSize) / font.unitsPerEm;

  return Math.max(px, fontSize * 0.12);
}

/** Inter-word gap (fontkit widths are tight; small gap is enough). */
export function wordGapPx(fontSize: number): number {
  return Math.max(fontSize * 0.14, 4);
}

/** Total horizontal span for a row of words including gaps. */
export async function measureLineWidthPx(words: string[], fontSize: number): Promise<number> {
  if (words.length === 0) return 0;
  const gap = wordGapPx(fontSize);
  const widths = await Promise.all(words.map((word) => measureWordWidthPx(word, fontSize)));
  return widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, words.length - 1);
}

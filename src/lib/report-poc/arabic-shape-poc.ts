/**
 * Arabic pre-shaping for @react-pdf/renderer — POC only.
 * Presentation Forms-B + bidi visual word order for LTR textkit.
 */

import arabicPersianReshaper from "arabic-persian-reshaper";
import { getVisualWordOrder } from "../bidi-visual.server";

const { ArabicShaper } = arabicPersianReshaper as {
  ArabicShaper: { convertArabic: (text: string) => string };
};

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/** Contextual joining → Arabic Presentation Forms (per word). */
function reshapeArabicWord(word: string): string {
  if (!ARABIC_SCRIPT_RE.test(word)) return word;
  return ArabicShaper.convertArabic(word);
}

/**
 * Shape + bidi-order Arabic for react-pdf's LTR text layout.
 * 1) UAX#9 visual word order (reuse bidi-js via getVisualWordOrder)
 * 2) Presentation-form reshaping per Arabic word
 * 3) Join L→R for a renderer that does not shape Arabic itself
 */
export function shapeArabicForPdf(text: string, baseDirection: "rtl" | "ltr" = "rtl"): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const words = getVisualWordOrder(trimmed, baseDirection);
  return words.map(reshapeArabicWord).join(" ");
}

export const PDF_POC_LINES = [
  {
    id: "pure-ar",
    sample: "مرحبا بك في مسارات للذكاء الاصطناعي",
  },
  {
    id: "mixed-ar-latin",
    sample: "زملاؤك سبقوك بالـ AI — جرّب مجاناً",
  },
] as const;

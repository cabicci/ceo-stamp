/**
 * Server-side PDF buffer for Arabic shaping POC.
 */

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { buildArabicPdfPocDocument } from "./render-arabic-pdf-poc";

export async function runArabicPdfPoc(): Promise<Buffer> {
  const doc = buildArabicPdfPocDocument();
  return renderToBuffer(doc as ReactElement<DocumentProps>);
}

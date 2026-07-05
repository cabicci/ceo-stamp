/**
 * POC server function — Arabic PDF shaping test (isolated from production reports).
 */

import { createServerFn } from "@tanstack/react-start";
import { runArabicPdfPoc } from "./arabic-pdf-poc.server";

export const pocArabicPdf = createServerFn({ method: "GET" }).handler(async () => {
  const buffer = await runArabicPdfPoc();
  return {
    pdfBase64: buffer.toString("base64"),
    filename: "arabic-pdf-shaping-poc.pdf",
  };
});

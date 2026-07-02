/**
 * POC server function — isolated Arabic image burn test.
 */

import { createServerFn } from "@tanstack/react-start";
import { runArabicImagePoc } from "./poc-arabic-image.server";

export const pocArabicImage = createServerFn({ method: "GET" }).handler(async () => {
  const pngBase64 = await runArabicImagePoc();
  return { pngBase64 };
});

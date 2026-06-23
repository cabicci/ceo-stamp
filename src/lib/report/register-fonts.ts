import path from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Register Cairo (Arabic + Latin) for server-side PDF rendering. */
export function registerReportFonts() {
  if (registered) return;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const ttf = path.join(dir, "fonts", "Cairo-Regular.ttf");
  Font.register({
    family: "Cairo",
    fonts: [
      { src: ttf, fontWeight: 400 },
      { src: ttf, fontWeight: 600 },
    ],
  });
  // Disable hyphenation — breaks Arabic shaping in @react-pdf/textkit
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

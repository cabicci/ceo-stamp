import path from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Register Cairo (Arabic + Latin) for server-side PDF rendering. */
export function registerReportFonts() {
  if (registered) return;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  Font.register({
    family: "Cairo",
    fonts: [
      { src: path.join(dir, "fonts", "Cairo-Regular.woff2"), fontWeight: 400 },
      { src: path.join(dir, "fonts", "Cairo-SemiBold.woff2"), fontWeight: 600 },
    ],
  });
  registered = true;
}

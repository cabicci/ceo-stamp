import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { pocArabicImage } from "@/lib/poc-arabic-image.functions";

export const Route = createFileRoute("/poc-arabic-image")({
  head: () => ({
    meta: [{ title: "POC — Arabic image (resvg-wasm)" }],
  }),
  component: PocArabicImagePage,
});

function PocArabicImagePage() {
  const runPoc = useServerFn(pocArabicImage);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await runPoc();
        if (!cancelled) {
          setSrc(`data:image/png;base64,${result.pngBase64}`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runPoc]);

  return (
    <main
      className="min-h-screen px-6 py-10"
      style={{ backgroundColor: "#0f0f0f", color: "#f5f5f5" }}
      dir="rtl"
      lang="ar"
    >
      <h1 className="text-xl font-semibold mb-2">POC: per-word layout (fixed)</h1>
      <p className="text-sm mb-6 opacity-70">
        مسار الاختبار: <code dir="ltr">/poc-arabic-image</code>
        {" — "}
        bidi-js visual order + fontkit Cairo widths + separate <code dir="ltr">&lt;text&gt;</code> per word
      </p>

      {loading && <p>جاري التوليد…</p>}

      {error && (
        <pre
          className="text-sm p-4 rounded overflow-auto"
          style={{ backgroundColor: "#2a1010", color: "#ffb4b4" }}
          dir="ltr"
        >
          {error}
        </pre>
      )}

      {src && (
        <div>
          <img
            src={src}
            alt="Arabic POC render"
            width={800}
            height={800}
            className="max-w-full h-auto border border-neutral-700"
          />
          <p className="mt-4 text-sm opacity-70">
            لو العربي ظاهر متصل وصحيح، resvg-wasm شغّال على الـ runtime ده.
          </p>
        </div>
      )}
    </main>
  );
}

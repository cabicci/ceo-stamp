import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { pocArabicPdf } from "@/lib/report-poc/arabic-pdf-poc.functions";

export const Route = createFileRoute("/poc-arabic-pdf")({
  head: () => ({
    meta: [{ title: "POC — Arabic PDF shaping (react-pdf)" }],
  }),
  component: PocArabicPdfPage,
});

function PocArabicPdfPage() {
  const runPoc = useServerFn(pocArabicPdf);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await runPoc();
        if (!cancelled) {
          setDownloadHref(`data:application/pdf;base64,${result.pdfBase64}`);
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
      className="min-h-screen px-6 py-10 max-w-2xl mx-auto"
      style={{ backgroundColor: "#0f0f0f", color: "#f5f5f5" }}
      dir="ltr"
      lang="en"
    >
      <h1 className="text-xl font-semibold mb-2">POC: Arabic pre-shaping for react-pdf</h1>
      <p className="text-sm mb-6 opacity-70">
        Route: <code>/poc-arabic-pdf</code> — presentation forms + bidi visual order, Cairo font,
        selectable text (not an image).
      </p>

      {loading && <p>Generating PDF…</p>}

      {error && (
        <pre
          className="text-sm p-4 rounded overflow-auto"
          style={{ backgroundColor: "#2a1010", color: "#ffb4b4" }}
        >
          {error}
        </pre>
      )}

      {downloadHref && (
        <div className="space-y-4">
          <a
            href={downloadHref}
            download="arabic-pdf-shaping-poc.pdf"
            className="inline-block px-4 py-2 rounded text-sm font-medium"
            style={{ backgroundColor: "#F5D547", color: "#1A1B1F" }}
          >
            Download POC PDF
          </a>
          <p className="text-sm opacity-70">
            Open the PDF and compare lines 1 vs 2 (pure Arabic) and 3 vs 4 (mixed Arabic + Latin).
            SHAPED lines should show connected Arabic letters; RAW lines likely show isolated forms.
          </p>
        </div>
      )}
    </main>
  );
}

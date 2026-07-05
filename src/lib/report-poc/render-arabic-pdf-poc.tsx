/**
 * Isolated A4 PDF — raw vs pre-shaped Arabic lines for react-pdf POC.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { registerReportFonts } from "../report/register-fonts";
import { PDF_POC_LINES, shapeArabicForPdf } from "./arabic-shape-poc";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Cairo",
    fontSize: 11,
    lineHeight: 1.5,
    padding: 48,
    color: "#1A1B1F",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 9,
    color: "#6B6E76",
    marginBottom: 24,
  },
  block: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E6E1",
  },
  label: {
    fontSize: 9,
    fontWeight: 600,
    color: "#6B6E76",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  sample: {
    fontSize: 14,
    lineHeight: 1.6,
  },
});

function SampleBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.sample}>{text}</Text>
    </View>
  );
}

export function buildArabicPdfPocDocument() {
  registerReportFonts();

  return (
    <Document title="Arabic PDF shaping POC" author="Marketing CEO">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Arabic shaping POC — react-pdf + Cairo</Text>
        <Text style={styles.subtitle}>
          Compare RAW (logical Unicode) vs SHAPED (presentation forms + bidi visual order). Text
          remains selectable — not rasterized.
        </Text>

        {PDF_POC_LINES.flatMap((line, index) => {
          const rawN = index * 2 + 1;
          const shapedN = index * 2 + 2;
          return [
            <SampleBlock
              key={`${line.id}-raw`}
              label={`Line ${rawN} — RAW (unshaped)`}
              text={line.sample}
            />,
            <SampleBlock
              key={`${line.id}-shaped`}
              label={`Line ${shapedN} — SHAPED (shapeArabicForPdf)`}
              text={shapeArabicForPdf(line.sample)}
            />,
          ];
        })}
      </Page>
    </Document>
  );
}

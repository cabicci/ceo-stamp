import type { ReactElement } from "react";
import { Document, Page, View } from "@react-pdf/renderer";
import type { ReportBuildContext, ReportSectionModule } from "./types";
import { createReportStyles } from "./styles";
import { ReportHeader } from "./components/report-header";
import { ReportFooter } from "./components/report-footer";
import { AnalysisSectionContent } from "./sections/analysis-section";

/** Marketing analysis — first shipped section. */
export const analysisReportSection: ReportSectionModule = {
  id: "analysis",
  render: (ctx) => <AnalysisSectionContent ctx={ctx} />,
};

/** Default section stack for the marketing strategy report (extend with campaign + posts). */
export const DEFAULT_REPORT_SECTIONS: ReportSectionModule[] = [analysisReportSection];

/**
 * Composes modular sections into one PDF document.
 * Each section renders inside a wrapping page flow with shared header/footer.
 */
export function composeReportDocument(
  ctx: ReportBuildContext,
  sections: ReportSectionModule[] = DEFAULT_REPORT_SECTIONS,
): ReactElement {
  const styles = createReportStyles(ctx);

  return (
    <Document title={ctx.labels.documentTitle} author="Marketing CEO">
      <Page size="A4" wrap style={styles.page}>
        <ReportHeader ctx={ctx} />
        {sections.map((section) => (
          <View key={section.id}>{section.render(ctx)}</View>
        ))}
        <ReportFooter ctx={ctx} />
      </Page>
    </Document>
  );
}

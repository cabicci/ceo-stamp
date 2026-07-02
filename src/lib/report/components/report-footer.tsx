import { Text, View } from "@react-pdf/renderer";
import type { ReportBuildContext } from "../types";
import { createReportStyles } from "../styles";
import { formatReportDate } from "../labels";

export function ReportFooter({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const dateStr = formatReportDate(ctx.generatedAt, ctx.locale);

  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRule} />
      <Text>
        {ctx.labels.generatedOn}: {dateStr}
      </Text>
      <Text>{ctx.documentTitle}</Text>
    </View>
  );
}

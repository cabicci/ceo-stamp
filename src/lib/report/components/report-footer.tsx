import { Text, View } from "@react-pdf/renderer";
import type { ReportBuildContext } from "../types";
import { createReportStyles } from "../styles";
import { formatPageOf, formatReportDate } from "../labels";

export function ReportFooter({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const dateStr = formatReportDate(ctx.generatedAt, ctx.locale);

  return (
    <View style={styles.footer} fixed>
      <Text>
        {ctx.labels.generatedOn}: {dateStr}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          formatPageOf(ctx.labels, pageNumber, totalPages)
        }
      />
    </View>
  );
}

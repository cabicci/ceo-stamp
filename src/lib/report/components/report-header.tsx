import { Text, View } from "@react-pdf/renderer";
import type { ReportBuildContext } from "../types";
import { createReportStyles } from "../styles";

export function ReportHeader({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const { project } = ctx;

  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrandBlock}>
        <View style={styles.headerAccent} />
        <Text style={styles.projectName}>{project.name}</Text>
        {project.websiteUrl ? (
          <Text style={styles.projectUrl}>{project.websiteUrl}</Text>
        ) : null}
      </View>
      <Text style={styles.wordmark}>
        Marketing CEO<Text style={styles.wordmarkDot}> ·</Text>
      </Text>
    </View>
  );
}

import { Text, View } from "@react-pdf/renderer";
import type { ReportBuildContext } from "../types";
import { createReportStyles } from "../styles";

function Field({
  ctx,
  label,
  value,
}: {
  ctx: ReportBuildContext;
  label: string;
  value: string | null | undefined;
}) {
  const styles = createReportStyles(ctx);
  const text = (value ?? "").trim();
  if (!text) return null;
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldBody}>{text}</Text>
    </View>
  );
}

export function CampaignOverviewSectionContent({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const campaign = ctx.campaign;
  if (!campaign) return null;

  const f = ctx.labels.campaignFields;
  const { plan } = campaign;
  const dateRange =
    campaign.startDate && campaign.endDate
      ? f.dateRange
          .replace("{start}", campaign.startDate)
          .replace("{end}", campaign.endDate)
      : campaign.startDate ?? campaign.endDate ?? "";

  return (
    <View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{ctx.labels.sections.campaign}</Text>
        <View style={styles.sectionTitleRule} />
      </View>

      <Field ctx={ctx} label={f.packageName} value={plan.packageName} />
      <Field ctx={ctx} label={f.description} value={plan.description} />
      <Field ctx={ctx} label={f.objective} value={plan.objectiveLabel} />
      <Field ctx={ctx} label={f.channels} value={plan.channelsLabel} />
      {dateRange ? <Field ctx={ctx} label={f.startDate} value={dateRange} /> : null}
      <Field ctx={ctx} label={f.funnelFocus} value={plan.funnelFocus} />
      <Field ctx={ctx} label={f.frameworks} value={plan.frameworksLabel} />
      <Field
        ctx={ctx}
        label={f.totalPosts}
        value={String(plan.totalPosts)}
      />
      <Field ctx={ctx} label={f.adaptationNote} value={plan.adaptationNote} />
    </View>
  );
}

import { Text, View } from "@react-pdf/renderer";
import type { ReportBuildContext } from "../types";
import { createReportStyles } from "../styles";

function TextField({
  ctx,
  label,
  value,
}: {
  ctx: ReportBuildContext;
  label: string;
  value: string;
}) {
  const styles = createReportStyles(ctx);
  if (!value.trim()) return null;
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldBody}>{value}</Text>
    </View>
  );
}

function BulletList({
  ctx,
  label,
  items,
}: {
  ctx: ReportBuildContext;
  label: string;
  items: string[];
}) {
  const styles = createReportStyles(ctx);
  const filtered = items.map((s) => s.trim()).filter(Boolean);
  if (filtered.length === 0) return null;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.bulletList}>
        {filtered.map((item, i) => (
          <View key={i} style={styles.bulletItem}>
            <Text style={styles.bulletGlyph}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AnalysisSectionContent({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const { analysis, labels } = ctx;
  if (!analysis) return null;

  return (
    <View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{labels.sections.analysis}</Text>
        <View style={styles.sectionTitleRule} />
      </View>

      <TextField ctx={ctx} label={labels.fields.businessModel} value={analysis.business_model} />
      <TextField ctx={ctx} label={labels.fields.targetAudience} value={analysis.target_audience} />
      <TextField ctx={ctx} label={labels.fields.toneOfVoice} value={analysis.tone_of_voice} />

      <BulletList ctx={ctx} label={labels.fields.usps} items={analysis.usps} />
      <BulletList ctx={ctx} label={labels.fields.painPoints} items={analysis.pain_points} />

      {analysis.personas.length > 0 && (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{labels.fields.personas}</Text>
          {analysis.personas.map((persona, i) => (
            <View key={i} style={styles.personaCard}>
              <Text style={styles.personaName}>{persona.name || "—"}</Text>
              {persona.pain_points.length > 0 && (
                <>
                  <Text style={styles.subLabel}>{labels.fields.personaPainPoints}</Text>
                  <View style={styles.bulletList}>
                    {persona.pain_points.map((p, j) => (
                      <View key={j} style={styles.bulletItem}>
                        <Text style={styles.bulletGlyph}>•</Text>
                        <Text style={styles.bulletText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {persona.objections.length > 0 && (
                <>
                  <Text style={styles.subLabel}>{labels.fields.personaObjections}</Text>
                  <View style={styles.bulletList}>
                    {persona.objections.map((o, j) => (
                      <View key={j} style={styles.bulletItem}>
                        <Text style={styles.bulletGlyph}>•</Text>
                        <Text style={styles.bulletText}>{o}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <BulletList
        ctx={ctx}
        label={labels.fields.contentOpportunities}
        items={analysis.content_opportunities}
      />
      <BulletList ctx={ctx} label={labels.fields.marketingAngles} items={analysis.marketing_angles} />
      <BulletList ctx={ctx} label={labels.fields.contentPillars} items={analysis.content_pillars} />
    </View>
  );
}

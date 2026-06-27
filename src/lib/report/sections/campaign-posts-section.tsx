import { Image, Text, View } from "@react-pdf/renderer";
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

export function CampaignPostsSectionContent({ ctx }: { ctx: ReportBuildContext }) {
  const styles = createReportStyles(ctx);
  const campaign = ctx.campaign;
  if (!campaign) return null;

  const f = ctx.labels.campaignFields;
  const { posts, ads } = campaign;

  return (
    <View>
      <Text style={styles.sectionTitle}>{ctx.labels.sections.posts}</Text>

      {posts.length === 0 ? (
        <Text style={styles.emptyNote}>{f.noPosts}</Text>
      ) : (
        posts.map((post, i) => {
          const meta = [
            `${f.platform}: ${post.platformLabel}`,
            post.scheduledDate ? `${f.scheduledDate}: ${post.scheduledDate}` : null,
            post.locale ? `${f.locale}: ${post.locale}` : null,
            post.contentType ? `${f.contentType}: ${post.contentType}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <View key={`post-${i}`} style={styles.postCard} wrap={false}>
              <Text style={styles.postMeta}>{meta}</Text>
              <Field ctx={ctx} label={f.copy} value={post.copy} />
              <Field ctx={ctx} label={f.frameworkApplied} value={post.frameworkApplied} />
              <Field ctx={ctx} label={f.rationale} value={post.rationale} />
              {post.imageDataUri ? (
                <Image src={post.imageDataUri} style={styles.postImage} />
              ) : null}
            </View>
          );
        })
      )}

      {ads.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>{ctx.labels.sections.ads}</Text>
          {ads.map((ad, i) => {
            const meta = [
              `${f.platform}: ${ad.platformLabel}`,
              ad.variantLabel ? `${f.variant}: ${ad.variantLabel}` : null,
              ad.locale ? `${f.locale}: ${ad.locale}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <View key={`ad-${i}`} style={styles.adCard} wrap={false}>
                <Text style={styles.postMeta}>{meta}</Text>
                <Field ctx={ctx} label={f.headline} value={ad.headline} />
                <Field ctx={ctx} label={f.body} value={ad.body} />
                <Field ctx={ctx} label={f.cta} value={ad.cta} />
                <Field ctx={ctx} label={f.frameworkApplied} value={ad.frameworkApplied} />
                <Field ctx={ctx} label={f.rationale} value={ad.rationale} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

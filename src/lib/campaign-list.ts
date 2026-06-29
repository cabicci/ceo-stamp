import type { Channel } from "@/lib/campaign-packages";
import { CHANNEL_LABEL, localizedPackageName } from "@/lib/campaign-packages";

export type CampaignPlanSummary = {
  package_id?: string;
  package_name_ar?: string;
};

export type CampaignListRow = {
  id: string;
  project_id: string;
  objective: string;
  channels: unknown;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  archived: boolean;
  campaign_plan: unknown;
  cloned_from_id: string | null;
  post_count: number;
  project_name?: string;
};

export function parseChannels(channels: unknown): Channel[] {
  if (!Array.isArray(channels)) return [];
  return channels.filter((c): c is Channel => typeof c === "string");
}

export function formatChannelsList(channels: unknown): string {
  return parseChannels(channels)
    .map((c) => CHANNEL_LABEL[c] ?? c)
    .join(" · ");
}

export function resolveCampaignTitle(
  t: (key: string) => string,
  row: Pick<CampaignListRow, "objective" | "campaign_plan">,
): string {
  const plan = row.campaign_plan as CampaignPlanSummary | null;
  if (plan?.package_id) {
    return localizedPackageName(
      plan.package_id,
      plan.package_name_ar ?? t("campaignPage.defaultName"),
      t,
    );
  }
  if (plan?.package_name_ar) return plan.package_name_ar;
  const objectiveKey = `report.objectives.${row.objective}`;
  const label = t(objectiveKey);
  return label !== objectiveKey ? label : t("campaignPage.defaultName");
}

export function formatDateRange(
  start: string | null,
  end: string | null,
  emptyLabel: string,
): string {
  if (!start && !end) return emptyLabel;
  if (start && end) return `${start} — ${end}`;
  return start ?? end ?? emptyLabel;
}

export function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

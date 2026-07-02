import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CampaignList } from "@/components/CampaignList";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({
    meta: [{ title: "Marketing CEO — Campaigns" }],
  }),
  component: CampaignsIndexPage,
});

function CampaignsIndexPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <CampaignList />
      <p className="mt-8 text-sm" style={{ color: "var(--muted-text)" }}>
        {t("campaignList.footerHint")}
      </p>
    </AppShell>
  );
}

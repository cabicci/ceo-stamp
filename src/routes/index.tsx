import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusStamp } from "@/components/StatusStamp";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketing CEO — Dashboard" },
      { name: "description", content: "Internal marketing command center." },
    ],
  }),
  component: Dashboard,
});

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-paper"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        padding: "2rem",
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.2em] mb-6"
        style={{ color: "var(--brass)" }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function StatusRow({
  code,
  label,
  swatch,
}: {
  code: string;
  label: string;
  swatch: string;
}) {
  return (
    <div
      className="flex items-center gap-4 py-3"
      style={{ borderBottom: "1px solid var(--hairline)" }}
    >
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ backgroundColor: swatch }}
      />
      <span
        className="font-mono text-xs uppercase tracking-[0.16em] w-24"
        style={{ color: "var(--ink-text)" }}
      >
        {code}
      </span>
      <span className="text-sm" style={{ color: "var(--ink-text)" }}>
        {label}
      </span>
    </div>
  );
}

function Dashboard() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <header className="mb-12">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
          style={{ color: "var(--brass)" }}
        >
          {t("dashboard.eyebrow")}
        </div>
        <h1
          className="font-display text-[44px] leading-[1.05]"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
        >
          {t("dashboard.title")}
        </h1>
        <p
          className="mt-4 max-w-2xl text-sm leading-relaxed"
          style={{ color: "var(--ink-text)" }}
          dangerouslySetInnerHTML={{ __html: t("dashboard.intro") }}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card label={t("dashboard.cards.stampEn")}>
          <div className="flex items-center justify-center py-10" dir="ltr" lang="en">
            <StatusStamp language="en" />
          </div>
        </Card>

        <Card label={t("dashboard.cards.stampAr")}>
          <div
            className="flex items-center justify-center py-10"
            dir="rtl"
            lang="ar"
          >
            <StatusStamp language="ar" />
          </div>
        </Card>

        <Card label={t("dashboard.cards.vocab")}>
          <StatusRow
            code={t("dashboard.statusCode.draft")}
            label={t("dashboard.status.draft")}
            swatch="var(--brass)"
          />
          <StatusRow
            code={t("dashboard.statusCode.inReview")}
            label={t("dashboard.status.inReview")}
            swatch="var(--steel)"
          />
          <StatusRow
            code={t("dashboard.statusCode.approved")}
            label={t("dashboard.status.approved")}
            swatch="var(--stamp)"
          />
        </Card>

        <Card label={t("dashboard.cards.palette")}>
          <div className="grid grid-cols-4 gap-3" dir="ltr">
            {[
              ["INK", "#1B2027"],
              ["PAPER", "#EAEBE6"],
              ["TEXT", "#232A33"],
              ["STAMP", "#B23A2E"],
              ["STEEL", "#4C6B8A"],
              ["BRASS", "#8A7B4E"],
              ["HAIRLINE", "#C9CBC3"],
            ].map(([name, hex]) => (
              <div key={name}>
                <div
                  className="h-12 w-full"
                  style={{
                    backgroundColor: hex,
                    border: "1px solid var(--hairline)",
                    borderRadius: "2px",
                  }}
                />
                <div
                  className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--ink-text)" }}
                >
                  {name}
                </div>
                <div
                  className="font-mono text-[9px]"
                  style={{ color: "var(--brass)" }}
                >
                  {hex}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

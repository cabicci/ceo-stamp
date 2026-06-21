import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [{ title: "Marketing CEO — Project" }],
  }),
  component: ProjectDetail,
  notFoundComponent: () => (
    <AppShell>
      <p style={{ color: "var(--ink-text)" }}>Not found</p>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p style={{ color: "var(--danger)" }}>{error.message}</p>
    </AppShell>
  ),
});

type Project = {
  id: string;
  name: string;
  website_url: string;
  created_at: string;
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase
      .from("projects")
      .select("id, name, website_url, created_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProject((data as Project | null) ?? null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (project === undefined) {
    return (
      <AppShell>
        <div
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--brass)" }}
        >
          {t("projects.loading")}
        </div>
      </AppShell>
    );
  }

  if (project === null) {
    throw notFound();
  }

  return (
    <AppShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] mb-8"
        style={{ color: "var(--brass)" }}
      >
        <ArrowLeft size={12} strokeWidth={1.75} className="rtl:rotate-180" />
        {t("projects.backToList")}
      </Link>

      <header
        className="pb-10 mb-10"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
          style={{ color: "var(--brass)" }}
        >
          {t("projects.detailEyebrow")}
        </div>
        <h1
          className="font-display text-[44px] leading-[1.05]"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
        >
          {project.name}
        </h1>
        <a
          href={project.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 font-mono text-sm break-all"
          style={{ color: "var(--steel)" }}
          dir="ltr"
        >
          {project.website_url}
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      </header>

      <div
        className="font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: "var(--brass)" }}
      >
        {t("projects.detailPlaceholder")}
      </div>
    </AppShell>
  );
}

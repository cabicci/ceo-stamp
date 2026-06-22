import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProjectTrackerPanel } from "@/components/admin/ProjectTrackerPanel";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Marketing CEO — Admin" }],
  }),
  beforeLoad: async () => {
    // UI-side gate (convenience only — the real gate is RLS on every query below).
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  project_count: number;
  created_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  website_url: string;
  created_at: string;
  owner_email: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AdminPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [totals, setTotals] = useState({ users: 0, projects: 0, campaigns: 0, content: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      // ALL of these queries are RLS-gated. A non-admin gets empty arrays.
      const [profilesRes, rolesRes, projectsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("projects")
          .select("id, name, website_url, created_at, owner_id")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error || rolesRes.error || projectsRes.error) {
        setError(
          profilesRes.error?.message ??
            rolesRes.error?.message ??
            projectsRes.error?.message ??
            "Error",
        );
        setLoading(false);
        return;
      }

      const profiles = profilesRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const projs = projectsRes.data ?? [];

      const roleMap = new Map<string, "admin" | "user">();
      for (const r of roles) {
        if (r.role === "admin") roleMap.set(r.user_id, "admin");
      }
      const projectCounts = new Map<string, number>();
      for (const p of projs) {
        projectCounts.set(p.owner_id, (projectCounts.get(p.owner_id) ?? 0) + 1);
      }
      const emailMap = new Map<string, string>();
      for (const pr of profiles) emailMap.set(pr.id, pr.email);

      const userRows: UserRow[] = profiles
        .map((p) => ({
          id: p.id,
          email: p.email,
          role: (roleMap.get(p.id) ?? "user") as "admin" | "user",
          project_count: projectCounts.get(p.id) ?? 0,
          created_at: p.created_at,
        }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      const projectRows: ProjectRow[] = projs.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        website_url: p.website_url,
        created_at: p.created_at,
        owner_email: emailMap.get(p.owner_id) ?? "—",
      }));

      setUsers(userRows);
      setProjects(projectRows);
      setTotals({
        users: profiles.length,
        projects: projs.length,
        campaigns: 0,
        content: 0,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <div className="space-y-10">
        <header>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--muted-text)" }}
          >
            {t("admin.eyebrow")}
          </div>
          <h1
            className="font-display text-[32px] leading-none"
            style={{ color: "var(--ink-text)", fontWeight: 500 }}
          >
            {t("admin.title")}
          </h1>
        </header>

        {error && (
          <div
            className="p-4 rounded-[3px] text-sm"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--danger)",
              border: "1px solid var(--hairline)",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: "var(--muted-text)" }}>{t("projects.loading")}</div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={t("admin.totals.users")} value={totals.users} />
              <StatCard label={t("admin.totals.projects")} value={totals.projects} />
              <StatCard label={t("admin.totals.campaigns")} value={totals.campaigns} />
              <StatCard label={t("admin.totals.content")} value={totals.content} />
            </section>

            <ProjectTrackerPanel />

            <section>
              <SectionTitle>{t("admin.users.title")}</SectionTitle>
              <LedgerTable
                headers={[
                  t("admin.users.email"),
                  t("admin.users.role"),
                  t("admin.users.projects"),
                  t("admin.users.signupDate"),
                ]}
                rows={users.map((u) => [
                  u.email,
                  <span
                    key="r"
                    className="font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: u.role === "admin" ? "var(--accent-strong)" : "var(--muted-text)" }}
                  >
                    {u.role}
                  </span>,
                  <span key="c" className="font-mono" dir="ltr">{u.project_count}</span>,
                  <span key="d" className="font-mono" dir="ltr">{formatDate(u.created_at)}</span>,
                ])}
                empty={t("admin.users.empty")}
              />
            </section>

            <section>
              <SectionTitle>{t("admin.projects.title")}</SectionTitle>
              <LedgerTable
                headers={[
                  t("admin.projects.name"),
                  t("admin.projects.owner"),
                  t("admin.projects.website"),
                  t("admin.projects.created"),
                ]}
                rows={projects.map((p) => [
                  p.name,
                  p.owner_email,
                  <a
                    key="w"
                    href={p.website_url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="underline underline-offset-2"
                    style={{ color: "var(--ink-text)" }}
                  >
                    {p.website_url}
                  </a>,
                  <span key="d" className="font-mono" dir="ltr">{formatDate(p.created_at)}</span>,
                ])}
                empty={t("admin.projects.empty")}
              />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="p-5 rounded-[3px]"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--hairline)",
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2"
        style={{ color: "var(--muted-text)" }}
      >
        {label}
      </div>
      <div
        className="font-mono text-[28px]"
        dir="ltr"
        style={{ color: "var(--ink-text)", fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display text-[18px] mb-4"
      style={{ color: "var(--ink-text)", fontWeight: 500 }}
    >
      {children}
    </h2>
  );
}

function LedgerTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div
      className="rounded-[3px] overflow-hidden"
      style={{ border: "1px solid var(--hairline)", backgroundColor: "var(--paper)" }}
    >
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: "var(--surface)" }}>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-start px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ color: "var(--muted-text)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-6 text-center"
                style={{ color: "var(--muted-text)" }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--hairline)" }}>
                {cells.map((c, j) => (
                  <td key={j} className="px-4 py-3" style={{ color: "var(--ink-text)" }}>
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

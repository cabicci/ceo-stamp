import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, ArrowSquareOut } from "@phosphor-icons/react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Marketing CEO — Projects" },
      { name: "description", content: "Projects ledger." },
    ],
  }),
  component: ProjectsPage,
});

type Project = {
  id: string;
  name: string;
  website_url: string;
  created_at: string;
};

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  website_url: z
    .string()
    .trim()
    .url()
    .max(2048),
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoadError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, website_url, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setProjects([]);
      return;
    }
    setProjects(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: "var(--brass)" }}
          >
            {t("projects.eyebrow")}
          </div>
          <h1
            className="font-display text-[40px] leading-[1.05]"
            style={{ color: "var(--ink-text)", fontWeight: 500 }}
          >
            {t("projects.title")}
          </h1>
        </div>
        {projects && projects.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm"
            style={{
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              borderRadius: "3px",
            }}
          >
            <Plus size={14} strokeWidth={1.75} />
            {t("projects.add")}
          </button>
        ) : null}
      </header>

      {showForm ? (
        <ProjectForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      ) : null}

      {loadError ? (
        <div
          className="text-sm py-2 px-3 mb-6"
          style={{
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "3px",
          }}
        >
          {loadError}
        </div>
      ) : null}

      {projects === null ? (
        <div
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--brass)" }}
        >
          {t("projects.loading")}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to="/projects/$id"
                params={{ id: p.id }}
                className="block p-6 transition-colors hover:bg-[var(--hairline)]/30"
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: "4px",
                  backgroundColor: "var(--paper)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="text-lg leading-snug"
                    style={{ color: "var(--ink-text)", fontWeight: 500 }}
                  >
                    {p.name}
                  </h2>
                  <ArrowSquareOut
                    size={14}
                    strokeWidth={1.5}
                    style={{ color: "var(--brass)", flexShrink: 0, marginTop: 4 }}
                  />
                </div>
                <div
                  className="mt-2 font-mono text-xs break-all"
                  style={{ color: "var(--steel)" }}
                  dir="ltr"
                >
                  {p.website_url}
                </div>
                <div
                  className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--brass)" }}
                  dir="ltr"
                >
                  {formatDate(p.created_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="text-center py-20 px-6"
      style={{
        border: "1px dashed var(--hairline)",
        borderRadius: "4px",
      }}
    >
      <p
        className="text-lg max-w-md mx-auto leading-relaxed"
        style={{ color: "var(--ink-text)" }}
      >
        {t("projects.empty")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        style={{
          backgroundColor: "var(--ink)",
          color: "var(--paper)",
          borderRadius: "3px",
        }}
      >
        <Plus size={14} strokeWidth={1.75} />
        {t("projects.add")}
      </button>
    </div>
  );
}

function ProjectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = projectSchema.safeParse({ name, website_url: url });
    if (!parsed.success) {
      setError(t("projects.form.urlError"));
      return;
    }

    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not authenticated");
      const { error: insertErr } = await supabase.from("projects").insert({
        name: parsed.data.name,
        website_url: parsed.data.website_url,
        owner_id: userData.user.id,
      });
      if (insertErr) throw insertErr;
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 p-6"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--brass)" }}
        >
          {t("projects.form.title")}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("projects.form.cancel")}
          style={{ color: "var(--brass)" }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span
            className="block font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--brass)" }}
          >
            {t("projects.form.name")}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full px-3 py-2.5 text-sm bg-transparent outline-none"
            style={{
              color: "var(--ink-text)",
              border: "1px solid var(--hairline)",
              borderRadius: "3px",
            }}
          />
        </label>

        <label className="block">
          <span
            className="block font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--brass)" }}
          >
            {t("projects.form.url")}
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            dir="ltr"
            placeholder="https://example.com"
            className="w-full px-3 py-2.5 text-sm bg-transparent outline-none"
            style={{
              color: "var(--ink-text)",
              border: "1px solid var(--hairline)",
              borderRadius: "3px",
              fontFamily: "var(--font-mono)",
              textAlign: "left",
            }}
          />
        </label>

        {error ? (
          <div
            className="text-sm py-2 px-3"
            style={{
              color: "var(--danger)",
              border: "1px solid var(--danger)",
              borderRadius: "3px",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm disabled:opacity-50"
            style={{
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              borderRadius: "3px",
            }}
          >
            {saving ? t("projects.form.saving") : t("projects.form.save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm"
            style={{
              color: "var(--ink-text)",
              border: "1px solid var(--hairline)",
              borderRadius: "3px",
            }}
          >
            {t("projects.form.cancel")}
          </button>
        </div>
      </div>
    </form>
  );
}

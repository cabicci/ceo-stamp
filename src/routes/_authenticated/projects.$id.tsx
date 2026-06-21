import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Plus, Trash2, Sparkles, RotateCcw, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";
import { useServerFn } from "@tanstack/react-start";
import { analyzeWebsite, saveAnalysisEdits } from "@/lib/analyze-website.functions";

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

type Project = { id: string; name: string; website_url: string; created_at: string };

type Persona = { name: string; pain_points: string[]; objections: string[] };
type Analysis = {
  business_model: string;
  target_audience: string;
  tone_of_voice: string;
  usps: string[];
  pain_points: string[];
  personas: Persona[];
  content_gaps: string[];
  content_pillars: string[];
};

type AnalysisRow = {
  id: string;
  status: string;
  ai_analysis: Partial<Analysis> | null;
  error_message: string | null;
  analyzed_at: string;
};

const EMPTY_ANALYSIS: Analysis = {
  business_model: "",
  target_audience: "",
  tone_of_voice: "",
  usps: [],
  pain_points: [],
  personas: [],
  content_gaps: [],
  content_pillars: [],
};

function normalize(raw: Partial<Analysis> | null | undefined): Analysis {
  if (!raw) return EMPTY_ANALYSIS;
  return {
    business_model: raw.business_model ?? "",
    target_audience: raw.target_audience ?? "",
    tone_of_voice: raw.tone_of_voice ?? "",
    usps: Array.isArray(raw.usps) ? raw.usps : [],
    pain_points: Array.isArray(raw.pain_points) ? raw.pain_points : [],
    personas: Array.isArray(raw.personas)
      ? raw.personas.map((p) => ({
          name: p?.name ?? "",
          pain_points: Array.isArray(p?.pain_points) ? p.pain_points : [],
          objections: Array.isArray(p?.objections) ? p.objections : [],
        }))
      : [],
    content_gaps: Array.isArray(raw.content_gaps) ? raw.content_gaps : [],
    content_pillars: Array.isArray(raw.content_pillars) ? raw.content_pillars : [],
  };
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [latest, setLatest] = useState<AnalysisRow | null>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<number | null>(null);

  const analyzeFn = useServerFn(analyzeWebsite);

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, website_url, created_at")
      .eq("id", id)
      .maybeSingle();
    setProject((data as Project | null) ?? null);
  }

  async function loadLatestAnalysis() {
    const { data } = await supabase
      .from("website_analysis")
      .select("id, status, ai_analysis, error_message, analyzed_at")
      .eq("project_id", id)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as AnalysisRow | null) ?? null);
    return (data as AnalysisRow | null) ?? null;
  }

  useEffect(() => {
    loadProject();
    loadLatestAnalysis();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [id]);

  function startPolling() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const row = await loadLatestAnalysis();
      if (row && (row.status === "done" || row.status === "error")) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
      }
    }, 2000);
  }

  async function handleAnalyze() {
    setRunning(true);
    startPolling();
    try {
      await analyzeFn({ data: { projectId: id } });
    } catch {
      /* error surfaces via the polled row */
    } finally {
      await loadLatestAnalysis();
      setRunning(false);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }

  if (project === undefined) {
    return (
      <AppShell>
        <div
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--muted-text)" }}
        >
          {t("projects.loading")}
        </div>
      </AppShell>
    );
  }
  if (project === null) throw notFound();

  const status = latest?.status ?? "idle";
  const isWorking = running || status === "scraping" || status === "analyzing";

  return (
    <AppShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] mb-8"
        style={{ color: "var(--muted-text)" }}
      >
        <ArrowLeft size={12} strokeWidth={1.75} className="rtl:rotate-180" />
        {t("projects.backToList")}
      </Link>

      <header className="pb-8 mb-8" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
          style={{ color: "var(--muted-text)" }}
        >
          {t("projects.detailEyebrow")}
        </div>
        <h1
          className="font-display text-[40px] leading-[1.05]"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
        >
          {project.name}
        </h1>
        <a
          href={project.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 font-mono text-sm break-all"
          style={{ color: "var(--review)" }}
          dir="ltr"
        >
          {project.website_url}
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      </header>

      <section className="mb-8">
        <SectionLabel>ذكاء الموقع</SectionLabel>

        {status === "idle" && (
          <IdleCard onAnalyze={handleAnalyze} disabled={isWorking} />
        )}

        {isWorking && <RunningCard status={status} />}

        {status === "error" && !isWorking && (
          <ErrorCard
            message={latest?.error_message ?? "حصل خطأ غير معروف."}
            onRetry={handleAnalyze}
          />
        )}

        {status === "done" && !isWorking && latest && (
          <AnalysisEditor
            projectId={project.id}
            analysisId={latest.id}
            initial={normalize(latest.ai_analysis)}
            onReanalyze={handleAnalyze}
          />
        )}
      </section>
    </AppShell>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-[0.22em] mb-4"
      style={{ color: "var(--muted-text)" }}
    >
      {children}
    </div>
  );
}

function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className="p-6"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: accent ? "var(--surface)" : "var(--paper)",
      }}
    >
      {children}
    </div>
  );
}

function IdleCard({ onAnalyze, disabled }: { onAnalyze: () => void; disabled: boolean }) {
  return (
    <Card accent>
      <p className="text-base mb-5" style={{ color: "var(--ink-text)" }}>
        لسه ما تم تحليل الموقع. شغّل التحليل عشان الـ AI يقرأ الصفحات ويستخرج
        نموذج العمل والجمهور ونبرة الصوت ونقاط القوة.
      </p>
      <button
        type="button"
        onClick={onAnalyze}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        style={{
          backgroundColor: "var(--accent-strong)",
          color: "#FFFFFF",
          borderRadius: "3px",
        }}
      >
        <Sparkles size={14} strokeWidth={1.75} />
        حلّل الموقع
      </button>
    </Card>
  );
}

function RunningCard({ status }: { status: string }) {
  const label =
    status === "analyzing"
      ? "بيتم تحليل المحتوى…"
      : status === "scraping"
        ? "بيتم سحب صفحات الموقع…"
        : "جارٍ بدء التحليل…";
  return (
    <Card accent>
      <div className="flex items-center gap-3">
        <div
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--accent-strong)" }}
        />
        <div style={{ color: "var(--ink-text)" }}>{label}</div>
      </div>
      <div
        className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--muted-text)" }}
      >
        ممكن ياخد دقيقة. سيب الصفحة مفتوحة.
      </div>
    </Card>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="p-6"
      style={{
        border: "1px solid var(--danger)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
        style={{ color: "var(--danger)" }}
      >
        فشل التحليل
      </div>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ink-text)" }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        style={{
          backgroundColor: "var(--accent-strong)",
          color: "#FFFFFF",
          borderRadius: "3px",
        }}
      >
        <RotateCcw size={14} strokeWidth={1.75} />
        حاول تاني
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Editable analysis form
// -----------------------------------------------------------------------------

function AnalysisEditor({
  projectId,
  analysisId,
  initial,
  onReanalyze,
}: {
  projectId: string;
  analysisId: string;
  initial: Analysis;
  onReanalyze: () => void;
}) {
  const [a, setA] = useState<Analysis>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset when a new analysis arrives
  const initialKey = useMemo(() => analysisId, [analysisId]);
  useEffect(() => {
    setA(initial);
    setSavedAt(null);
  }, [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveFn = useServerFn(saveAnalysisEdits);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveFn({ data: { projectId, analysisId, analysis: a } });
      setSavedAt(new Date().toLocaleTimeString("en-GB"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <FieldLabel>نموذج العمل</FieldLabel>
        <Textarea
          value={a.business_model}
          onChange={(v) => setA({ ...a, business_model: v })}
        />
      </Card>

      <Card>
        <FieldLabel>الجمهور المستهدف</FieldLabel>
        <Textarea
          value={a.target_audience}
          onChange={(v) => setA({ ...a, target_audience: v })}
        />
      </Card>

      <Card>
        <FieldLabel>نبرة الصوت</FieldLabel>
        <Textarea
          value={a.tone_of_voice}
          onChange={(v) => setA({ ...a, tone_of_voice: v })}
        />
      </Card>

      <Card>
        <FieldLabel>نقاط القوة</FieldLabel>
        <StringList items={a.usps} onChange={(usps) => setA({ ...a, usps })} placeholder="نقطة قوة" />
      </Card>

      <Card>
        <FieldLabel>نقاط الألم</FieldLabel>
        <StringList
          items={a.pain_points}
          onChange={(pain_points) => setA({ ...a, pain_points })}
          placeholder="نقطة ألم"
        />
      </Card>

      <Card>
        <FieldLabel>الشخصيات</FieldLabel>
        <PersonasEditor
          personas={a.personas}
          onChange={(personas) => setA({ ...a, personas })}
        />
      </Card>

      <Card>
        <FieldLabel>فجوات المحتوى</FieldLabel>
        <StringList
          items={a.content_gaps}
          onChange={(content_gaps) => setA({ ...a, content_gaps })}
          placeholder="فجوة محتوى"
        />
      </Card>

      <Card>
        <FieldLabel>أعمدة المحتوى</FieldLabel>
        <StringList
          items={a.content_pillars}
          onChange={(content_pillars) => setA({ ...a, content_pillars })}
          placeholder="عمود محتوى"
        />
      </Card>

      {error && (
        <div
          className="text-sm py-2 px-3"
          style={{ color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: "3px" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent-strong)",
            color: "#FFFFFF",
            borderRadius: "3px",
          }}
        >
          <Save size={14} strokeWidth={1.75} />
          {saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}
        </button>
        <button
          type="button"
          onClick={onReanalyze}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm"
          style={{
            border: "1px solid var(--hairline)",
            color: "var(--ink-text)",
            borderRadius: "3px",
          }}
        >
          <RotateCcw size={14} strokeWidth={1.75} />
          إعادة تحليل
        </button>
        {savedAt && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted-text)" }}
          >
            اتحفظ · {savedAt}
          </span>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-[0.2em] mb-3"
      style={{ color: "var(--muted-text)" }}
    >
      {children}
    </div>
  );
}

function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full px-3 py-2.5 text-sm bg-transparent outline-none resize-y leading-relaxed"
      style={{
        color: "var(--ink-text)",
        border: "1px solid var(--hairline)",
        borderRadius: "3px",
      }}
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm bg-transparent outline-none"
      style={{
        color: "var(--ink-text)",
        border: "1px solid var(--hairline)",
        borderRadius: "3px",
      }}
    />
  );
}

function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput
            value={it}
            onChange={(v) => onChange(items.map((x, idx) => (idx === i ? v : x)))}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="حذف"
            className="p-2"
            style={{ color: "var(--muted-text)" }}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5"
        style={{
          color: "var(--ink-text)",
          border: "1px dashed var(--hairline)",
          borderRadius: "3px",
        }}
      >
        <Plus size={12} strokeWidth={1.75} />
        إضافة
      </button>
    </div>
  );
}

function PersonasEditor({
  personas,
  onChange,
}: {
  personas: Persona[];
  onChange: (next: Persona[]) => void;
}) {
  return (
    <div className="space-y-4">
      {personas.map((p, i) => (
        <div
          key={i}
          className="p-4"
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
            backgroundColor: "var(--surface)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex-1">
              <FieldLabel>اسم الشخصية</FieldLabel>
              <TextInput
                value={p.name}
                onChange={(v) =>
                  onChange(personas.map((x, idx) => (idx === i ? { ...x, name: v } : x)))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(personas.filter((_, idx) => idx !== i))}
              aria-label="حذف الشخصية"
              className="p-2 mt-5"
              style={{ color: "var(--muted-text)" }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
          <div className="mb-3">
            <FieldLabel>نقاط الألم</FieldLabel>
            <StringList
              items={p.pain_points}
              onChange={(pain_points) =>
                onChange(personas.map((x, idx) => (idx === i ? { ...x, pain_points } : x)))
              }
              placeholder="نقطة ألم"
            />
          </div>
          <div>
            <FieldLabel>الاعتراضات</FieldLabel>
            <StringList
              items={p.objections}
              onChange={(objections) =>
                onChange(personas.map((x, idx) => (idx === i ? { ...x, objections } : x)))
              }
              placeholder="اعتراض"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...personas, { name: "", pain_points: [], objections: [] }])}
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5"
        style={{
          color: "var(--ink-text)",
          border: "1px dashed var(--hairline)",
          borderRadius: "3px",
        }}
      >
        <Plus size={12} strokeWidth={1.75} />
        إضافة شخصية
      </button>
    </div>
  );
}

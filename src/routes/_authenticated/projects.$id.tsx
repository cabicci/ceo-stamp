import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowSquareOut, Plus, Trash, Sparkle, ArrowCounterClockwise, FloppyDisk, Lock, CheckCircle, CaretDown, CaretUp } from "@phosphor-icons/react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";
import { useServerFn } from "@tanstack/react-start";
import { analyzeWebsite, saveAnalysisEdits } from "@/lib/analyze-website.functions";
import { ConnectedSitesSection } from "@/components/ConnectedSitesSection";
import { AvailableChannelsSettings } from "@/components/AvailableChannelsSettings";
import { PackageGallery } from "@/components/PackageGallery";
import { ALL_CHANNELS, localizedPackageName, type AdaptedPlan, type Channel } from "@/lib/campaign-packages";
import { formatFrameworksDisplay } from "@/lib/marketing-frameworks";
import { StrategistChat } from "@/components/StrategistChat";
import { approveCampaignPlan } from "@/lib/strategist-chat.functions";
import { CampaignGeneratePanel } from "@/components/CampaignGeneratePanel";
import { projectSchema } from "@/lib/project-schema";


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
  const [availableChannels, setAvailableChannels] = useState<Channel[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));
  const pollRef = useRef<number | null>(null);

  const analyzeFn = useServerFn(analyzeWebsite);

  async function loadAvailableChannels() {
    const { data } = await supabase
      .from("brand_profiles")
      .select("available_channels")
      .eq("project_id", id)
      .maybeSingle();
    const raw = (data?.available_channels ?? []) as unknown;
    const parsed = Array.isArray(raw)
      ? (raw.filter((c) => ALL_CHANNELS.includes(c as Channel)) as Channel[])
      : [];
    setAvailableChannels(parsed);
    return parsed;
  }

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
    loadAvailableChannels();
    const onRefresh = () => {
      loadLatestAnalysis();
      startPolling();
    };
    window.addEventListener("analysis-refresh", onRefresh);
    return () => {
      window.removeEventListener("analysis-refresh", onRefresh);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [id]);

  const status = latest?.status ?? "idle";
  const isWorking = running || status === "scraping" || status === "analyzing";
  const analysisDone = status === "done";
  const channelsSet = availableChannels.length > 0;

  const step1Complete = analysisDone;
  const step2Complete = analysisDone;
  const step3Complete = channelsSet;
  const step2Unlocked = analysisDone;
  const step3Unlocked = analysisDone;
  const step4Unlocked = channelsSet;

  const currentStep: number = !analysisDone ? 1 : !channelsSet ? 3 : 4;

  useEffect(() => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      if (analysisDone) {
        next.add(2);
        next.add(3);
      }
      if (channelsSet) next.add(4);
      return next;
    });
  }, [currentStep, analysisDone, channelsSet]);

  function toggleStep(step: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

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
        <ProjectSettingsForm project={project} onSaved={loadProject} />
      </header>

      <WizardProgress
        currentStep={currentStep}
        step1Complete={step1Complete}
        step2Complete={step2Complete}
        step3Complete={step3Complete}
        step4Unlocked={step4Unlocked}
      />

      <div className="space-y-4">
        <WizardStepPanel
          step={1}
          title={t("projects.flow.step1.title")}
          subtitle={t("projects.flow.step1.subtitle")}
          complete={step1Complete}
          locked={false}
          expanded={expandedSteps.has(1)}
          onToggle={() => toggleStep(1)}
          isCurrent={currentStep === 1}
        >
          <p
            className="text-sm mb-4 leading-relaxed"
            style={{ color: "var(--muted-text)" }}
          >
            {t("projects.flow.step1.oneTimeNote")}
          </p>

          {status === "idle" && (
            <IdleCard onAnalyze={handleAnalyze} disabled={isWorking} />
          )}

          {isWorking && <RunningCard status={status} />}

          {status === "error" && !isWorking && (
            <ErrorCard
              message={latest?.error_message ?? t("analysis.unknownError")}
              onRetry={handleAnalyze}
            />
          )}

          {analysisDone && !isWorking && (
            <Card accent>
              <div className="flex items-start gap-3">
                <CheckCircle
                  size={22}
                  strokeWidth={1.75}
                  style={{ color: "var(--review)", flexShrink: 0 }}
                />
                <div>
                  <p className="text-sm mb-4" style={{ color: "var(--ink-text)" }}>
                    {t("projects.flow.step1.completeSummary")}
                  </p>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isWorking}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm"
                    style={{
                      border: "1px solid var(--hairline)",
                      color: "var(--ink-text)",
                      borderRadius: "3px",
                    }}
                  >
                    <ArrowCounterClockwise size={14} strokeWidth={1.75} />
                    {t("analysis.reanalyze")}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </WizardStepPanel>

        <WizardStepPanel
          step={2}
          title={t("projects.flow.step2.title")}
          subtitle={t("projects.flow.step2.subtitle")}
          complete={step2Complete}
          locked={!step2Unlocked}
          lockedMessage={t("projects.flow.locked.needsAnalysis")}
          expanded={expandedSteps.has(2)}
          onToggle={() => toggleStep(2)}
          isCurrent={currentStep === 2}
        >
          {analysisDone && latest && (
            <>
              <AnalysisEditor
                projectId={project.id}
                analysisId={latest.id}
                initial={normalize(latest.ai_analysis)}
                onReanalyze={handleAnalyze}
              />
              <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--hairline)" }}>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                  style={{ color: "var(--muted-text)" }}
                >
                  {t("projects.flow.step2.connectedSitesTitle")}
                </div>
                <p className="text-sm mb-4" style={{ color: "var(--muted-text)" }}>
                  {t("projects.flow.step2.connectedSitesHint")}
                </p>
                <ConnectedSitesSection projectId={project.id} />
              </div>
            </>
          )}
        </WizardStepPanel>

        <WizardStepPanel
          step={3}
          title={t("projects.flow.step3.title")}
          subtitle={t("projects.flow.step3.subtitle")}
          complete={step3Complete}
          locked={!step3Unlocked}
          lockedMessage={t("projects.flow.locked.needsBrand")}
          expanded={expandedSteps.has(3)}
          onToggle={() => toggleStep(3)}
          isCurrent={currentStep === 3}
        >
          <AvailableChannelsSettings
            projectId={project.id}
            onChange={(channels) => {
              setAvailableChannels(channels);
            }}
          />
        </WizardStepPanel>

        <WizardStepPanel
          step={4}
          title={t("projects.flow.step4.title")}
          subtitle={t("projects.flow.step4.subtitle")}
          complete={false}
          locked={!step4Unlocked}
          lockedMessage={t("projects.flow.locked.needsChannels")}
          expanded={expandedSteps.has(4)}
          onToggle={() => toggleStep(4)}
          isCurrent={currentStep === 4}
          alwaysActiveWhenUnlocked
        >
          <p
            className="text-sm mb-5 leading-relaxed"
            style={{ color: "var(--muted-text)" }}
          >
            {t("projects.flow.step4.repeatableNote")}
          </p>
          <CampaignSetup
            projectId={project.id}
            availableChannels={availableChannels}
          />
        </WizardStepPanel>
      </div>
    </AppShell>
  );
}

function ProjectSettingsForm({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(project.name);
  const [url, setUrl] = useState(project.website_url);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(project.name);
    setUrl(project.website_url);
  }, [project.id, project.name, project.website_url]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const parsed = projectSchema.safeParse({ name, website_url: url });
    if (!parsed.success) {
      setError(t("projects.form.urlError"));
      return;
    }

    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from("projects")
        .update({
          name: parsed.data.name,
          website_url: parsed.data.website_url,
        })
        .eq("id", project.id);
      if (updateErr) throw updateErr;
      await onSaved();
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = project.website_url;

  return (
    <form onSubmit={handleSubmit}>
      <label className="block mb-4">
        <span
          className="block font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
          style={{ color: "var(--muted-text)" }}
        >
          {t("projects.form.name")}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
          maxLength={120}
          className="w-full max-w-xl px-3 py-2.5 text-sm bg-transparent outline-none font-display text-[28px]"
          style={{
            color: "var(--ink-text)",
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
            fontWeight: 500,
          }}
        />
      </label>

      <label className="block mb-3">
        <span
          className="block font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
          style={{ color: "var(--muted-text)" }}
        >
          {t("projects.form.url")}
        </span>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
          required
          dir="ltr"
          placeholder="masaarat.ai"
          className="w-full max-w-xl px-3 py-2.5 text-sm bg-transparent outline-none"
          style={{
            color: "var(--ink-text)",
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
            fontFamily: "var(--font-mono)",
            textAlign: "left",
          }}
        />
      </label>

      {displayUrl && (
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 inline-flex items-center gap-2 font-mono text-sm break-all"
          style={{ color: "var(--review)" }}
          dir="ltr"
        >
          {displayUrl}
          <ArrowSquareOut size={12} strokeWidth={1.5} />
        </a>
      )}

      {error ? (
        <div
          className="mb-3 text-sm py-2 px-3"
          style={{
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "3px",
          }}
        >
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mb-3 text-sm" style={{ color: "var(--review)" }}>
          {t("projects.form.saved")}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        style={{
          backgroundColor: "var(--ink)",
          color: "var(--paper)",
          borderRadius: "3px",
        }}
      >
        <FloppyDisk size={14} strokeWidth={1.75} />
        {saving ? t("projects.form.saving") : t("projects.form.save")}
      </button>
    </form>
  );
}

function CampaignSetup({
  projectId,
  availableChannels,
}: {
  projectId: string;
  availableChannels: Channel[];
}) {
  const { t, locale } = useTranslation();
  const [picked, setPicked] = useState<AdaptedPlan | null>(null);
  const [entry, setEntry] = useState<"packages" | "strategist">("packages");
  const [approvedPackageId, setApprovedPackageId] = useState<string | null>(null);
  const [approvingPkg, setApprovingPkg] = useState(false);
  const [pkgError, setPkgError] = useState<string | null>(null);

  const approveFn = useServerFn(approveCampaignPlan);

  async function approvePackagePlan() {
    if (!picked) return;
    setApprovingPkg(true);
    setPkgError(null);
    try {
      const r = await approveFn({ data: { projectId, plan: picked } });
      setApprovedPackageId(r.campaign_id);
    } catch (e) {
      setPkgError(e instanceof Error ? e.message : t("campaign.approveFailed"));
    } finally {
      setApprovingPkg(false);
    }
  }

  return (
    <section>
      <SectionLabel>{t("campaign.startTitle")}</SectionLabel>
      <div className="flex gap-2 mb-5">
        <EntryTab active={entry === "packages"} onClick={() => setEntry("packages")}>
          {t("campaign.tabPackages")}
        </EntryTab>
        <EntryTab active={entry === "strategist"} onClick={() => setEntry("strategist")}>
          {t("campaign.tabStrategist")}
        </EntryTab>
      </div>

      {entry === "packages" && (
        <>
          <PackageGallery
            availableChannels={availableChannels}
            onSelectPlan={(p) => {
              setPicked(p);
              setApprovedPackageId(null);
              setPkgError(null);
            }}
          />
          {picked && !approvedPackageId && (
            <div
              className="mt-5 p-5"
              style={{
                border: "1px solid var(--accent-strong)",
                borderRadius: "4px",
                backgroundColor: "var(--surface)",
              }}
            >
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                style={{ color: "var(--muted-text)" }}
              >
                {t("campaign.pickedPlanTitle")}
              </div>
              <div
                className="font-display text-[18px] mb-1"
                style={{ color: "var(--ink-text)", fontWeight: 500 }}
              >
                {localizedPackageName(picked.package_id, picked.package_name_ar, t)}
              </div>
              <div className="text-sm mb-3" style={{ color: "var(--ink-text)" }}>
                {t("campaign.pickedPlanSummary", {
                  posts: picked.total_posts,
                  channels: picked.channels.length,
                  frameworks: formatFrameworksDisplay(picked.frameworks, locale),
                })}
              </div>
              {picked.adaptation_note_ar && (
                <div
                  className="mb-3 text-[12px] leading-relaxed"
                  style={{ color: "var(--muted-text)" }}
                >
                  {picked.adaptation_note_ar}
                </div>
              )}
              {pkgError && (
                <div
                  className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--danger)" }}
                >
                  {pkgError}
                </div>
              )}
              <button
                type="button"
                onClick={approvePackagePlan}
                disabled={approvingPkg}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent-strong)",
                  color: "#FFFFFF",
                  borderRadius: "3px",
                }}
              >
                <Sparkle size={14} strokeWidth={1.75} />
                {approvingPkg ? t("campaign.approvingPlan") : t("campaign.approvePlan")}
              </button>
            </div>
          )}
          {approvedPackageId && (
            <div
              className="mt-5 p-5"
              style={{
                border: "1px solid var(--accent-strong)",
                borderRadius: "4px",
                backgroundColor: "var(--surface)",
                color: "var(--ink-text)",
              }}
            >
              <div className="mb-4">{t("campaign.planApproved")}</div>
              <CampaignGeneratePanel campaignId={approvedPackageId} />
            </div>
          )}
        </>
      )}

      {entry === "strategist" && (
        <StrategistChat projectId={projectId} availableChannels={availableChannels} />
      )}
    </section>
  );
}

function EntryTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-sm transition-colors"
      style={{
        border: `1px solid ${active ? "var(--accent-strong)" : "var(--hairline)"}`,
        backgroundColor: active ? "var(--accent-strong)" : "var(--paper)",
        color: active ? "#FFFFFF" : "var(--ink-text)",
        borderRadius: "3px",
      }}
    >
      {children}
    </button>
  );
}




// -----------------------------------------------------------------------------
// Wizard flow
// -----------------------------------------------------------------------------

const WIZARD_STEPS = [1, 2, 3, 4] as const;

function WizardProgress({
  currentStep,
  step1Complete,
  step2Complete,
  step3Complete,
  step4Unlocked,
}: {
  currentStep: number;
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
  step4Unlocked: boolean;
}) {
  const { t } = useTranslation();

  const stepMeta = [
    { complete: step1Complete, unlocked: true },
    { complete: step2Complete, unlocked: step1Complete },
    { complete: step3Complete, unlocked: step1Complete },
    { complete: false, unlocked: step4Unlocked },
  ];

  const stepTitles = [
    t("projects.flow.step1.title"),
    t("projects.flow.step2.title"),
    t("projects.flow.step3.title"),
    t("projects.flow.step4.title"),
  ];

  return (
    <section className="mb-10 pb-8" style={{ borderBottom: "1px solid var(--hairline)" }}>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
        style={{ color: "var(--muted-text)" }}
      >
        {t("projects.flow.progressEyebrow")}
      </div>
      <div className="text-sm mb-6" style={{ color: "var(--ink-text)" }}>
        {t("projects.flow.stepOf", { current: currentStep, total: 4 })}
      </div>

      <div className="flex items-center w-full mb-3">
        {WIZARD_STEPS.map((n, i) => {
          const meta = stepMeta[i];
          const isCurrent = currentStep === n;
          const isLocked = !meta.unlocked;
          const isComplete = meta.complete && !isLocked && !(n === 4);

          return (
            <div key={n} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div
                className="flex items-center justify-center w-9 h-9 shrink-0 font-mono text-sm"
                style={{
                  borderRadius: "50%",
                  border: `1px solid ${
                    isLocked
                      ? "var(--hairline)"
                      : isCurrent
                        ? "var(--accent-strong)"
                        : isComplete
                          ? "var(--review)"
                          : "var(--hairline)"
                  }`,
                  backgroundColor: isLocked
                    ? "var(--paper)"
                    : isCurrent
                      ? "var(--accent-strong)"
                      : isComplete
                        ? "var(--surface)"
                        : "var(--paper)",
                  color: isLocked
                    ? "var(--muted-text)"
                    : isCurrent
                      ? "#FFFFFF"
                      : isComplete
                        ? "var(--review)"
                        : "var(--muted-text)",
                }}
              >
                {isComplete && !isCurrent ? (
                  <CheckCircle size={18} strokeWidth={1.75} />
                ) : isLocked ? (
                  <Lock size={14} strokeWidth={1.75} />
                ) : (
                  n
                )}
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2"
                  style={{
                    backgroundColor: isComplete ? "var(--accent-strong)" : "var(--hairline)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {WIZARD_STEPS.map((n, i) => {
          const meta = stepMeta[i];
          const isCurrent = currentStep === n;
          const isLocked = !meta.unlocked;
          const isComplete = meta.complete && !isLocked && !(n === 4);

          let statusLabel = t("projects.flow.statusLocked");
          if (!isLocked) {
            if (isComplete) statusLabel = t("projects.flow.statusComplete");
            else if (isCurrent) statusLabel = t("projects.flow.statusCurrent");
            else statusLabel = "";
          }

          return (
            <div
              key={n}
              className="text-center text-[11px] leading-snug min-w-0"
              style={{
                color: isLocked ? "var(--muted-text)" : "var(--ink-text)",
                opacity: isLocked ? 0.65 : 1,
              }}
            >
              {statusLabel && (
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] mb-0.5">
                  {statusLabel}
                </div>
              )}
              <div className="line-clamp-2">{stepTitles[i]}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WizardStepPanel({
  step,
  title,
  subtitle,
  complete,
  locked,
  lockedMessage,
  expanded,
  onToggle,
  isCurrent,
  alwaysActiveWhenUnlocked = false,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  complete: boolean;
  locked: boolean;
  lockedMessage?: string;
  expanded: boolean;
  onToggle: () => void;
  isCurrent: boolean;
  alwaysActiveWhenUnlocked?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const canToggle = !locked;
  const showComplete = complete && !alwaysActiveWhenUnlocked;

  return (
    <section
      className="overflow-hidden"
      style={{
        border: `1px solid ${isCurrent && !locked ? "var(--accent-strong)" : "var(--hairline)"}`,
        borderRadius: "4px",
        backgroundColor: locked ? "var(--surface)" : "var(--paper)",
        opacity: locked ? 0.85 : 1,
      }}
    >
      <button
        type="button"
        onClick={canToggle ? onToggle : undefined}
        disabled={!canToggle}
        className="w-full text-start px-5 py-4 flex items-start gap-4 disabled:cursor-not-allowed"
      >
        <div
          className="flex items-center justify-center w-8 h-8 shrink-0 font-mono text-sm"
          style={{
            borderRadius: "50%",
            border: `1px solid ${
              locked
                ? "var(--hairline)"
                : showComplete
                  ? "var(--review)"
                  : isCurrent
                    ? "var(--accent-strong)"
                    : "var(--hairline)"
            }`,
            backgroundColor: locked
              ? "transparent"
              : showComplete
                ? "var(--surface)"
                : isCurrent
                  ? "var(--accent-strong)"
                  : "transparent",
            color: locked
              ? "var(--muted-text)"
              : showComplete
                ? "var(--review)"
                : isCurrent
                  ? "#FFFFFF"
                  : "var(--ink-text)",
          }}
        >
          {locked ? (
            <Lock size={14} strokeWidth={1.75} />
          ) : showComplete ? (
            <CheckCircle size={16} strokeWidth={1.75} />
          ) : (
            step
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="font-display text-[17px]"
              style={{ color: locked ? "var(--muted-text)" : "var(--ink-text)", fontWeight: 500 }}
            >
              {title}
            </span>
            {!locked && (
              <span
                className="font-mono text-[9px] uppercase tracking-[0.16em] px-2 py-0.5"
                style={{
                  border: "1px solid var(--hairline)",
                  color: isCurrent ? "var(--accent-strong)" : "var(--muted-text)",
                  borderRadius: "2px",
                }}
              >
                {showComplete
                  ? t("projects.flow.statusComplete")
                  : isCurrent
                    ? t("projects.flow.statusCurrent")
                    : t("projects.flow.stepOf", { current: step, total: 4 })}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-text)" }}>
            {locked && lockedMessage ? lockedMessage : subtitle}
          </p>
        </div>

        {canToggle && (
          <span className="shrink-0 mt-1" style={{ color: "var(--muted-text)" }}>
            {expanded ? (
              <CaretUp size={16} strokeWidth={1.75} />
            ) : (
              <CaretDown size={16} strokeWidth={1.75} />
            )}
          </span>
        )}
      </button>

      {!locked && expanded && <div className="px-5 pb-6 pt-1">{children}</div>}
    </section>
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
  const { t } = useTranslation();
  return (
    <Card accent>
      <p className="text-base mb-5" style={{ color: "var(--ink-text)" }}>
        {t("analysis.idleBody")}
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
        <Sparkle size={14} strokeWidth={1.75} />
        {t("analysis.analyzeButton")}
      </button>
    </Card>
  );
}

function RunningCard({ status }: { status: string }) {
  const { t } = useTranslation();
  const label =
    status === "analyzing"
      ? t("analysis.runningAnalyzing")
      : status === "scraping"
        ? t("analysis.runningScraping")
        : t("analysis.runningStarting");
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
        {t("analysis.runningHint")}
      </div>
    </Card>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
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
        {t("analysis.failedTitle")}
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
        <ArrowCounterClockwise size={14} strokeWidth={1.75} />
        {t("common.retry")}
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
  const { t } = useTranslation();
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
      setError(e instanceof Error ? e.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <FieldLabel>{t("analysis.fields.businessModel")}</FieldLabel>
        <Textarea
          value={a.business_model}
          onChange={(v) => setA({ ...a, business_model: v })}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.targetAudience")}</FieldLabel>
        <Textarea
          value={a.target_audience}
          onChange={(v) => setA({ ...a, target_audience: v })}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.toneOfVoice")}</FieldLabel>
        <Textarea
          value={a.tone_of_voice}
          onChange={(v) => setA({ ...a, tone_of_voice: v })}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.usps")}</FieldLabel>
        <StringList items={a.usps} onChange={(usps) => setA({ ...a, usps })} placeholder={t("analysis.placeholders.usp")} />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.painPoints")}</FieldLabel>
        <StringList
          items={a.pain_points}
          onChange={(pain_points) => setA({ ...a, pain_points })}
          placeholder={t("analysis.placeholders.painPoint")}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.personas")}</FieldLabel>
        <PersonasEditor
          personas={a.personas}
          onChange={(personas) => setA({ ...a, personas })}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.contentGaps")}</FieldLabel>
        <StringList
          items={a.content_gaps}
          onChange={(content_gaps) => setA({ ...a, content_gaps })}
          placeholder={t("analysis.placeholders.contentGap")}
        />
      </Card>

      <Card>
        <FieldLabel>{t("analysis.fields.contentPillars")}</FieldLabel>
        <StringList
          items={a.content_pillars}
          onChange={(content_pillars) => setA({ ...a, content_pillars })}
          placeholder={t("analysis.placeholders.pillar")}
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
          <FloppyDisk size={14} strokeWidth={1.75} />
          {saving ? t("common.saving") : t("analysis.saveEdits")}
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
          <ArrowCounterClockwise size={14} strokeWidth={1.75} />
          {t("analysis.reanalyze")}
        </button>
        {savedAt && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted-text)" }}
          >
            {t("common.savedAt", { time: savedAt })}
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
  const { t } = useTranslation();
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
            aria-label={t("common.delete")}
            className="p-2"
            style={{ color: "var(--muted-text)" }}
          >
            <Trash size={14} strokeWidth={1.5} />
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
        {t("common.add")}
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
  const { t } = useTranslation();
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
              <FieldLabel>{t("analysis.placeholders.personaName")}</FieldLabel>
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
              aria-label={t("common.deletePersona")}
              className="p-2 mt-5"
              style={{ color: "var(--muted-text)" }}
            >
              <Trash size={14} strokeWidth={1.5} />
            </button>
          </div>
          <div className="mb-3">
            <FieldLabel>{t("analysis.fields.painPoints")}</FieldLabel>
            <StringList
              items={p.pain_points}
              onChange={(pain_points) =>
                onChange(personas.map((x, idx) => (idx === i ? { ...x, pain_points } : x)))
              }
              placeholder={t("analysis.placeholders.painPoint")}
            />
          </div>
          <div>
            <FieldLabel>{t("analysis.fields.objections")}</FieldLabel>
            <StringList
              items={p.objections}
              onChange={(objections) =>
                onChange(personas.map((x, idx) => (idx === i ? { ...x, objections } : x)))
              }
              placeholder={t("analysis.placeholders.objection")}
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
        {t("analysis.addPersona")}
      </button>
    </div>
  );
}

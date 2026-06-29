import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowSquareOut,
  CircleNotch,
  Copy,
  Folders,
} from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { cloneCampaign } from "@/lib/campaign-workspace.functions";
import {
  formatChannelsList,
  formatCreatedDate,
  formatDateRange,
  resolveCampaignTitle,
  type CampaignListRow,
} from "@/lib/campaign-list";

type Props = {
  /** When set, list only campaigns for this project. */
  projectId?: string;
  /** Compact layout for embedding in the project wizard. */
  compact?: boolean;
};

type StatusKey = "draft" | "generating" | "ready";

function statusKey(status: string): StatusKey {
  if (status === "generating" || status === "ready") return status;
  return "draft";
}

export function CampaignList({ projectId, compact = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cloneFn = useServerFn(cloneCampaign);

  const [rows, setRows] = useState<CampaignListRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    let query = supabase
      .from("campaigns")
      .select(
        "id, project_id, objective, channels, start_date, end_date, status, created_at, archived, campaign_plan, cloned_from_id, projects!inner(name), content_items(count)",
      )
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (!showArchived) {
      query = query.eq("archived", false);
    }

    const { data, error } = await query;
    if (error) {
      setLoadError(error.message);
      setRows([]);
      return;
    }

    const mapped: CampaignListRow[] = (data ?? []).map((row) => {
      const project = row.projects as { name: string } | null;
      const countRow = row.content_items as { count: number }[] | null;
      return {
        id: row.id,
        project_id: row.project_id,
        objective: row.objective,
        channels: row.channels,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
        created_at: row.created_at,
        archived: row.archived,
        campaign_plan: row.campaign_plan,
        cloned_from_id: row.cloned_from_id,
        post_count: countRow?.[0]?.count ?? 0,
        project_name: project?.name,
      };
    });

    setRows(mapped);
  }

  useEffect(() => {
    load();
  }, [projectId, showArchived]);

  const emptyLabel = useMemo(
    () =>
      showArchived ? t("campaignList.emptyArchived") : t("campaignList.empty"),
    [showArchived, t],
  );

  async function handleArchiveToggle(row: CampaignListRow) {
    setBusyId(row.id);
    setActionError(null);
    const nextArchived = !row.archived;
    const { error } = await supabase
      .from("campaigns")
      .update({ archived: nextArchived })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      setActionError(t("campaignList.archiveFailed"));
      return;
    }
    await load();
  }

  async function handleClone(row: CampaignListRow) {
    setBusyId(row.id);
    setActionError(null);
    try {
      const result = await cloneFn({ data: { campaignId: row.id } });
      await load();
      navigate({
        to: "/campaigns/$campaignId",
        params: { campaignId: result.campaign_id },
      });
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : t("campaignList.cloneFailed"),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={compact ? "mb-8" : undefined}>
      {!compact && (
        <header className="mb-8">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: "var(--muted-text)" }}
          >
            {t("campaignList.eyebrow")}
          </div>
          <h1
            className="font-display text-[32px] leading-[1.1] sm:text-[40px]"
            style={{ color: "var(--ink-text)", fontWeight: 500 }}
          >
            {t("campaignList.title")}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-text)" }}>
            {t("campaignList.subtitle")}
          </p>
        </header>
      )}

      {compact && (
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
          style={{ color: "var(--muted-text)" }}
        >
          {t("campaignList.projectSectionTitle")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "3px",
            backgroundColor: showArchived ? "var(--accent)" : "var(--paper)",
            color: "var(--ink-text)",
          }}
        >
          {showArchived ? (
            <Folders size={14} strokeWidth={1.75} />
          ) : (
            <Archive size={14} strokeWidth={1.75} />
          )}
          {showArchived
            ? t("campaignList.hideArchived")
            : t("campaignList.showArchived")}
        </button>
        {!compact && (
          <Link
            to="/"
            className="text-sm"
            style={{ color: "var(--muted-text)" }}
          >
            {t("campaignList.backToProjects")}
          </Link>
        )}
      </div>

      {loadError && (
        <div
          className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--danger)" }}
        >
          {loadError}
        </div>
      )}

      {actionError && (
        <div
          className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--danger)" }}
        >
          {actionError}
        </div>
      )}

      {rows === null && (
        <div className="text-sm" style={{ color: "var(--muted-text)" }}>
          {t("common.loading")}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div
          className="p-6 text-sm"
          style={{
            border: "1px dashed var(--hairline)",
            borderRadius: "4px",
            color: "var(--muted-text)",
          }}
        >
          {emptyLabel}
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const busy = busyId === row.id;
            const title = resolveCampaignTitle(t, row);
            const channels = formatChannelsList(row.channels);
            const dateRange = formatDateRange(
              row.start_date,
              row.end_date,
              t("campaignList.noDateRange"),
            );
            const status = statusKey(row.status);

            return (
              <li
                key={row.id}
                className="p-4 sm:p-5"
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: "4px",
                  backgroundColor: "var(--paper)",
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/campaigns/$campaignId"
                      params={{ campaignId: row.id }}
                      className="font-display text-[18px] hover:underline"
                      style={{ color: "var(--ink-text)", fontWeight: 500 }}
                    >
                      {title}
                    </Link>
                    {!projectId && row.project_name && (
                      <div
                        className="mt-1 text-[12px]"
                        style={{ color: "var(--muted-text)" }}
                      >
                        {t("campaignList.projectLabel", {
                          name: row.project_name,
                        })}
                      </div>
                    )}
                    <div
                      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--muted-text)" }}
                    >
                      <span>{channels || t("campaignList.noChannels")}</span>
                      <span>· {dateRange}</span>
                      <span>
                        · {t("campaignList.posts", { count: row.post_count })}
                      </span>
                      <span>
                        · {t("campaignList.created", {
                          date: formatCreatedDate(row.created_at),
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: "2px",
                        backgroundColor:
                          status === "ready"
                            ? "var(--accent)"
                            : "transparent",
                        color: "var(--ink-text)",
                      }}
                    >
                      {t(`campaignList.status.${status}`)}
                    </span>

                    <Link
                      to="/campaigns/$campaignId"
                      params={{ campaignId: row.id }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: "3px",
                        color: "var(--ink-text)",
                      }}
                    >
                      <ArrowSquareOut size={14} strokeWidth={1.75} />
                      {t("campaignList.open")}
                    </Link>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleClone(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: "3px",
                        color: "var(--ink-text)",
                      }}
                    >
                      {busy ? (
                        <CircleNotch
                          size={14}
                          strokeWidth={2}
                          className="animate-spin"
                        />
                      ) : (
                        <Copy size={14} strokeWidth={1.75} />
                      )}
                      {t("campaignList.clone")}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleArchiveToggle(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: "3px",
                        color: "var(--muted-text)",
                      }}
                    >
                      {row.archived
                        ? t("campaignList.unarchive")
                        : t("campaignList.archive")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

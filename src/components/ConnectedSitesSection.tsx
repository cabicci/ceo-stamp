import { useEffect, useState } from "react";
import { Plus, Trash, LinkSimple, ArrowCounterClockwise, ShieldCheck, X, Sparkle } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startConnectSession, captureSession, abandonConnectSession } from "@/lib/connect-site.functions";
import { scrapeAuthenticated } from "@/lib/scrape-authenticated.functions";
import { useTranslation, type TranslateFn } from "@/i18n/I18nProvider";
import { translateAnalysisError } from "@/lib/translate-analysis-error";
import { translateConnectedSitesError } from "@/lib/translate-connected-sites-error";
import { normalizeWebsiteUrl } from "@/lib/project-schema";
import type { ConnectNavigateDebugInfo } from "@/lib/browserbase-cdp.server";


type Row = {
  id: string;
  project_id: string;
  label: string;
  login_url: string;
  status: string;
  last_connected_at: string | null;
  expires_at: string | null;
  error_message: string | null;
};

export function ConnectedSitesSection({
  projectId,
  hideHeader = false,
}: {
  projectId: string;
  hideHeader?: boolean;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [active, setActive] = useState<{
    siteId: string;
    sessionId: string;
    liveViewUrl: string;
    loginUrl: string;
    loginNavigationFailed: boolean;
    debugInfo?: ConnectNavigateDebugInfo;
  } | null>(null);

  const startFn = useServerFn(startConnectSession);
  const captureFn = useServerFn(captureSession);
  const abandonFn = useServerFn(abandonConnectSession);
  const scrapeFn = useServerFn(scrapeAuthenticated);
  const [scrapingFor, setScrapingFor] = useState<string | null>(null);
  const [scrapeStage, setScrapeStage] = useState<string>("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("connected_sites")
      .select("id, project_id, label, login_url, status, last_connected_at, expires_at, error_message")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setRows((data as Row[] | null) ?? []);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function handleAdd() {
    if (!label.trim() || !loginUrl.trim()) return;
    await supabase.from("connected_sites").insert({
      project_id: projectId,
      label: label.trim(),
      login_url: normalizeWebsiteUrl(loginUrl),
    });
    setLabel("");
    setLoginUrl("");
    setAdding(false);
    await load();
  }

  async function handleDelete(id: string) {
    await supabase.from("connected_sites").delete().eq("id", id);
    await load();
  }

  async function handleConnect(row: Row) {
    setConnectError(null);
    try {
      const res = await startFn({ data: { connectedSiteId: row.id } });
      if (!res.ok) {
        setConnectError(translateConnectedSitesError(res.message, t));
        await load();
        return;
      }
      setActive({
        siteId: row.id,
        sessionId: res.sessionId,
        liveViewUrl: res.liveViewUrl,
        loginUrl: res.loginUrl,
        loginNavigationFailed: res.loginNavigationFailed ?? false,
        debugInfo: res.debugInfo,
      });
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setConnectError(
        raw.startsWith("connectedSites.")
          ? translateConnectedSitesError(raw, t)
          : t("connectedSites.errors.sessionStartFailed"),
      );
      await load();
    }
  }

  async function handleCaptured() {
    if (!active) return;
    setCaptureError(null);
    try {
      await captureFn({
        data: { connectedSiteId: active.siteId, sessionId: active.sessionId },
      });
      setActive(null);
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setCaptureError(
        raw.startsWith("connectedSites.")
          ? translateConnectedSitesError(raw, t)
          : t("connectedSites.errors.sessionSaveFailed"),
      );
      await load();
    }
  }

  async function handleCancel() {
    if (!active) return;
    try {
      await abandonFn({
        data: { connectedSiteId: active.siteId, sessionId: active.sessionId },
      });
    } catch {
      /* best-effort — still close modal */
    }
    setActive(null);
    await load();
  }

  async function handleScrape(row: Row) {
    setScrapeError(null);
    setScrapingFor(row.id);
    setScrapeStage(t("connectedSites.scrapeOpening"));
    // Lightweight stage advancer (visual only).
    const t1 = window.setTimeout(() => setScrapeStage(t("connectedSites.scrapeReading")), 1500);
    const t2 = window.setTimeout(() => setScrapeStage(t("connectedSites.scrapeAnalyzing")), 8000);
    try {
      const res = await scrapeFn({ data: { connectedSiteId: row.id } });
      if (!res.ok) {
        setScrapeError(translateAnalysisError(res.message, t));
      } else {
        // Notify the parent page to refresh the analysis form.
        window.dispatchEvent(new CustomEvent("analysis-refresh"));
      }
      await load();
    } catch {
      setScrapeError(t("connectedSites.scrapeFailed"));
      await load();
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setScrapingFor(null);
      setScrapeStage("");
    }
  }


  return (
    <section className={hideHeader ? undefined : "mb-8"}>
      <div
        className={`flex items-center mb-4 ${hideHeader ? "justify-end" : "justify-between"}`}
      >
        {!hideHeader && (
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--muted-text)" }}
          >
            {t("connectedSites.title")}
          </div>
        )}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5"
            style={{
              color: "var(--ink-text)",
              border: "1px dashed var(--hairline)",
              borderRadius: "3px",
            }}
          >
            <Plus size={12} strokeWidth={1.75} />
            {t("connectedSites.linkSite")}
          </button>
        )}
      </div>

      {connectError && (
        <ConnectFlowError message={connectError} onDismiss={() => setConnectError(null)} />
      )}
      {scrapeError && (
        <ConnectFlowError message={scrapeError} onDismiss={() => setScrapeError(null)} />
      )}

      {adding && (
        <div
          className="p-5 mb-4"
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "4px",
            backgroundColor: "var(--surface)",
          }}
        >
          <div className="space-y-3">
            <div>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2"
                style={{ color: "var(--muted-text)" }}
              >
                {t("connectedSites.nameLabel")}
              </div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-transparent outline-none"
                style={{
                  color: "var(--ink-text)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2"
                style={{ color: "var(--muted-text)" }}
              >
                {t("connectedSites.loginUrlLabel")}
              </div>
              <input
                dir="ltr"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder="https://yoursite.com/login"
                className="w-full px-3 py-2 text-sm font-mono bg-transparent outline-none"
                style={{
                  color: "var(--ink-text)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAdd}
                className="px-4 py-2 text-sm"
                style={{
                  backgroundColor: "var(--accent-strong)",
                  color: "#FFFFFF",
                  borderRadius: "3px",
                }}
              >
                {t("common.add")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setLabel("");
                  setLoginUrl("");
                }}
                className="px-4 py-2 text-sm"
                style={{
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-text)",
                  borderRadius: "3px",
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div
          className="p-6 text-sm"
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "4px",
            backgroundColor: "var(--surface)",
            color: "var(--ink-text)",
          }}
        >
          {t("connectedSites.emptyHint")}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <SiteRow
            key={r.id}
            row={r}
            onConnect={() => handleConnect(r)}
            onDelete={() => handleDelete(r.id)}
            onScrape={() => handleScrape(r)}
            scraping={scrapingFor === r.id}
            scrapeStage={scrapingFor === r.id ? scrapeStage : ""}
            t={t}
          />
        ))}

      </div>

      {active && (
        <ConnectModal
          loginUrl={active.loginUrl}
          liveViewUrl={active.liveViewUrl}
          loginNavigationFailed={active.loginNavigationFailed}
          debugInfo={active.debugInfo}
          captureError={captureError}
          onDone={handleCaptured}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
}

function statusMeta(status: string, t: TranslateFn): { label: string; color: string } {
  switch (status) {
    case "connected":
      return { label: t("connectedSites.status.connected"), color: "var(--approve)" };
    case "connecting":
      return { label: t("connectedSites.status.connecting"), color: "var(--review)" };
    case "expired":
      return { label: t("connectedSites.status.expired"), color: "var(--review)" };
    case "error":
      return { label: t("connectedSites.status.error"), color: "var(--danger)" };
    default:
      return { label: t("connectedSites.status.disconnected"), color: "var(--muted-text)" };
  }
}

function SiteRow({
  row,
  onConnect,
  onDelete,
  onScrape,
  scraping,
  scrapeStage,
  t,
}: {
  row: Row;
  onConnect: () => void;
  onDelete: () => void;
  onScrape: () => void;
  scraping: boolean;
  scrapeStage: string;
  t: TranslateFn;
}) {
  const meta = statusMeta(row.status, t);
  const expired =
    row.status === "expired" ||
    (row.expires_at && new Date(row.expires_at).getTime() < Date.now());
  const isConnected = row.status === "connected" && !expired;

  return (
    <div
      className="p-5"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "4px",
        backgroundColor: "var(--paper)",
      }}
    >

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div
              className="text-base"
              style={{ color: "var(--ink-text)", fontWeight: 500 }}
            >
              {row.label}
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5"
              style={{
                color: meta.color,
                border: `1px solid ${meta.color}`,
                borderRadius: "2px",
              }}
            >
              {meta.label}
            </span>
          </div>
          <div
            className="font-mono text-xs break-all"
            dir="ltr"
            style={{ color: "var(--muted-text)" }}
          >
            {row.login_url}
          </div>
          {row.error_message && (
            <div
              className="mt-2 text-xs"
              style={{ color: "var(--danger)" }}
            >
              {translateConnectedSitesError(row.error_message, t)}
            </div>
          )}
          {row.last_connected_at && isConnected && (
            <div
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted-text)" }}
            >
              {t("connectedSites.lastConnected", {
                time: new Date(row.last_connected_at).toLocaleString("en-GB"),
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {expired || row.status === "expired" ? (
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm"
              style={{
                backgroundColor: "var(--accent-strong)",
                color: "#FFFFFF",
                borderRadius: "3px",
              }}
            >
              <ArrowCounterClockwise size={14} strokeWidth={1.75} />
              {t("connectedSites.reconnect")}
            </button>
          ) : isConnected ? (
            <>
              <button
                type="button"
                onClick={onScrape}
                disabled={scraping}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                style={{
                  backgroundColor: "var(--accent-strong)",
                  color: "#FFFFFF",
                  borderRadius: "3px",
                }}
              >
                <Sparkle size={14} strokeWidth={1.75} />
                {scraping ? scrapeStage || t("connectedSites.scrapeRunning") : t("connectedSites.scrapeProtected")}
              </button>
              <button
                type="button"
                onClick={onConnect}
                disabled={scraping}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                style={{
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-text)",
                  borderRadius: "3px",
                }}
              >
                <ArrowCounterClockwise size={14} strokeWidth={1.75} />
                {t("connectedSites.refreshSession")}
              </button>
            </>

          ) : (
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm"
              style={{
                backgroundColor: "var(--accent-strong)",
                color: "#FFFFFF",
                borderRadius: "3px",
              }}
            >
              <LinkSimple size={14} strokeWidth={1.75} />
              {t("connectedSites.linkYourSite")}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("common.delete")}
            className="p-2"
            style={{ color: "var(--muted-text)" }}
          >
            <Trash size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectFlowError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="mb-4 p-4 flex items-start justify-between gap-3"
      style={{
        border: "1px solid var(--danger)",
        borderRadius: "4px",
        backgroundColor: "var(--surface)",
      }}
    >
      <p className="text-sm leading-relaxed" style={{ color: "var(--danger)" }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.cancel")}
        className="shrink-0 p-1"
        style={{ color: "var(--muted-text)" }}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function ConnectModal({
  loginUrl,
  liveViewUrl,
  loginNavigationFailed,
  debugInfo,
  captureError,
  onDone,
  onCancel,
}: {
  loginUrl: string;
  liveViewUrl: string;
  loginNavigationFailed: boolean;
  debugInfo?: ConnectNavigateDebugInfo;
  captureError: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center p-4"
      style={{ backgroundColor: "rgba(20, 20, 24, 0.55)" }}
    >
      <div
        className="w-full max-w-6xl flex flex-col"
        style={{
          backgroundColor: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: "4px",
        }}
      >
        <div
          className="p-5 flex items-start justify-between gap-4"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div className="flex-1">
            <div
              className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1"
              style={{ color: "var(--muted-text)" }}
            >
              {t("connectedSites.modal.title")}
            </div>
            <h2
              className="font-display text-xl mb-2"
              style={{ color: "var(--ink-text)", fontWeight: 500 }}
            >
              {t("connectedSites.modal.subtitle")}
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink-text)", maxWidth: 720 }}
            >
              {t("connectedSites.modal.instructions")}
            </p>
            <div
              className="mt-2 font-mono text-xs break-all"
              dir="ltr"
              style={{ color: "var(--muted-text)" }}
            >
              {loginUrl}
            </div>
            {loginNavigationFailed && (
              <p
                className="mt-3 text-sm leading-relaxed py-2 px-3"
                style={{
                  color: "var(--review)",
                  border: "1px solid var(--review)",
                  borderRadius: "3px",
                  backgroundColor: "var(--surface)",
                }}
              >
                {t("connectedSites.modal.loginNavigationFailed")}
              </p>
            )}
            {loginNavigationFailed && debugInfo && (
              <pre
                className="mt-2 text-[11px] leading-relaxed py-2 px-3 overflow-x-auto whitespace-pre-wrap break-all"
                dir="ltr"
                style={{
                  color: "var(--ink-text)",
                  border: "1px dashed var(--hairline)",
                  borderRadius: "3px",
                  backgroundColor: "var(--surface)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {`DEBUG\n${JSON.stringify(debugInfo, null, 2)}`}
              </pre>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("common.cancel")}
            className="p-2"
            style={{ color: "var(--muted-text)" }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div
          className="flex-1 min-h-[520px]"
          style={{ backgroundColor: "#000" }}
        >
          <iframe
            src={liveViewUrl}
            title="Browserbase live session"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            allow="clipboard-read; clipboard-write"
            className="w-full h-full"
            style={{ minHeight: 520, border: 0, display: "block" }}
          />
        </div>

        <div
          className="p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <div className="flex flex-col gap-2 min-w-0">
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--muted-text)" }}
            >
              <ShieldCheck size={14} strokeWidth={1.5} style={{ color: "var(--approve)" }} />
              {t("connectedSites.modal.passwordNote")}
            </div>
            {captureError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {captureError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm"
              style={{
                border: "1px solid var(--hairline)",
                color: "var(--ink-text)",
                borderRadius: "3px",
              }}
            >
              {t("connectedSites.modal.openNewTab")}
            </a>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm"
              style={{
                border: "1px solid var(--hairline)",
                color: "var(--ink-text)",
                borderRadius: "3px",
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onDone();
                } finally {
                  setSubmitting(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent-strong)",
                color: "#FFFFFF",
                borderRadius: "3px",
              }}
            >
              <ShieldCheck size={14} strokeWidth={1.75} />
              {submitting ? t("connectedSites.modal.signingIn") : t("connectedSites.modal.signedIn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

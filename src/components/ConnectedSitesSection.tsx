import { useEffect, useState } from "react";
import { Plus, Trash2, Link2, RotateCcw, ShieldCheck, X, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startConnectSession, captureSession } from "@/lib/connect-site.functions";
import { scrapeAuthenticated } from "@/lib/scrape-authenticated.functions";


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

export function ConnectedSitesSection({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [active, setActive] = useState<{
    siteId: string;
    sessionId: string;
    liveViewUrl: string;
    loginUrl: string;
  } | null>(null);

  const startFn = useServerFn(startConnectSession);
  const captureFn = useServerFn(captureSession);

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
      login_url: loginUrl.trim(),
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
    try {
      const res = await startFn({ data: { connectedSiteId: row.id } });
      setActive({
        siteId: row.id,
        sessionId: res.sessionId,
        liveViewUrl: res.liveViewUrl,
        loginUrl: res.loginUrl,
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "فشل بدء الجلسة");
      await load();
    }
  }

  async function handleCaptured() {
    if (!active) return;
    try {
      await captureFn({
        data: { connectedSiteId: active.siteId, sessionId: active.sessionId },
      });
      setActive(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "فشل حفظ الجلسة");
      await load();
    }
  }

  async function handleCancel() {
    if (!active) return;
    // Mark as disconnected; capture wasn't pressed.
    await supabase
      .from("connected_sites")
      .update({ status: "disconnected" })
      .eq("id", active.siteId);
    setActive(null);
    await load();
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--muted-text)" }}
        >
          المواقع المربوطة
        </div>
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
            ربط موقع
          </button>
        )}
      </div>

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
                الاسم (مثال: لوحة الطالب)
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
                رابط تسجيل الدخول
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
                إضافة
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
                إلغاء
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
          لو موقعك بيحتاج تسجيل دخول، اربطه هنا عشان نقدر نقرأ صفحاتك المحمية.
          إحنا مش بنشوف ولا بنخزّن كلمة السر — بنحفظ الجلسة بس.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <SiteRow
            key={r.id}
            row={r}
            onConnect={() => handleConnect(r)}
            onDelete={() => handleDelete(r.id)}
          />
        ))}
      </div>

      {active && (
        <ConnectModal
          loginUrl={active.loginUrl}
          liveViewUrl={active.liveViewUrl}
          onDone={handleCaptured}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
}

function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "connected":
      return { label: "متصل", color: "var(--approve)" };
    case "connecting":
      return { label: "بيتم الربط…", color: "var(--review)" };
    case "expired":
      return { label: "الجلسة انتهت", color: "var(--review)" };
    case "error":
      return { label: "خطأ", color: "var(--danger)" };
    default:
      return { label: "غير متصل", color: "var(--muted-text)" };
  }
}

function SiteRow({
  row,
  onConnect,
  onDelete,
}: {
  row: Row;
  onConnect: () => void;
  onDelete: () => void;
}) {
  const meta = statusMeta(row.status);
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
              {row.error_message}
            </div>
          )}
          {row.last_connected_at && isConnected && (
            <div
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted-text)" }}
            >
              آخر اتصال · {new Date(row.last_connected_at).toLocaleString("en-GB")}
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
              <RotateCcw size={14} strokeWidth={1.75} />
              اربط تاني
            </button>
          ) : isConnected ? (
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm"
              style={{
                border: "1px solid var(--hairline)",
                color: "var(--ink-text)",
                borderRadius: "3px",
              }}
            >
              <RotateCcw size={14} strokeWidth={1.75} />
              تحديث الجلسة
            </button>
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
              <Link2 size={14} strokeWidth={1.75} />
              اربط موقعك
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="حذف"
            className="p-2"
            style={{ color: "var(--muted-text)" }}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectModal({
  loginUrl,
  liveViewUrl,
  onDone,
  onCancel,
}: {
  loginUrl: string;
  liveViewUrl: string;
  onDone: () => void;
  onCancel: () => void;
}) {
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
              ربط الموقع
            </div>
            <h2
              className="font-display text-xl mb-2"
              style={{ color: "var(--ink-text)", fontWeight: 500 }}
            >
              سجّل دخولك على موقعك
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink-text)", maxWidth: 720 }}
            >
              النافذة دي متصفح حقيقي على موقعك.{" "}
              <strong>اكتب الإيميل والباسوورد فيها زي ما بتعمل عادي.</strong>{" "}
              إحنا مش بنشوف ولا بنخزّن كلمة السر — بنحفظ الجلسة بس عشان نقدر
              نقرأ صفحاتك المحمية. لما تخلّص لوج إن، دوس{" "}
              <strong>"تم تسجيل الدخول"</strong>.
            </p>
            <div
              className="mt-2 font-mono text-xs break-all"
              dir="ltr"
              style={{ color: "var(--muted-text)" }}
            >
              {loginUrl}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="إلغاء"
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
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--muted-text)" }}
          >
            <ShieldCheck size={14} strokeWidth={1.5} style={{ color: "var(--approve)" }} />
            الباسوورد بيدخل لموقعك مباشرة — مش بيمر علينا.
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
              فتح في تبويب جديد
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
              إلغاء
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
              {submitting ? "جارٍ الحفظ…" : "تم تسجيل الدخول"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

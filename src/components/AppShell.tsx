import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Folder, ChartLine, Megaphone, SealCheck, SignOut, ShieldCheck, List, X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const navItems = [
  { key: "projects", to: "/", icon: Folder },
  { key: "analysis", to: "/analysis", icon: ChartLine },
  { key: "campaigns", to: "/campaigns", icon: Megaphone },
  { key: "review", to: "/review", icon: SealCheck },
] as const;

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  const { isAdmin } = useIsAdmin();

  return (
    <aside
      className={`fixed inset-y-0 start-0 w-64 flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
      }`}
      style={{
        backgroundColor: "var(--surface)",
        color: "var(--ink-text)",
        borderInlineEnd: "1px solid var(--hairline)",
      }}
    >
      <div className="px-6 pt-8 pb-10 flex items-start justify-between">
        <div>
          <h1
            className="font-display text-[28px] leading-none inline-flex items-baseline gap-1"
            style={{ color: "var(--ink-text)", fontWeight: 500 }}
            dir="ltr"
            lang="en"
          >
            Marketing CEO
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                backgroundColor: "var(--accent)",
              }}
            />
          </h1>
          <div
            className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted-text)" }}
          >
            {t("brand.tagline")}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden -me-2 -mt-2 p-2"
          style={{ color: "var(--muted-text)" }}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm transition-colors"
                  style={{
                    color: active ? "var(--ink-text)" : "var(--muted-text)",
                    backgroundColor: active ? "var(--accent)" : "transparent",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{t(`nav.${item.key}`)}</span>
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li>
              <Link
                to="/admin"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm transition-colors"
                style={{
                  color: pathname === "/admin" ? "var(--ink-text)" : "var(--muted-text)",
                  backgroundColor: pathname === "/admin" ? "var(--accent)" : "transparent",
                  fontWeight: pathname === "/admin" ? 600 : 400,
                }}
              >
                <ShieldCheck size={16} strokeWidth={1.5} />
                <span>{t("nav.admin")}</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <div
        className="px-6 py-5 space-y-4"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-text)" }}
          >
            {t("brand.version")}
          </span>
          <LanguageToggle />
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}

function SignOutButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      }}
      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:opacity-80"
      style={{ color: "var(--muted-text)" }}
    >
      <SignOut size={12} strokeWidth={1.5} />
      {t("auth.signOut")}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--paper)" }}>
      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14"
        style={{
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -ms-2"
          style={{ color: "var(--ink-text)" }}
        >
          <List size={20} />
        </button>
        <span
          className="font-display text-[18px] inline-flex items-baseline gap-1"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
          dir="ltr"
          lang="en"
        >
          Marketing CEO
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              backgroundColor: "var(--accent)",
            }}
          />
        </span>
        <span className="w-8" />
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="lg:ms-64 min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}

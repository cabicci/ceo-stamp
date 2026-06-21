import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FolderOpen, LineChart, Megaphone, CheckSquare, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { LanguageToggle } from "@/components/LanguageToggle";

const navItems = [
  { key: "projects", to: "/", icon: FolderOpen },
  { key: "analysis", to: "/analysis", icon: LineChart },
  { key: "campaigns", to: "/campaigns", icon: Megaphone },
  { key: "review", to: "/review", icon: CheckSquare },
] as const;

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();

  return (
    <aside
      className="fixed inset-y-0 start-0 w-64 flex flex-col"
      style={{
        backgroundColor: "var(--surface)",
        color: "var(--ink-text)",
        borderInlineEnd: "1px solid var(--hairline)",
      }}
    >
      <div className="px-6 pt-8 pb-10">
        {/* Brand wordmark — fixed Latin, never translated.
            The yellow accent dot is the brand color expression. */}
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

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
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
      <LogOut size={12} strokeWidth={1.5} />
      {t("auth.signOut")}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--paper)" }}>
      <Sidebar />
      <main className="ms-64 min-h-screen">
        <div className="mx-auto max-w-6xl px-10 py-12">{children}</div>
      </main>
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, LineChart, Megaphone, CheckSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation, type Locale } from "@/i18n/I18nProvider";

const navItems = [
  { key: "projects", to: "/", icon: FolderOpen },
  { key: "analysis", to: "/analysis", icon: LineChart },
  { key: "campaigns", to: "/campaigns", icon: Megaphone },
  { key: "review", to: "/review", icon: CheckSquare },
] as const;

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  const options: { value: Locale; label: string }[] = [
    { value: "ar", label: "AR" },
    { value: "en", label: "EN" },
  ];
  return (
    <div
      className="inline-flex items-center font-mono text-[10px] tracking-[0.18em]"
      style={{ border: "1px solid rgba(201,203,195,0.18)", borderRadius: "2px" }}
      role="group"
      aria-label="Language"
    >
      {options.map((opt, idx) => {
        const active = locale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            className="px-2.5 py-1 transition-colors"
            style={{
              backgroundColor: active ? "var(--brass)" : "transparent",
              color: active ? "var(--ink)" : "var(--brass)",
              borderInlineStart: idx === 0 ? "none" : "1px solid rgba(201,203,195,0.18)",
              fontWeight: active ? 600 : 500,
            }}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();

  return (
    <aside
      className="fixed inset-y-0 start-0 w-64 flex flex-col"
      style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
    >
      <div className="px-6 pt-8 pb-10">
        {/* Brand wordmark — fixed Latin, never translated */}
        <h1
          className="font-display text-[28px] leading-none"
          style={{ color: "var(--paper)", fontWeight: 500 }}
          dir="ltr"
          lang="en"
        >
          Marketing CEO
        </h1>
        <div
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--brass)" }}
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
                    color: active ? "var(--paper)" : "rgba(234,235,230,0.62)",
                    backgroundColor: active ? "rgba(234,235,230,0.06)" : "transparent",
                    borderInlineStart: active ? "2px solid var(--brass)" : "2px solid transparent",
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
        className="px-6 py-5 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid rgba(201,203,195,0.12)" }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: "var(--brass)" }}
        >
          {t("brand.version")}
        </span>
        <LanguageToggle />
      </div>
    </aside>
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

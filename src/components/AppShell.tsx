import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, LineChart, Megaphone, CheckSquare } from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { label: "Projects", to: "/", icon: FolderOpen },
  { label: "Analysis", to: "/analysis", icon: LineChart },
  { label: "Campaigns", to: "/campaigns", icon: Megaphone },
  { label: "Review", to: "/review", icon: CheckSquare },
];

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className="fixed inset-y-0 left-0 w-64 flex flex-col"
      style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
    >
      <div className="px-6 pt-8 pb-10">
        <h1
          className="font-display text-[28px] leading-none"
          style={{ color: "var(--paper)", fontWeight: 500 }}
        >
          Marketing CEO
        </h1>
        <div
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--brass)" }}
        >
          Command · Ledger
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
                    borderLeft: active ? "2px solid var(--brass)" : "2px solid transparent",
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="px-6 py-5 font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{
          color: "var(--brass)",
          borderTop: "1px solid rgba(201,203,195,0.12)",
        }}
      >
        v0.1 · Internal
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--paper)" }}>
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="mx-auto max-w-6xl px-10 py-12">{children}</div>
      </main>
    </div>
  );
}

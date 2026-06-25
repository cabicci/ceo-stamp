import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { IconContext } from "@phosphor-icons/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "../i18n/I18nProvider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Marketing CEO" },
      { name: "description", content: "Internal marketing command center — AI drafts, you approve." },
      { property: "og:title", content: "Marketing CEO" },
      { property: "og:description", content: "Internal marketing command center — AI drafts, you approve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        <div
          id="app-boot-fallback"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            display: "grid",
            placeItems: "center",
            padding: "24px",
            background: "#FFFFFF",
            color: "#1A1B1F",
            fontFamily:
              '"IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, -apple-system, sans-serif',
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "28px",
                fontWeight: 500,
                direction: "ltr",
              }}
            >
              Marketing CEO
            </div>
            <div style={{ marginTop: "14px", color: "#6B6B66", fontSize: "14px" }}>
              جاري تحميل البريفيو…
            </div>
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "center", gap: "8px" }}>
              <a
                href="/auth"
                style={{
                  border: "1px solid #ECE9DA",
                  borderRadius: "4px",
                  color: "#1A1B1F",
                  fontSize: "12px",
                  padding: "8px 12px",
                  textDecoration: "none",
                }}
              >
                صفحة الدخول
              </a>
              <a
                href="/"
                style={{
                  background: "#1A1B1F",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  padding: "8px 12px",
                  textDecoration: "none",
                }}
              >
                إعادة فتح
              </a>
            </div>
          </div>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    document.getElementById("app-boot-fallback")?.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <IconContext.Provider value={{ weight: "bold" }}>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </IconContext.Provider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

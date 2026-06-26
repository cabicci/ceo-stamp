import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PREVIEW_AUTH_TIMEOUT_MS = 3_500;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export const Route = createFileRoute("/index")({
  component: PreviewEntryRedirect,
});

function PreviewEntryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function openPreview() {
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        PREVIEW_AUTH_TIMEOUT_MS,
      );
      if (!active) return;

      if (sessionResult?.data.session?.user) {
        navigate({ to: "/", replace: true });
        return;
      }

      const userResult = await withTimeout(supabase.auth.getUser(), PREVIEW_AUTH_TIMEOUT_MS);
      if (!active) return;

      navigate({ to: userResult?.data.user ? "/" : "/auth", replace: true });
    }

    void openPreview();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main
      className="min-h-screen grid place-items-center px-6 text-center"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink-text)" }}
      dir="rtl"
      lang="ar"
    >
      <div>
        <h1 className="font-display text-[28px]" style={{ fontWeight: 500 }} dir="ltr" lang="en">
          Marketing CEO
        </h1>
        <p className="mt-4 text-sm" style={{ color: "var(--muted-text)" }}>
          جاري فتح البريفيو…
        </p>
      </div>
    </main>
  );
}
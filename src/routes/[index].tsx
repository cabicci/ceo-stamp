import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/index")({
  component: PreviewEntryRedirect,
});

function PreviewEntryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        navigate({ to: data.user ? "/" : "/auth", replace: true });
      })
      .catch(() => {
        if (!active) return;
        navigate({ to: "/auth", replace: true });
      });

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
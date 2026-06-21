import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Marketing CEO — Sign In" },
      { name: "description", content: "Internal access." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: "/" });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("auth.genericError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const isAr = locale === "ar";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div
        className="w-full max-w-md"
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: "4px",
          padding: "2.5rem",
          backgroundColor: "var(--paper)",
        }}
      >
        <h1
          className="font-display text-[32px] leading-none"
          style={{ color: "var(--ink-text)", fontWeight: 500 }}
          dir="ltr"
          lang="en"
        >
          Marketing CEO
        </h1>
        <div
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--brass)" }}
        >
          {mode === "login" ? t("auth.eyebrowLogin") : t("auth.eyebrowSignup")}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Field
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
            align={isAr ? "right" : "left"}
          />
          <Field
            label={t("auth.password")}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            align={isAr ? "right" : "left"}
          />

          {error ? (
            <div
              className="text-sm py-2 px-3"
              style={{
                color: "var(--stamp)",
                border: "1px solid var(--stamp)",
                borderRadius: "3px",
                backgroundColor: "rgba(178,58,46,0.04)",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              borderRadius: "3px",
              letterSpacing: "0.04em",
            }}
          >
            {loading
              ? t("auth.loading")
              : mode === "login"
                ? t("auth.submitLogin")
                : t("auth.submitSignup")}
          </button>
        </form>

        <div
          className="mt-6 text-xs"
          style={{ color: "var(--ink-text)", opacity: 0.7 }}
        >
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
            }}
            className="underline underline-offset-2"
            style={{ color: "var(--steel)" }}
          >
            {mode === "login" ? t("auth.toggleToSignup") : t("auth.toggleToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  align,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  align: "left" | "right";
}) {
  return (
    <label className="block">
      <span
        className="block font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
        style={{ color: "var(--brass)" }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        dir="ltr"
        className="w-full px-3 py-2.5 text-sm bg-transparent outline-none focus:border-[var(--steel)]"
        style={{
          color: "var(--ink-text)",
          border: "1px solid var(--hairline)",
          borderRadius: "3px",
          textAlign: align,
          fontFamily: "var(--font-mono)",
        }}
      />
    </label>
  );
}

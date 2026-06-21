import { useTranslation, type Locale } from "@/i18n/I18nProvider";

export function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  const options: { value: Locale; label: string }[] = [
    { value: "ar", label: "AR" },
    { value: "en", label: "EN" },
  ];
  return (
    <div
      className="inline-flex items-center gap-0.5 font-mono text-[10px] tracking-[0.18em] p-0.5"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "3px",
      }}
      role="group"
      aria-label="Language"
    >
      {options.map((opt) => {
        const active = locale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            className="px-2.5 py-1 transition-colors"
            style={{
              backgroundColor: active ? "var(--paper)" : "transparent",
              color: active ? "var(--ink-text)" : "var(--muted-text)",
              border: active ? "1px solid var(--hairline)" : "1px solid transparent",
              borderRadius: "2px",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
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

/**
 * Fixed-position language toggle for pages without the sidebar (auth, full-screen).
 * Sits in the top-inline-start corner; mirrors automatically in RTL.
 */
export function FloatingLanguageToggle() {
  return (
    <div className="fixed top-4 start-4 z-50">
      <LanguageToggle />
    </div>
  );
}

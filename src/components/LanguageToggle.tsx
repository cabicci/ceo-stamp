import { useTranslation, type Locale } from "@/i18n/I18nProvider";

export function LanguageToggle() {
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

/**
 * Fixed-position language toggle for pages without the sidebar (auth, full-screen).
 * Sits in the top-inline-start corner; mirrors automatically in RTL.
 * Uses an ink-tinted backdrop so it stays legible on paper-toned pages.
 */
export function FloatingLanguageToggle() {
  return (
    <div
      className="fixed top-4 start-4 z-50 p-1.5"
      style={{
        backgroundColor: "var(--ink)",
        borderRadius: "3px",
        boxShadow: "0 1px 2px rgba(20,22,26,0.12)",
      }}
    >
      <LanguageToggle />
    </div>
  );
}

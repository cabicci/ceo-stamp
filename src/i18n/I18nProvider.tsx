import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export type Locale = "ar" | "en";
export type Direction = "rtl" | "ltr";

const dictionaries = { ar, en } as const;
const STORAGE_KEY = "marketing-ceo.locale";
const DEFAULT_LOCALE: Locale = "ar";

type Dict = Record<string, unknown>;

function resolvePath(
  dict: Dict,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Dict)[key] : undefined), dict);
  let resolved = typeof value === "string" ? value : path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return resolved;
}

type I18nContextValue = {
  locale: Locale;
  dir: Direction;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") {
        setLocaleState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const dir: Direction = locale === "ar" ? "rtl" : "ltr";

  // Sync <html> lang/dir
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale] as Dict;
    return {
      locale,
      dir,
      setLocale: (l) => {
        setLocaleState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          // ignore
        }
      },
      t: (key: string, vars?: Record<string, string | number>) => resolvePath(dict, key, vars),
    };
  }, [locale, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useTranslation() {
  const { t, locale, dir, setLocale } = useI18n();
  return { t, locale, dir, setLocale };
}

import { useCallback, useMemo, useState } from "react";
import { createTranslator, detectInitialLocale, localeStorageKey, type Locale } from "./messages";

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = safeLocalStorageGet(localeStorageKey);
    return detectInitialLocale(window.navigator.language || "en", stored);
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    safeLocalStorageSet(localeStorageKey, nextLocale);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  return { locale, setLocale, t };
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Locale persistence is a convenience; the app remains usable without it.
  }
}

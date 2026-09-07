import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LOCALE_KEY = "backline_locale";

export function useLocale() {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<string>(
    () => localStorage.getItem(LOCALE_KEY) || navigator.language || "en"
  );

  useEffect(() => {
    // If the locale is hi-IN, use it. Otherwise default to en for now to avoid missing translations.
    const activeLocale = locale === "hi-IN" ? "hi-IN" : "en";
    i18n.changeLanguage(activeLocale);
    localStorage.setItem(LOCALE_KEY, activeLocale);
  }, [locale, i18n]);

  return { locale, setLocale };
}

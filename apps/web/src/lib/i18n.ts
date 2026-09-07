import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslations from "../locales/en/translation.json";
import hiINTranslations from "../locales/hi-IN/translation.json";

// Extract translation keys for TS inference
export type TranslationKeys = keyof typeof enTranslations;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      "hi-IN": {
        translation: hiINTranslations,
      },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
  });

export default i18n;

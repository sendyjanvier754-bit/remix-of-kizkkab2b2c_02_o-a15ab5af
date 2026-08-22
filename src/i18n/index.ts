import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ht from './locales/ht.json';

// Auto-merged modular translation files: src/i18n/locales/modules/<area>.<lang>.json
const moduleFiles = import.meta.glob('./locales/modules/*.json', { eager: true }) as Record<string, any>;

const mergeModules = (lang: string) => {
  const out: Record<string, any> = {};
  for (const [path, mod] of Object.entries(moduleFiles)) {
    const match = path.match(/\/([^/]+)\.([a-z]{2})\.json$/);
    if (!match || match[2] !== lang) continue;
    const data = (mod as any).default ?? mod;
    for (const [k, v] of Object.entries(data)) {
      out[k] = typeof v === 'object' && v !== null && typeof out[k] === 'object'
        ? { ...out[k], ...(v as object) }
        : v;
    }
  }
  return out;
};

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ht', label: 'Kreyòl', flag: '🇭🇹' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: { ...es, ...mergeModules('es') } },
      en: { translation: { ...en, ...mergeModules('en') } },
      fr: { translation: { ...fr, ...mergeModules('fr') } },
      ht: { translation: { ...ht, ...mergeModules('ht') } },
    },
    fallbackLng: 'fr',
    supportedLngs: ['es', 'en', 'fr', 'ht'],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'i18n_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'fr'],
    detection: {
      // Detection order: localStorage first, then browser language
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18n_language',
      cacheUserLanguage: true,
    },
    interpolation: {
      // React already escapes by default
      escapeValue: false,
    },
  });

export default i18n;

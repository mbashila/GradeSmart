import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import sw from './locales/sw.json';
import ar from './locales/ar.json';
import af from './locales/af.json';
import zu from './locales/zu.json';
import st from './locales/st.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import de from './locales/de.json';
import it from './locales/it.json';

const LANGUAGE_KEY = '@gradesmart:language';

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'af', label: 'Afrikaans', nativeLabel: 'Afrikaans' },
  { code: 'zu', label: 'Zulu', nativeLabel: 'isiZulu' },
  { code: 'st', label: 'Sotho', nativeLabel: 'Sesotho' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  sw: { translation: sw },
  ar: { translation: ar },
  af: { translation: af },
  zu: { translation: zu },
  st: { translation: st },
  zh: { translation: zh },
  hi: { translation: hi },
  de: { translation: de },
  it: { translation: it },
};

const initI18n = async () => {
  let savedLanguage = 'en';
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) savedLanguage = stored;
  } catch (e) {
    // fallback to English
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });
};

export const changeLanguage = async (langCode) => {
  await i18n.changeLanguage(langCode);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, langCode);
  } catch (e) {
    // no-op
  }
};

initI18n();

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import fr from './locales/fr.json';

// Get device language as fallback
const getDeviceLanguage = (): string => {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      return locales[0].languageCode || 'en';
    }
  } catch (error) {
    // Fallback if getLocales fails
  }
  return 'en';
};

const deviceLanguage = getDeviceLanguage();

// Initialize i18n synchronously with device language
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    lng: deviceLanguage,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    interpolation: { escapeValue: false },
  });

// Update language from stored preference if available (async, non-blocking)
AsyncStorage.getItem('language_preference')
  .then((storedLanguage) => {
    if (storedLanguage === 'en' || storedLanguage === 'fr') {
      i18n.changeLanguage(storedLanguage);
    }
  })
  .catch((error) => {
    // Silently fail - device language is already set
    console.debug('Could not load stored language preference:', error);
  });

export default i18n;


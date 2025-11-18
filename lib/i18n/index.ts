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

// Get stored language preference synchronously (with fallback)
const getStoredLanguage = (): string => {
  try {
    // Use synchronous getItemSync if available, otherwise default to device language
    // Note: AsyncStorage doesn't have sync methods, so we'll initialize with device language
    // and update asynchronously
    return getDeviceLanguage();
  } catch (error) {
    return getDeviceLanguage();
  }
};

const deviceLanguage = getDeviceLanguage();
const initialLanguage = getStoredLanguage();

// Initialize i18n synchronously with device language (will be updated if stored preference differs)
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    lng: initialLanguage,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    interpolation: { escapeValue: false },
  });

// Update language from stored preference immediately (async, but runs before most components mount)
// This ensures the language is set correctly before pages render
(async () => {
  try {
    const storedLanguage = await AsyncStorage.getItem('language_preference');
    if (storedLanguage === 'en' || storedLanguage === 'fr') {
      // Only change if different from current to avoid unnecessary updates
      if (i18n.language !== storedLanguage) {
        await i18n.changeLanguage(storedLanguage);
      }
    }
  } catch (error) {
    // Silently fail - device language is already set
    console.debug('Could not load stored language preference:', error);
  }
})();

export default i18n;


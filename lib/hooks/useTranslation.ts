import { useCallback } from "react";
import { useTranslation as useI18nTranslation } from "react-i18next";

/**
 * Custom hook for translations with type safety
 * Properly triggers re-renders when language changes
 * Usage: const { t } = useTranslation(); t('auth.login')
 */
export const useTranslation = () => {
  const { t: i18nT, i18n } = useI18nTranslation();

  // Translate function that properly depends on i18nT to trigger re-renders
  const translate = useCallback(
    (key: string, options?: any): string => {
      const result = i18nT(key, options);
      return typeof result === "string" ? result : String(result);
    },
    [i18nT], // Depend on i18nT so it updates when language changes
  );

  const changeLanguage = useCallback(
    async (lang: "en" | "fr") => {
      // Save to AsyncStorage immediately to ensure consistency
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem("language_preference", lang);
      // Change language in i18n - this will trigger re-renders in all components using useTranslation
      await i18n.changeLanguage(lang);
    },
    [i18n],
  );

  // Return object directly - react-i18next's useTranslation already handles re-renders
  // The translate function will be recreated when i18nT changes (which happens on language change)
  return {
    t: translate,
    changeLanguage,
    currentLanguage: i18n.language,
  };
};

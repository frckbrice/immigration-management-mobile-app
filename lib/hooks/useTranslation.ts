import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations with type safety
 * Usage: const t = useTranslation(); t('auth.login')
 */
export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  return {
    t: (key: string, options?: any): string => {
      const result = t(key, options);
      return typeof result === 'string' ? result : String(result);
    },
    changeLanguage: (lang: 'en' | 'fr') => i18n.changeLanguage(lang),
    currentLanguage: i18n.language,
  };
};


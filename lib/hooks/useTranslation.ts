import { useCallback, useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations with type safety
 * Usage: const t = useTranslation(); t('auth.login')
 */
export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const translate = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, options);
      return typeof result === 'string' ? result : String(result);
    },
    [t]
  );

  const changeLanguage = useCallback(
    (lang: 'en' | 'fr') => i18n.changeLanguage(lang),
    [i18n]
  );

  return useMemo(
    () => ({
      t: translate,
      changeLanguage,
      currentLanguage: i18n.language,
    }),
    [translate, changeLanguage, i18n.language]
  );
};


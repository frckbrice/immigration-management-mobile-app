import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsService } from '../../lib/services/settingsService';
import { logger } from '../../lib/utils/logger';
import type { NotificationSettings } from '../../lib/types';

const THEME_PREFERENCE_KEY = 'theme_preference';
const LANGUAGE_PREFERENCE_KEY = 'language_preference';

interface SettingsState {
    settings: NotificationSettings | null;
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;
    fetchSettings: () => Promise<NotificationSettings | null>;
    updateSettings: (partial: Partial<NotificationSettings>) => Promise<NotificationSettings | null>;
    setSettings: (settings: NotificationSettings | null) => void;
    clearError: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: null,
    isLoading: false,
    isUpdating: false,
    error: null,

    fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
            const backendSettings = await settingsService.getSettings();
            const [storedTheme, storedLanguage] = await AsyncStorage.multiGet([
                THEME_PREFERENCE_KEY,
                LANGUAGE_PREFERENCE_KEY,
            ]);

            const themePreference = (storedTheme[1] as NotificationSettings['themePreference']) || 'system';
            const languagePreference = (storedLanguage[1] === 'fr' ? 'fr' : 'en') as NotificationSettings['languagePreference'];

            const mergedSettings: NotificationSettings = {
                emailNotifications: backendSettings.emailNotifications,
                pushNotifications: backendSettings.pushNotifications,
                smsNotifications: backendSettings.smsNotifications,
                themePreference,
                languagePreference,
            };

            set({ settings: mergedSettings, isLoading: false });
            return mergedSettings;
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || 'Failed to load notification settings';
            logger.error('Failed to fetch notification settings', error);
            set({ error: message, isLoading: false });
            return null;
        }
    },

    updateSettings: async (partial) => {
        set({ isUpdating: true, error: null });
        try {
            const backendPartial: Partial<NotificationSettings> = {};
            const localPartial: Partial<NotificationSettings> = {};

            Object.entries(partial).forEach(([key, value]) => {
                if (key === 'themePreference') {
                    localPartial.themePreference = value as NotificationSettings['themePreference'];
                } else if (key === 'languagePreference') {
                    localPartial.languagePreference = value as NotificationSettings['languagePreference'];
                } else {
                    backendPartial[key as keyof NotificationSettings] = value as any;
                }
            });

            if (localPartial.themePreference) {
                await AsyncStorage.setItem(THEME_PREFERENCE_KEY, localPartial.themePreference);
            }

            if (localPartial.languagePreference) {
                await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, localPartial.languagePreference);
            }

            const hasBackendPayload = Object.keys(backendPartial).length > 0;
            const backendSettings: NotificationSettings | null = hasBackendPayload
                ? await settingsService.updateSettings(backendPartial)
                : get().settings
                    ? {
                        emailNotifications: get().settings!.emailNotifications,
                        pushNotifications: get().settings!.pushNotifications,
                        smsNotifications: get().settings!.smsNotifications,
                    }
                    : await settingsService.getSettings();

            const mergedSettings: NotificationSettings = {
                emailNotifications: backendSettings.emailNotifications,
                pushNotifications: backendSettings.pushNotifications,
                smsNotifications: backendSettings.smsNotifications,
                themePreference: localPartial.themePreference ?? get().settings?.themePreference ?? 'system',
                languagePreference: localPartial.languagePreference ?? get().settings?.languagePreference ?? 'en',
            };

            set({ settings: mergedSettings, isUpdating: false });
            return mergedSettings;
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || 'Failed to update notification settings';
            logger.error('Failed to update notification settings', error);
            set({ error: message, isUpdating: false });
            return null;
        }
    },

    setSettings: (settings) => set({ settings }),

    clearError: () => set({ error: null }),
}));

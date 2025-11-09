import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { templatesService, type Template } from '@/lib/services/templatesService';
import { logger } from '@/lib/utils/logger';

const TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface FetchOptions {
  force?: boolean;
}

interface TemplatesState {
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchTemplates: (options?: FetchOptions) => Promise<Template[]>;
  setTemplates: (templates: Template[], fetchedAt?: number) => void;
  clearTemplates: () => void;
  clearError: () => void;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],
      isLoading: false,
      error: null,
      lastFetchedAt: null,

      fetchTemplates: async (options?: FetchOptions) => {
        const { templates, lastFetchedAt } = get();
        const now = Date.now();
        const shouldUseCache =
          !options?.force &&
          templates.length > 0 &&
          typeof lastFetchedAt === 'number' &&
          now - lastFetchedAt < TEMPLATE_CACHE_TTL;

        if (shouldUseCache) {
          logger.debug('Templates cache hit', { templatesCount: templates.length });
          return templates;
        }

        set({ isLoading: true, error: null });

        try {
          const fetchedTemplates = await templatesService.getTemplates();
          set({
            templates: fetchedTemplates,
            isLoading: false,
            lastFetchedAt: now,
          });
          return fetchedTemplates;
        } catch (error: any) {
          const message = error?.message || 'Unable to load templates.';
          logger.error('Failed to fetch templates', error);
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      setTemplates: (templates: Template[], fetchedAt?: number) => {
        set({
          templates,
          lastFetchedAt: fetchedAt ?? Date.now(),
        });
      },

      clearTemplates: () => {
        set({
          templates: [],
          lastFetchedAt: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'templates-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        templates: state.templates,
        lastFetchedAt: state.lastFetchedAt,
      }),
    },
  ),
);


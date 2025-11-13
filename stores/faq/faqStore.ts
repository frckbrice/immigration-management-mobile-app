import { create } from 'zustand';
import { faqService, type FAQItem } from '@/lib/services/faqService';
import { logger } from '@/lib/utils/logger';
import { faqCache } from '@/lib/services/faqCache';

const STALE_TIME_MS = 15 * 60 * 1000; // 15 minutes

interface FaqState {
  faqs: FAQItem[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchFAQs: (options?: { force?: boolean }) => Promise<FAQItem[]>;
  setFaqs: (items: FAQItem[]) => void;
  clearCache: () => void;
}

export const useFaqStore = create<FaqState>((set, get) => ({
  faqs: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchFAQs: async (options) => {
    const force = options?.force ?? false;
    const { faqs, lastFetchedAt } = get();
    const isStale = !lastFetchedAt || Date.now() - lastFetchedAt > STALE_TIME_MS;

    if (!force && faqs.length > 0 && !isStale) {
      return faqs;
    }

    if (!force && faqs.length === 0) {
      const cached = await faqCache.get();
      if (cached?.items?.length) {
        set({
          faqs: cached.items,
          lastFetchedAt: cached.fetchedAt,
          isLoading: false,
          error: null,
        });
        if (!isStale) {
          return cached.items;
        }
      }
    }

    set({ isLoading: true, error: null });

    try {
      const data = await faqService.getAllFAQs();
      set({
        faqs: data,
        lastFetchedAt: Date.now(),
        isLoading: false,
      });
      await faqCache.set(data);
      return data;
    } catch (error: any) {
      const message = error?.message || 'Unable to load FAQs';
      logger.error('Failed to fetch FAQs', error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setFaqs: (items) => set({ faqs: items, lastFetchedAt: Date.now() }),

  clearCache: async () => {
    set({ faqs: [], lastFetchedAt: null });
    await faqCache.clear();
  },
}));



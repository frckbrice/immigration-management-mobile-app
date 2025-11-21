import { create } from "zustand";
import { legalService } from "@/lib/services/legalService";
import { logger } from "@/lib/utils/logger";

type LegalDocumentType = "terms" | "privacy";

interface CacheEntry {
  content: string;
  fetchedAt: number;
  language: string;
}

interface LegalState {
  cache: Record<LegalDocumentType, Record<string, CacheEntry>>;
  loading: Record<LegalDocumentType, boolean>;
  error: Record<LegalDocumentType, string | null>;
  getDocument: (
    type: LegalDocumentType,
    language: string,
  ) => CacheEntry | undefined;
  fetchDocument: (
    type: LegalDocumentType,
    language: string,
    options?: { force?: boolean },
  ) => Promise<string>;
  clearError: (type: LegalDocumentType) => void;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const useLegalStore = create<LegalState>((set, get) => ({
  cache: {
    terms: {},
    privacy: {},
  },
  loading: {
    terms: false,
    privacy: false,
  },
  error: {
    terms: null,
    privacy: null,
  },
  getDocument: (type, language) => get().cache[type]?.[language],
  clearError: (type) => {
    set((state) => ({
      error: {
        ...state.error,
        [type]: null,
      },
    }));
  },
  fetchDocument: async (type, language, options) => {
    const force = options?.force ?? false;
    const state = get();
    const cacheEntry = state.cache[type]?.[language];
    const isFresh = cacheEntry
      ? Date.now() - cacheEntry.fetchedAt < CACHE_TTL
      : false;

    if (cacheEntry && !force && isFresh) {
      return cacheEntry.content;
    }

    set((prev) => ({
      loading: {
        ...prev.loading,
        [type]: true,
      },
      error: {
        ...prev.error,
        [type]: null,
      },
    }));

    try {
      const content =
        type === "terms"
          ? await legalService.getTerms(language)
          : await legalService.getPrivacy(language);

      set((prev) => ({
        cache: {
          ...prev.cache,
          [type]: {
            ...prev.cache[type],
            [language]: {
              content,
              fetchedAt: Date.now(),
              language,
            },
          },
        },
        loading: {
          ...prev.loading,
          [type]: false,
        },
      }));

      return content;
    } catch (error: any) {
      const message = error?.message || "Unable to load content";
      logger.error("Failed to fetch legal content", error);
      set((prev) => ({
        error: {
          ...prev.error,
          [type]: message,
        },
        loading: {
          ...prev.loading,
          [type]: false,
        },
      }));
      throw error;
    }
  },
}));

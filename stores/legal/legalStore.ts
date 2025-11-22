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
  preloadDocuments: (language: string) => Promise<void>;
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
    const hasContent = cacheEntry?.content?.trim().length > 0;

    // Only return cached content if:
    // 1. Cache exists
    // 2. Content is not empty
    // 3. Cache is still fresh
    // 4. Not forcing a refresh
    if (cacheEntry && hasContent && !force && isFresh) {
      return cacheEntry.content;
    }

    // Prevent duplicate fetches - if already loading, wait for existing fetch
    // This prevents race conditions when preloadDocuments and page fetch run simultaneously
    if (state.loading[type] && !force) {
      // Wait a bit and check cache again (the in-progress fetch might complete)
      await new Promise((resolve) => setTimeout(resolve, 100));
      const updatedState = get();
      const updatedCache = updatedState.cache[type]?.[language];
      if (updatedCache?.content?.trim().length > 0) {
        return updatedCache.content;
      }
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
  preloadDocuments: async (language) => {
    // Preload both terms and privacy documents in parallel
    // Only fetch if not already cached or cache is stale
    const state = get();
    const promises: Promise<string>[] = [];

    // Check terms
    const termsCache = state.cache.terms?.[language];
    const termsIsFresh = termsCache
      ? Date.now() - termsCache.fetchedAt < CACHE_TTL
      : false;
    const termsHasContent = termsCache?.content?.trim().length > 0;

    if (!termsHasContent || !termsIsFresh) {
      promises.push(get().fetchDocument("terms", language, { force: false }));
    }

    // Check privacy
    const privacyCache = state.cache.privacy?.[language];
    const privacyIsFresh = privacyCache
      ? Date.now() - privacyCache.fetchedAt < CACHE_TTL
      : false;
    const privacyHasContent = privacyCache?.content?.trim().length > 0;

    if (!privacyHasContent || !privacyIsFresh) {
      promises.push(get().fetchDocument("privacy", language, { force: false }));
    }

    // Fetch both in parallel, but don't throw errors - they'll be handled by individual fetchDocument calls
    if (promises.length > 0) {
      await Promise.allSettled(promises).catch(() => {
        // Errors are already handled in fetchDocument
      });
    }
  },
}));

import { create } from "zustand";
import { casesService } from "../../lib/services/casesService";
import { logger } from "../../lib/utils/logger";
import { secureStorage } from "../../lib/storage/secureStorage";
import type { Case, CreateCaseRequest } from "../../lib/types";
import { useAuthStore } from "../auth/authStore";

const CASES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CASES_CACHE_KEY_PREFIX = "cases_cache_"; // Will be suffixed with user ID
const CASE_BY_ID_CACHE_KEY_PREFIX = "case_by_id_";

interface CasesCacheEntry {
  cases: Case[];
  filters: string;
  fetchedAt: number;
  userId?: string; // Store user ID for verification
}

// Helper to get user-specific cache key
const getCasesCacheKey = (userId: string | null | undefined): string => {
  if (!userId) return "cases_cache_no_user";
  return `${CASES_CACHE_KEY_PREFIX}${userId}`;
};

interface CasesState {
  cases: Case[];
  isLoading: boolean;
  error: string | null;
  selectedCase: Case | null;
  currentFilters: {
    status?: string;
    serviceType?: string;
    priority?: string;
    search?: string;
  } | null;
  lastFetched: number | null;

  // Actions
  fetchCases: (
    filters?: {
      status?: string;
      serviceType?: string;
      priority?: string;
      search?: string;
    },
    options?: { force?: boolean },
  ) => Promise<void>;
  fetchCaseById: (
    caseId: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  createCase: (data: CreateCaseRequest) => Promise<Case | null>;
  updateCase: (caseId: string, data: Partial<Case>) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  setSelectedCase: (caseItem: Case | null) => void;
  clearError: () => void;
  clearCache: () => Promise<void>;
}

const buildFiltersKey = (filters?: {
  status?: string;
  serviceType?: string;
  priority?: string;
  search?: string;
}) => {
  return JSON.stringify({
    status: filters?.status || "all",
    serviceType: filters?.serviceType || "all",
    priority: filters?.priority || "all",
    search: (filters?.search || "").trim(),
  });
};

export const useCasesStore = create<CasesState>((set, get) => ({
  cases: [],
  isLoading: false,
  error: null,
  selectedCase: null,
  currentFilters: null,
  lastFetched: null,

  fetchCases: async (filters, options) => {
    const force = options?.force || false;
    const filtersKey = buildFiltersKey(filters);
    const now = Date.now();

    // Get current user ID from auth store
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) {
      logger.warn("Cannot fetch cases: user not authenticated");
      set({ error: "User not authenticated", isLoading: false });
      return;
    }

    const cacheKey = getCasesCacheKey(userId);

    // Check in-memory cache first
    const lastFetched = get().lastFetched;
    if (!force && get().cases.length > 0 && lastFetched !== null) {
      const timeSinceFetch = now - lastFetched;
      if (timeSinceFetch < CASES_CACHE_TTL) {
        logger.debug("Cases cache hit (in-memory)", { timeSinceFetch });
        set({ currentFilters: filters || null });
        return;
      }
    }

    // Check persistent cache (user-specific)
    if (!force) {
      try {
        const cached = await secureStorage.get<CasesCacheEntry>(cacheKey);
        // Verify cache is for current user and matches filters
        if (
          cached &&
          cached.userId === userId &&
          cached.filters === filtersKey &&
          now - cached.fetchedAt < CASES_CACHE_TTL
        ) {
          logger.debug("Cases cache hit (persistent)", { filtersKey, userId });
          set({
            cases: cached.cases,
            isLoading: false,
            error: null,
            currentFilters: filters || null,
            lastFetched: cached.fetchedAt,
          });
          return;
        }
      } catch (error) {
        logger.debug("Failed to read cases cache", error);
      }
    }

    set({ isLoading: true, error: null, currentFilters: filters || null });
    try {
      const currentFilters = filters || get().currentFilters || undefined;
      const cases = await casesService.getCases(currentFilters || undefined);
      const fetchedAt = Date.now();

      // Update in-memory cache
      set({ cases, isLoading: false, lastFetched: fetchedAt });

      // Update persistent cache with user ID
      try {
        await secureStorage.set(cacheKey, {
          cases,
          filters: filtersKey,
          fetchedAt,
          userId, // Store user ID for verification
        });
      } catch (error) {
        logger.debug("Failed to save cases cache", error);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to fetch cases";
      logger.error("Error fetching cases", error);

      // Try to use cached data on error (only if same user)
      try {
        const cached = await secureStorage.get<CasesCacheEntry>(cacheKey);
        // Verify cache is for current user
        if (cached && cached.userId === userId && cached.cases.length > 0) {
          logger.info("Using cached cases data due to fetch error", { userId });
          set({
            cases: cached.cases,
            isLoading: false,
            error: null,
            currentFilters: filters || null,
            lastFetched: cached.fetchedAt,
          });
          return;
        }
      } catch (cacheError) {
        logger.debug("Failed to read cases cache on error", cacheError);
      }

      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchCaseById: async (caseId: string, options) => {
    const force = options?.force || false;
    const cacheKey = `${CASE_BY_ID_CACHE_KEY_PREFIX}${caseId}`;
    const now = Date.now();

    // Check persistent cache first
    if (!force) {
      try {
        const cached = await secureStorage.get<{
          case: Case;
          fetchedAt: number;
        }>(cacheKey);
        if (cached && now - cached.fetchedAt < CASES_CACHE_TTL) {
          logger.debug("Case by ID cache hit", { caseId });
          set({ selectedCase: cached.case, isLoading: false });
          return;
        }
      } catch (error) {
        logger.debug("Failed to read case cache", error);
      }
    }

    set({ isLoading: true, error: null });
    try {
      const caseItem = await casesService.getCaseById(caseId);
      const fetchedAt = Date.now();

      set({ selectedCase: caseItem, isLoading: false });

      // Update persistent cache
      try {
        await secureStorage.set(cacheKey, { case: caseItem, fetchedAt });
      } catch (error) {
        logger.debug("Failed to save case cache", error);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to fetch case";
      logger.error("Error fetching case", error);

      // Try to use cached data on error
      try {
        const cached = await secureStorage.get<{
          case: Case;
          fetchedAt: number;
        }>(cacheKey);
        if (cached) {
          logger.info("Using cached case data due to fetch error");
          set({ selectedCase: cached.case, isLoading: false });
          return;
        }
      } catch (cacheError) {
        logger.debug("Failed to read case cache on error", cacheError);
      }

      set({ error: errorMessage, isLoading: false });
    }
  },

  createCase: async (data: CreateCaseRequest) => {
    set({ isLoading: true, error: null });
    try {
      const newCase = await casesService.createCase(data);
      const fetchedAt = Date.now();

      set((state) => ({
        cases: [newCase, ...state.cases],
        isLoading: false,
        lastFetched: fetchedAt,
      }));

      // Invalidate cache
      get().clearCache();

      return newCase;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to create case";
      logger.error("Error creating case", error);
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  updateCase: async (caseId: string, data: Partial<Case>) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCase = await casesService.updateCase(caseId, data);
      const fetchedAt = Date.now();

      set((state) => ({
        cases: state.cases.map((c) => (c.id === caseId ? updatedCase : c)),
        selectedCase:
          state.selectedCase?.id === caseId ? updatedCase : state.selectedCase,
        isLoading: false,
        lastFetched: fetchedAt,
      }));

      // Update cache for this specific case
      try {
        const cacheKey = `${CASE_BY_ID_CACHE_KEY_PREFIX}${caseId}`;
        await secureStorage.set(cacheKey, { case: updatedCase, fetchedAt });
      } catch (error) {
        logger.debug("Failed to update case cache", error);
      }

      // Invalidate main cache
      get().clearCache();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to update case";
      logger.error("Error updating case", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  deleteCase: async (caseId: string) => {
    set({ isLoading: true, error: null });
    try {
      await casesService.deleteCase(caseId);

      set((state) => ({
        cases: state.cases.filter((c) => c.id !== caseId),
        selectedCase:
          state.selectedCase?.id === caseId ? null : state.selectedCase,
        isLoading: false,
      }));

      // Invalidate cache
      get().clearCache();

      // Remove case-specific cache
      try {
        const cacheKey = `${CASE_BY_ID_CACHE_KEY_PREFIX}${caseId}`;
        await secureStorage.delete(cacheKey);
      } catch (error) {
        logger.debug("Failed to delete case cache", error);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to delete case";
      logger.error("Error deleting case", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  setSelectedCase: (caseItem: Case | null) => {
    set({ selectedCase: caseItem });
  },

  clearError: () => {
    set({ error: null });
  },

  clearCache: async () => {
    try {
      const userId = useAuthStore.getState().user?.uid;
      if (userId) {
        const cacheKey = getCasesCacheKey(userId);
        await secureStorage.delete(cacheKey);
      }
      set({ lastFetched: null });
    } catch (error) {
      logger.debug("Failed to clear cases cache", error);
    }
  },
}));

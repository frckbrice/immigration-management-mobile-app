import { create } from 'zustand';
import { casesService } from '../../lib/services/casesService';
import { logger } from '../../lib/utils/logger';
import type { Case, CreateCaseRequest } from '../../lib/types';

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

  // Actions
  fetchCases: (filters?: {
    status?: string;
    serviceType?: string;
    priority?: string;
    search?: string;
  }) => Promise<void>;
  fetchCaseById: (caseId: string) => Promise<void>;
  createCase: (data: CreateCaseRequest) => Promise<Case | null>;
  updateCase: (caseId: string, data: Partial<Case>) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  setSelectedCase: (caseItem: Case | null) => void;
  clearError: () => void;
}

export const useCasesStore = create<CasesState>((set, get) => ({
  cases: [],
  isLoading: false,
  error: null,
  selectedCase: null,
  currentFilters: null,

  fetchCases: async (filters) => {
    set({ isLoading: true, error: null, currentFilters: filters || null });
    try {
      const currentFilters = filters || get().currentFilters || undefined;
      const cases = await casesService.getCases(currentFilters || undefined);
      set({ cases, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch cases';
      logger.error('Error fetching cases', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchCaseById: async (caseId: string) => {
    set({ isLoading: true, error: null });
    try {
      const caseItem = await casesService.getCaseById(caseId);
      set({ selectedCase: caseItem, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch case';
      logger.error('Error fetching case', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  createCase: async (data: CreateCaseRequest) => {
    set({ isLoading: true, error: null });
    try {
      const newCase = await casesService.createCase(data);
      set((state) => ({
        cases: [newCase, ...state.cases],
        isLoading: false,
      }));
      return newCase;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create case';
      logger.error('Error creating case', error);
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  updateCase: async (caseId: string, data: Partial<Case>) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCase = await casesService.updateCase(caseId, data);
      set((state) => ({
        cases: state.cases.map((c) => (c.id === caseId ? updatedCase : c)),
        selectedCase: state.selectedCase?.id === caseId ? updatedCase : state.selectedCase,
        isLoading: false,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update case';
      logger.error('Error updating case', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  deleteCase: async (caseId: string) => {
    set({ isLoading: true, error: null });
    try {
      await casesService.deleteCase(caseId);
      set((state) => ({
        cases: state.cases.filter((c) => c.id !== caseId),
        selectedCase: state.selectedCase?.id === caseId ? null : state.selectedCase,
        isLoading: false,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete case';
      logger.error('Error deleting case', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  setSelectedCase: (caseItem: Case | null) => {
    set({ selectedCase: caseItem });
  },

  clearError: () => {
    set({ error: null });
  },
}));


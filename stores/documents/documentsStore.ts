import { create } from "zustand";
import { documentsService } from "../../lib/services/documentsService";
import { logger } from "../../lib/utils/logger";
import type { Document, UploadDocumentRequest } from "../../lib/types";
import { useAuthStore } from "../auth/authStore";

const DOCUMENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type DocumentFilters = {
  caseId?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

interface DocumentsCacheEntry {
  key: string;
  documents: Document[];
  fetchedAt: number;
  userId: string;
}

interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  uploading: boolean;
  currentFilters: DocumentFilters | null;
  documentsCache: Record<string, DocumentsCacheEntry>;

  fetchDocuments: (
    filters?: DocumentFilters,
    options?: { force?: boolean },
  ) => Promise<void>;
  fetchDocumentById: (documentId: string) => Promise<void>;
  uploadDocument: (data: UploadDocumentRequest) => Promise<Document | null>;
  deleteDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string) => Promise<void>;
  clearError: () => void;
  clearCache: () => void;
}

const buildCacheKey = (filters?: DocumentFilters, userId?: string | null) => {
  const normalized = {
    userId: userId || "no_user",
    caseId: filters?.caseId ?? "all",
    type: filters?.type ?? "all",
    status: filters?.status ?? "all",
    search: (filters?.search ?? "").trim(),
    page: filters?.page ?? 1,
    limit: filters?.limit ?? 20,
  };

  return JSON.stringify(normalized);
};

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,
  uploading: false,
  currentFilters: null,
  documentsCache: {},

  fetchDocuments: async (filters, options) => {
    const userId = useAuthStore.getState().user?.uid;
    const cacheKey = buildCacheKey(filters, userId);
    const now = Date.now();
    const shouldUseCache = !options?.force;

    if (shouldUseCache) {
      const cached = get().documentsCache[cacheKey];
      if (
        cached &&
        cached.userId === userId &&
        now - cached.fetchedAt < DOCUMENTS_CACHE_TTL
      ) {
        set({
          documents: cached.documents,
          isLoading: false,
          error: null,
          currentFilters: filters || null,
        });
        logger.debug("Documents cache hit", {
          cacheKey,
          count: cached.documents.length,
        });
        return;
      }
    }

    set({ isLoading: true, error: null, currentFilters: filters || null });
    try {
      const documents = await documentsService.getDocuments(filters);
      set((state) => ({
        documents,
        isLoading: false,
        documentsCache: {
          ...state.documentsCache,
          [cacheKey]: {
            key: cacheKey,
            documents,
            fetchedAt: now,
            userId: userId || "",
          },
        },
      }));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch documents";
      logger.error("Error fetching documents", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchDocumentById: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsService.getDocumentById(documentId);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch document";
      logger.error("Error fetching document", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  uploadDocument: async (data: UploadDocumentRequest) => {
    set({ uploading: true, error: null });
    try {
      const document = await documentsService.uploadDocument(data);
      set((state) => ({
        documents: [document, ...state.documents],
        uploading: false,
        documentsCache: {},
      }));
      return document;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to upload document";
      logger.error("Error uploading document", error);
      set({ error: errorMessage, uploading: false });
      return null;
    }
  },

  deleteDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsService.deleteDocument(documentId);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        isLoading: false,
        documentsCache: {},
      }));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to delete document";
      logger.error("Error deleting document", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  downloadDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsService.downloadDocument(documentId);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to download document";
      logger.error("Error downloading document", error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearCache: () => {
    set({ documentsCache: {}, documents: [] });
  },
}));

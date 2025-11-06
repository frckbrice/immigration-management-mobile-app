import { create } from 'zustand';
import { documentsService } from '../../lib/services/documentsService';
import { logger } from '../../lib/utils/logger';
import type { Document, UploadDocumentRequest } from '../../lib/types';

interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  uploading: boolean;

  // Actions
  fetchDocuments: (caseId?: string) => Promise<void>;
  fetchDocumentById: (documentId: string) => Promise<void>;
  uploadDocument: (data: UploadDocumentRequest) => Promise<Document | null>;
  deleteDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string) => Promise<void>;
  clearError: () => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,
  uploading: false,

  fetchDocuments: async (caseId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const documents = await documentsService.getDocuments(caseId);
      set({ documents, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch documents';
      logger.error('Error fetching documents', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchDocumentById: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsService.getDocumentById(documentId);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch document';
      logger.error('Error fetching document', error);
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
      }));
      return document;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload document';
      logger.error('Error uploading document', error);
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
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete document';
      logger.error('Error deleting document', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  downloadDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsService.downloadDocument(documentId);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to download document';
      logger.error('Error downloading document', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));


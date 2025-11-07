import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { Document, UploadDocumentRequest } from '../types';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

const mapDocument = (doc: any): Document => ({
    id: doc.id,
    originalName: doc.originalName ?? doc.fileName,
    fileName: doc.fileName,
    documentType: doc.documentType,
    status: doc.status,
    uploadDate: doc.uploadDate,
    filePath: doc.filePath,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    caseId: doc.caseId,
    case: doc.case
        ? {
            id: doc.case.id,
            referenceNumber: doc.case.referenceNumber,
            serviceType: doc.case.serviceType,
        }
        : undefined,
    uploadedById: doc.uploadedById,
});

export const documentsService = {
    /**
     * Get all documents for the current user
     */
    async getDocuments(filters?: {
        caseId?: string;
        type?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<Document[]> {
        try {
            const params = new URLSearchParams();
            const page = filters?.page || 1;
            const limit = filters?.limit || 20;

            params.set('page', String(page));
            params.set('limit', String(limit));

            if (filters?.caseId) {
                params.set('caseId', filters.caseId);
            }

            if (filters?.type && filters.type !== 'all') {
                params.set('type', filters.type);
            }

            if (filters?.status && filters.status !== 'all') {
                params.set('status', filters.status);
            }

            if (filters?.search) {
                params.set('search', filters.search.trim());
            }

            const query = params.toString();
            const response = await apiClient.get<ApiResponse<{ documents: any[]; pagination: any }>>(
                query ? `/documents?${query}` : '/documents'
            );

            const documents = response.data.data?.documents || [];
            const mapped = documents.map(mapDocument);
            logger.info('Documents fetched successfully', { count: mapped.length });
            return mapped;
        } catch (error: any) {
            logger.error('Error fetching documents', error);
            throw error;
        }
    },

    /**
     * Get a single document by ID
     */
    async getDocumentById(documentId: string): Promise<Document> {
        try {
            const response = await apiClient.get<ApiResponse<{ document: any }>>(`/documents/${documentId}`);

            const document = response.data.data?.document;
            if (!document) {
                throw new Error(response.data.error || 'Document not found');
            }

            const mapped = mapDocument(document);
            logger.info('Document fetched successfully', { documentId });
            return mapped;
        } catch (error: any) {
            logger.error('Error fetching document', error);
            throw error;
        }
    },

    /**
     * Upload a new document
     */
    async uploadDocument(data: UploadDocumentRequest): Promise<Document> {
        try {
            const uploadData = {
                caseId: data.caseId,
                documentType: data.documentType,
                fileName: data.fileName,
                originalName: data.originalName ?? data.fileName,
                filePath: data.filePath,
                fileSize: data.fileSize ?? 0,
                mimeType: data.mimeType,
            };

            const response = await apiClient.post<ApiResponse<{ document: any }>>('/documents', uploadData);

            const document = response.data.data?.document;
            if (!document) {
                throw new Error(response.data.error || 'Failed to upload document');
            }

            const mapped = mapDocument(document);
            logger.info('Document uploaded successfully', { documentId: mapped.id });
            return mapped;
        } catch (error: any) {
            logger.error('Error uploading document', error);
            throw error;
        }
    },

    /**
     * Delete a document
     */
    async deleteDocument(documentId: string): Promise<void> {
        try {
            await apiClient.delete<ApiResponse<void>>(`/documents/${documentId}`);
            logger.info('Document deleted successfully', { documentId });
        } catch (error: any) {
            logger.error('Error deleting document', error);
            throw error;
        }
    },

    /**
     * Download a document
     */
    async downloadDocument(documentId: string): Promise<string | null> {
        try {
            const response = await apiClient.get(`/documents/${documentId}/download`);
            const url = response.data.url || response.data;
            logger.info('Document download URL fetched successfully', { documentId });
            return url;
        } catch (error: any) {
            logger.error('Error downloading document', error);
            throw error;
        }
    },
};


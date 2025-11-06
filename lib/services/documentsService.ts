import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { Document, UploadDocumentRequest } from '../types';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const documentsService = {
    /**
     * Get all documents for the current user
     */
    async getDocuments(caseId?: string, page = 1, pageSize = 20): Promise<Document[]> {
        try {
            let url: string;
            if (caseId) {
                url = `/documents?caseId=${caseId}`;
            } else {
                url = `/documents?page=${page}&limit=${pageSize}`;
            }

            const response = await apiClient.get<ApiResponse<{ documents: Document[], pagination: any }>>(url);

            const documents = response.data.data?.documents || [];
            logger.info('Documents fetched successfully', { count: documents.length });
            return documents;
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
            const response = await apiClient.get<ApiResponse<{ document: Document }>>(`/documents/${documentId}`);

            const document = response.data.data?.document;
            if (!document) {
                throw new Error(response.data.error || 'Document not found');
            }

            logger.info('Document fetched successfully', { documentId });
            return document;
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
            // The API expects: { caseId, documentType, fileName, filePath, fileSize, mimeType }
            const uploadData = {
                caseId: data.caseId || '',
                documentType: 'OTHER', // Default, should be passed from UI
                fileName: data.name,
                filePath: data.file, // This might need to be a file path or base64
                fileSize: 0, // Should be calculated
                mimeType: 'application/pdf', // Should be detected
            };

            const response = await apiClient.post<ApiResponse<{ document: Document }>>('/documents', uploadData);

            const document = response.data.data?.document;
            if (!document) {
                throw new Error(response.data.error || 'Failed to upload document');
            }

            logger.info('Document uploaded successfully', { documentId: document.id });
            return document;
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


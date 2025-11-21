import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { Document, UploadDocumentRequest } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const DOCUMENT_DOWNLOAD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const documentDownloadCache = new Map<
  string,
  {
    url: string | null;
    fetchedAt: number;
  }
>();

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const resolveApiRelativeUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) {
    return null;
  }

  if (isAbsoluteUrl(url)) {
    return url;
  }

  const baseURL = apiClient.defaults.baseURL?.replace(/\/$/, "");
  if (!baseURL) {
    return url;
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${baseURL}${normalizedPath}`;
};

const pickDocumentFilePath = (doc: any): string => {
  const candidate =
    doc?.filePath ??
    doc?.file_path ??
    doc?.fileUrl ??
    doc?.file_url ??
    doc?.downloadUrl ??
    doc?.download_url ??
    doc?.url ??
    "";

  return typeof candidate === "string" ? candidate : "";
};

const mapDocument = (doc: any): Document => {
  const resolvedCase = doc.case ?? doc.caseDetails ?? doc.case_details;
  const resolvedFilePath = pickDocumentFilePath(doc);
  const normalizedFilePath =
    resolveApiRelativeUrl(resolvedFilePath) ?? resolvedFilePath;

  return {
    id: doc.id ?? doc.documentId ?? doc.document_id,
    originalName:
      doc.originalName ??
      doc.original_name ??
      doc.fileName ??
      doc.file_name ??
      "",
    fileName:
      doc.fileName ??
      doc.file_name ??
      doc.originalName ??
      doc.original_name ??
      "",
    documentType: doc.documentType ?? doc.document_type ?? doc.type ?? "",
    status:
      doc.status ?? doc.documentStatus ?? doc.document_status ?? "PENDING",
    uploadDate:
      doc.uploadDate ??
      doc.upload_date ??
      doc.createdAt ??
      doc.created_at ??
      "",
    filePath: normalizedFilePath,
    fileSize:
      typeof doc.fileSize === "number"
        ? doc.fileSize
        : typeof doc.file_size === "number"
          ? doc.file_size
          : undefined,
    mimeType: doc.mimeType ?? doc.mime_type,
    caseId: doc.caseId ?? doc.case_id ?? "",
    case: resolvedCase
      ? {
          id: resolvedCase.id,
          referenceNumber:
            resolvedCase.referenceNumber ?? resolvedCase.reference_number,
          serviceType: resolvedCase.serviceType ?? resolvedCase.service_type,
        }
      : undefined,
    uploadedById: doc.uploadedById ?? doc.uploaded_by_id,
  };
};

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

      params.set("page", String(page));
      params.set("limit", String(limit));

      if (filters?.caseId) {
        params.set("caseId", filters.caseId);
      }

      // Map frontend type filter to backend extensionType parameter
      // Backend supports: ALL, PDF, IMAGE, DOC, DOCX, XLS, XLSX
      if (filters?.type && filters.type !== "all") {
        const typeUpper = filters.type.toUpperCase();
        if (typeUpper === "PDF") {
          params.set("extensionType", "PDF");
        } else if (typeUpper === "IMAGE") {
          params.set("extensionType", "IMAGE");
        } else if (typeUpper === "DOC") {
          // Backend supports DOC (application/msword) and DOCX
          // For 'doc' filter, we'll use DOC which matches .doc files
          // Note: DOCX files would need a separate filter or we could handle both
          params.set("extensionType", "DOC");
        }
      }

      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status.toUpperCase());
      }

      if (filters?.search) {
        params.set("search", filters.search.trim());
      }

      const query = params.toString();
      const response = await apiClient.get<
        ApiResponse<{ documents: any[]; pagination: any }>
      >(query ? `/documents?${query}` : "/documents");

      const documents = response.data.data?.documents || [];
      const mapped = documents.map(mapDocument);
      logger.info("Documents fetched successfully", { count: mapped.length });
      return mapped;
    } catch (error: any) {
      logger.error("Error fetching documents", error);
      throw error;
    }
  },

  /**
   * Get a single document by ID
   */
  async getDocumentById(documentId: string): Promise<Document> {
    try {
      const response = await apiClient.get<ApiResponse<{ document: any }>>(
        `/documents/${documentId}`,
      );

      const document = response.data.data?.document;
      if (!document) {
        throw new Error(response.data.error || "Document not found");
      }

      const mapped = mapDocument(document);
      logger.info("Document fetched successfully", { documentId });
      return mapped;
    } catch (error: any) {
      logger.error("Error fetching document", error);
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

      const response = await apiClient.post<ApiResponse<{ document: any }>>(
        "/documents",
        uploadData,
      );

      const document = response.data.data?.document;
      if (!document) {
        throw new Error(response.data.error || "Failed to upload document");
      }

      const mapped = mapDocument(document);
      logger.info("Document uploaded successfully", { documentId: mapped.id });
      return mapped;
    } catch (error: any) {
      logger.error("Error uploading document", error);
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<void>>(`/documents/${documentId}`);
      logger.info("Document deleted successfully", { documentId });
    } catch (error: any) {
      logger.error("Error deleting document", error);
      throw error;
    }
  },

  /**
   * Download a document
   */
  async downloadDocument(documentId: string): Promise<string | null> {
    const cached = documentDownloadCache.get(documentId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < DOCUMENT_DOWNLOAD_CACHE_TTL) {
      logger.debug("Document download cache hit", { documentId });
      return cached.url;
    }

    try {
      const document = await documentsService.getDocumentById(documentId);
      const resolvedUrl = document.filePath
        ? (resolveApiRelativeUrl(document.filePath) ?? document.filePath)
        : null;

      if (!resolvedUrl) {
        logger.warn("Document metadata did not include a usable file path", {
          documentId,
        });
        throw new Error("Document download URL not available");
      }

      logger.info("Document download URL resolved from metadata", {
        documentId,
      });
      documentDownloadCache.set(documentId, {
        url: resolvedUrl,
        fetchedAt: now,
      });
      return resolvedUrl;
    } catch (error: any) {
      logger.error("Error downloading document", error);
      throw error;
    }
  },
};

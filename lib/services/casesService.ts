import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { Case, CaseStatus, CreateCaseRequest } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const CASE_STATUS_PROGRESS_MAP: Record<CaseStatus, number> = {
  SUBMITTED: 10,
  UNDER_REVIEW: 30,
  DOCUMENTS_REQUIRED: 45,
  PROCESSING: 70,
  APPROVED: 100,
  REJECTED: 100,
  CLOSED: 100,
};

const formatServiceType = (serviceType: string) =>
  serviceType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());

const mapCase = (apiCase: any): Case => {
  const status = (apiCase.status || 'SUBMITTED') as CaseStatus;
  const client = apiCase.client
    ? {
      id: apiCase.client.id,
      email: apiCase.client.email,
      firstName: apiCase.client.firstName,
      lastName: apiCase.client.lastName,
      phone: apiCase.client.phone,
    }
    : undefined;

  const assignedAgent = apiCase.assignedAgent
    ? {
      id: apiCase.assignedAgent.id,
      email: apiCase.assignedAgent.email,
      firstName: apiCase.assignedAgent.firstName,
      lastName: apiCase.assignedAgent.lastName,
    }
    : undefined;

  return {
    id: apiCase.id,
    referenceNumber: apiCase.referenceNumber,
    serviceType: apiCase.serviceType,
    status,
    priority: apiCase.priority,
    submissionDate: apiCase.submissionDate,
    lastUpdated: apiCase.lastUpdated,
    estimatedCompletion: apiCase.estimatedCompletion ?? null,
    completedAt: apiCase.completedAt ?? null,
    approvedAt: apiCase.approvedAt ?? null,
    destinationId: apiCase.destinationId ?? null,
    client,
    assignedAgent: assignedAgent ?? null,
    displayName: formatServiceType(apiCase.serviceType),
    progress: CASE_STATUS_PROGRESS_MAP[status] ?? 0,
  };
};

export const casesService = {
  /**
   * Get all cases for the current user
   */
  async getCases(filters?: {
    status?: string;
    serviceType?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Case[]> {
    try {
      const params = new URLSearchParams();
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;

      params.set('page', String(page));
      params.set('limit', String(limit));

      if (filters?.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }

      if (filters?.serviceType) {
        params.set('serviceType', filters.serviceType);
      }

      if (filters?.priority) {
        params.set('priority', filters.priority);
      }

      if (filters?.search) {
        params.set('search', filters.search.trim());
      }

      const query = params.toString();
      const response = await apiClient.get<ApiResponse<{ cases: any[]; pagination: any }>>(
        query ? `/cases?${query}` : '/cases'
      );

      const cases = response.data.data?.cases || [];
      const mapped = cases.map(mapCase);
      logger.info('Cases fetched successfully', { count: mapped.length });
      return mapped;
    } catch (error: any) {
      logger.error('Error fetching cases', error);
      throw error;
    }
  },

  /**
   * Get a single case by ID
   */
  async getCaseById(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(`/cases/${caseId}`);

      // Handle both { success, data: Case } and { success, data: { case: Case } }
      let caseData: any | undefined;
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        if ('case' in data && typeof data === 'object') {
          caseData = (data as any).case;
        } else {
          caseData = data as Case;
        }
      }

      if (!caseData) {
        throw new Error('Case not found');
      }

      const mapped = mapCase(caseData);
      logger.info('Case fetched successfully', { caseId });
      return mapped;
    } catch (error: any) {
      logger.error('Error fetching case', error);
      throw error;
    }
  },

  /**
   * Create a new case
   */
  async createCase(data: CreateCaseRequest): Promise<Case> {
    try {
      const response = await apiClient.post<ApiResponse<{ case: any }>>('/cases', data);

      const caseData = response.data.data?.case;
      if (!caseData) {
        throw new Error(response.data.error || 'Failed to create case');
      }

      const mapped = mapCase(caseData);
      logger.info('Case created successfully', { caseId: mapped.id });
      return mapped;
    } catch (error: any) {
      logger.error('Error creating case', error);
      throw error;
    }
  },

  /**
   * Update an existing case
   */
  async updateCase(caseId: string, data: Partial<Case>): Promise<Case> {
    try {
      const response = await apiClient.put<ApiResponse<any>>(`/cases/${caseId}`, data);

      const caseData = response.data.data;
      if (!caseData) {
        throw new Error(response.data.error || 'Failed to update case');
      }

      const mapped = mapCase(caseData);
      logger.info('Case updated successfully', { caseId });
      return mapped;
    } catch (error: any) {
      logger.error('Error updating case', error);
      throw error;
    }
  },

  /**
   * Delete a case
   */
  async deleteCase(caseId: string): Promise<void> {
    try {
      await apiClient.delete(`/cases/${caseId}`);
      logger.info('Case deleted successfully', { caseId });
    } catch (error: any) {
      logger.error('Error deleting case', error);
      throw error;
    }
  },
};


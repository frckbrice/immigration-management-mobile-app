import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { Case, CreateCaseRequest } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const casesService = {
  /**
   * Get all cases for the current user
   */
  async getCases(status?: string, page = 1, limit = 20): Promise<Case[]> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (status) {
        params.append('status', status);
      }

      const response = await apiClient.get<ApiResponse<{ cases: Case[], pagination: any }>>(
        `/cases?${params.toString()}`
      );

      const cases = response.data.data?.cases || [];
      logger.info('Cases fetched successfully', { count: cases.length });
      return cases;
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
      const response = await apiClient.get<ApiResponse<Case>>(`/cases/${caseId}`);

      // Handle both { success, data: Case } and { success, data: { case: Case } }
      let caseData: Case | undefined;
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

      logger.info('Case fetched successfully', { caseId });
      return caseData;
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
      const response = await apiClient.post<ApiResponse<{ case: Case }>>('/cases', data);

      const caseData = response.data.data?.case;
      if (!caseData) {
        throw new Error(response.data.error || 'Failed to create case');
      }

      logger.info('Case created successfully', { caseId: caseData.id });
      return caseData;
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
      const response = await apiClient.put<ApiResponse<Case>>(`/cases/${caseId}`, data);

      const caseData = response.data.data;
      if (!caseData) {
        throw new Error(response.data.error || 'Failed to update case');
      }

      logger.info('Case updated successfully', { caseId });
      return caseData;
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


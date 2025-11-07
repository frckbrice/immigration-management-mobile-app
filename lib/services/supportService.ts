import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const supportService = {
  async sendContact(subject: string, message: string): Promise<void> {
    try {
      await apiClient.post<ApiResponse<void>>('/support/contact', { subject, message });
      logger.info('Support contact sent');
    } catch (error: any) {
      logger.error('Failed to send contact message', error);
      throw new Error(error?.response?.data?.error || 'Unable to send message');
    }
  },
};



import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type ContactPayload = {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
};

export const supportService = {
  async sendContact(payload: ContactPayload): Promise<void> {
    try {
      await apiClient.post<ApiResponse<void>>('/contact', payload);
      logger.info('Support contact sent');
    } catch (error: any) {
      logger.error('Failed to send contact message', error);
      throw new Error(error?.response?.data?.error || 'Unable to send message');
    }
  },
};



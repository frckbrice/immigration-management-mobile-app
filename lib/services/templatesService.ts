import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import { Linking, Platform } from 'react-native';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  downloadUrl: string;
  fileType: string;
}

export const templatesService = {
  /**
   * Get all available templates
   */
  async getTemplates(): Promise<Template[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ templates: Template[] }>>('/templates');
      const templates = response.data.data?.templates || [];
      logger.info('Templates fetched successfully', { count: templates.length });
      return templates;
    } catch (error: any) {
      logger.error('Error fetching templates', error);
      throw new Error(error?.response?.data?.error || 'Unable to load templates');
    }
  },

  /**
   * Download a template file
   */
  async downloadTemplate(template: Template): Promise<void> {
    try {
      // Open download URL in browser/system download handler
      const canOpen = await Linking.canOpenURL(template.downloadUrl);
      if (canOpen) {
        await Linking.openURL(template.downloadUrl);
        logger.info('Template download initiated', { templateId: template.id });
      } else {
        throw new Error('Unable to open download URL');
      }
    } catch (error: any) {
      logger.error('Error downloading template', error);
      // Error will be handled by the calling component
      throw new Error(error.message || 'Unable to download template');
    }
  },
};


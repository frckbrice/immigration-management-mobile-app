import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import * as FileSystem from 'expo-file-system';
import { auth } from '../firebase/config';

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

export interface TemplateDownloadResult {
  localUri: string;
  remoteUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}

const getAuthStore = () => {
  return require('../../stores/auth/authStore').useAuthStore;
};

const sanitizeFileName = (name: string) => {
  return name
    .trim()
    .replace(/[^a-z0-9_\-]+/gi, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 60)
    || 'template';
};

const resolveDownloadUrl = (url: string) => {
  if (!url) {
    throw new Error('No download URL available for this template.');
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseURL = apiClient.defaults.baseURL?.replace(/\/$/, '');
  if (!baseURL) {
    throw new Error('Missing API base URL for template download.');
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseURL}${normalizedPath}`;
};

const ensureDirectoryExists = async (directory: string) => {
  const dirInfo = await FileSystem.getInfoAsync(directory);
  if (dirInfo.exists) {
    if (!dirInfo.isDirectory) {
      throw new Error('Download directory is not accessible.');
    }
    return;
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
};

const resolveFileExtension = (template: Template, remoteUrl: string) => {
  const explicitType = template.fileType?.trim();
  if (explicitType) {
    const cleaned = explicitType.replace(/^\./, '').toLowerCase();
    if (cleaned.length > 0 && cleaned.length <= 8) {
      return `.${cleaned}`;
    }
  }

  const pathSegment = remoteUrl.split('?')[0] || '';
  const extensionMatch = pathSegment.match(/\.([a-z0-9]{1,8})$/i);
  if (extensionMatch?.[1]) {
    return `.${extensionMatch[1].toLowerCase()}`;
  }

  return '';
};

const getAuthToken = async (): Promise<string | undefined> => {
  try {
    const user = auth.currentUser;
    if (user) {
      try {
        return await user.getIdToken();
      } catch (firebaseError) {
        logger.warn('Failed to obtain Firebase token for template download', firebaseError);
      }
    }

    const authStore = getAuthStore().getState();
    if (authStore.user) {
      try {
        return await authStore.user.getIdToken();
      } catch (storeError) {
        logger.warn('Failed to obtain auth store token for template download', storeError);
      }
    }
  } catch (tokenError) {
    logger.warn('Unexpected error while retrieving auth token for template download', tokenError);
  }

  return undefined;
};

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
  async downloadTemplate(template: Template): Promise<TemplateDownloadResult> {
    try {
      const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDirectory) {
        throw new Error('Storage is not available on this device.');
      }

      const remoteUrl = resolveDownloadUrl(template.downloadUrl);
      const extension = resolveFileExtension(template, remoteUrl);
      const fileName = `${sanitizeFileName(template.name)}-${Date.now()}${extension}`;
      const targetDirectory = `${baseDirectory}templates`;
      await ensureDirectoryExists(targetDirectory);
      const targetPath = `${targetDirectory}/${fileName}`;

      const token = await getAuthToken();
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, targetPath, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);

      if (downloadResult.status < 200 || downloadResult.status >= 300) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const fallbackMime =
        template.fileType && template.fileType.includes('/') ? template.fileType : undefined;
      const mimeType =
        downloadResult.headers?.['Content-Type'] ||
        downloadResult.headers?.['content-type'] ||
        fallbackMime;

      logger.info('Template download completed', { templateId: template.id, path: downloadResult.uri });

      return {
        localUri: downloadResult.uri,
        remoteUrl,
        fileName,
        fileSize: typeof fileInfo.size === 'number' ? fileInfo.size : undefined,
        mimeType,
      };
    } catch (error: any) {
      logger.error('Error downloading template', error);
      const message = error?.message || 'Unable to download template';
      throw new Error(message);
    }
  },
};


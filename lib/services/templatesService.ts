import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import * as FileSystem from 'expo-file-system/legacy';
import { auth } from '../firebase/config';

import { templateCache } from './templateCache';

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
  downloadUrl?: string;
  fileUrl?: string;
  previewUrl?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  serviceType?: string;
  isRequired?: boolean;
  downloadCount?: number;
  version?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface TemplateDownloadResult {
  localUri: string;
  remoteUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  fromCache?: boolean;
}

const getAuthStore = () => {
  return require('../../stores/auth/authStore').useAuthStore;
};

const sanitizeFileName = (name: string) => {
  return (
    name
      .trim()
      .replace(/[^a-z0-9_\-.]+/gi, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 80) || 'template'
  );
};

const resolveDownloadUrl = (url: string) => {
  if (!url) {
    throw new Error('No download URL available for this template.');
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseURL = apiClient.defaults.baseURL;
  if (!baseURL) {
    throw new Error('Missing API base URL for template download.');
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;

  try {
    const base = new URL(baseURL);
    const origin = base.origin;
    const basePath = base.pathname.replace(/\/$/, '');

    if (basePath && normalizedPath.startsWith(basePath)) {
      return `${origin}${normalizedPath}`;
    }

    const combinedPath = `${basePath}${normalizedPath}`.replace(/\/{2,}/g, '/');
    return `${origin}${combinedPath.startsWith('/') ? combinedPath : `/${combinedPath}`}`;
  } catch (error) {
    logger.warn('Failed to normalize template download URL with URL API', { baseURL, url, error });
    const sanitizedBase = baseURL.replace(/\/$/, '');
    return `${sanitizedBase}${normalizedPath}`;
  }
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
    if (cleaned.length > 0 && cleaned.length <= 8 && !cleaned.includes('/')) {
      return `.${cleaned}`;
    }
  }

  const deriveFromMime = template.mimeType?.split('/').pop();
  if (deriveFromMime && deriveFromMime.length <= 8) {
    return `.${deriveFromMime.toLowerCase()}`;
  }

  if (template.fileName) {
    const nameMatch = template.fileName.match(/\.([a-z0-9]{1,8})$/i);
    if (nameMatch?.[1]) {
      return `.${nameMatch[1].toLowerCase()}`;
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

const normalizeTemplate = (raw: any): Template => {
  const downloadUrl =
    raw?.downloadUrl ||
    raw?.fileUrl ||
    raw?.file_url ||
    raw?.url ||
    raw?.path ||
    raw?.remoteUrl ||
    raw?.remote_url ||
    undefined;

  const fileName = raw?.fileName || raw?.file_name || undefined;
  const fileTypeCandidate = raw?.fileType || raw?.file_type || undefined;
  const mimeType = raw?.mimeType || raw?.mime_type || undefined;

  const extensionFromType =
    typeof fileTypeCandidate === 'string'
      ? fileTypeCandidate.replace(/^\./, '').toLowerCase()
      : undefined;

  const extensionFromMime =
    typeof mimeType === 'string' && mimeType.includes('/')
      ? mimeType.split('/').pop()?.toLowerCase()
      : undefined;

  const extensionFromName =
    typeof fileName === 'string' && fileName.includes('.')
      ? fileName.split('.').pop()?.toLowerCase()
      : undefined;

  const extensionFromUrl =
    typeof downloadUrl === 'string' && downloadUrl.includes('.')
      ? downloadUrl.split('?')[0]?.split('.').pop()?.toLowerCase()
      : undefined;

  const normalizedFileSize =
    typeof raw?.fileSize === 'number'
      ? raw.fileSize
      : typeof raw?.file_size === 'number'
        ? raw.file_size
        : undefined;

  const normalizedDownloadCount =
    typeof raw?.downloadCount === 'number'
      ? raw.downloadCount
      : typeof raw?.download_count === 'number'
        ? raw.download_count
        : undefined;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    downloadUrl,
    fileUrl: raw?.fileUrl || raw?.file_url || raw?.url || undefined,
    previewUrl: raw?.previewUrl || raw?.preview_url || undefined,
    fileType:
      extensionFromType ||
      extensionFromMime ||
      extensionFromName ||
      extensionFromUrl,
    fileName,
    fileSize: normalizedFileSize,
    mimeType,
    serviceType: raw?.serviceType || raw?.service_type,
    isRequired:
      typeof raw?.isRequired === 'boolean'
        ? raw.isRequired
        : typeof raw?.required === 'boolean'
          ? raw.required
          : undefined,
    downloadCount: normalizedDownloadCount,
    version: raw?.version || raw?.templateVersion || raw?.template_version,
    updatedAt: raw?.updatedAt || raw?.updated_at,
    createdAt: raw?.createdAt || raw?.created_at,
  };
};

const resolveTemplateRemoteUrl = (template: Template) => {
  const candidate =
    template.downloadUrl ||
    template.fileUrl ||
    template.previewUrl ||
    '';
  return resolveDownloadUrl(candidate);
};

export const templatesService = {
  /**
   * Get all available templates
   */
  async getTemplates(): Promise<Template[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ templates: any[] }>>('/templates');
      const rawTemplates = response.data.data?.templates || [];
      const templates = rawTemplates.map(normalizeTemplate);
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
    const remoteUrl = resolveTemplateRemoteUrl(template);
    const normalizedTemplate: Template = {
      ...template,
      downloadUrl: remoteUrl,
    };

    const buildRemoteFallback = (): TemplateDownloadResult => {
      const fallbackFileName = template.fileName
        ? sanitizeFileName(template.fileName)
        : sanitizeFileName(template.name);

      return {
        localUri: remoteUrl,
        remoteUrl,
        fileName: fallbackFileName,
        fileSize: template.fileSize,
        mimeType: template.mimeType,
        fromCache: false,
      };
    };

    try {
      const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDirectory) {
        logger.warn('File storage unavailable, returning remote URL for template download', {
          templateId: template.id,
        });
        return buildRemoteFallback();
      }

      const cachedEntry = await templateCache.get(normalizedTemplate);
      if (cachedEntry) {
        logger.info('Serving template from cache', { templateId: template.id });
        const info = await FileSystem.getInfoAsync(cachedEntry.localUri);
        return {
          localUri: cachedEntry.localUri,
          remoteUrl: cachedEntry.downloadUrl || remoteUrl,
          fileName: cachedEntry.fileName || template.fileName || sanitizeFileName(template.name),
          fileSize: typeof info.size === 'number' ? info.size : undefined,
          mimeType: template.mimeType,
          fromCache: true,
        };
      }

      const extension = resolveFileExtension(normalizedTemplate, remoteUrl);
      const targetDirectory = `${baseDirectory}templates`;
      await ensureDirectoryExists(targetDirectory);

      const baseFileName = template.fileName
        ? sanitizeFileName(template.fileName)
        : sanitizeFileName(template.name);
      const finalFileName = template.fileName
        ? sanitizeFileName(template.fileName)
        : `${baseFileName}-${Date.now()}${extension}`;
      const targetPath = `${targetDirectory}/${finalFileName}`;

      const token = await getAuthToken();
      const downloadResult = await FileSystem.downloadAsync(
        remoteUrl,
        targetPath,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );

      if (downloadResult.status < 200 || downloadResult.status >= 300) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const fallbackMime =
        template.mimeType && template.mimeType.includes('/')
          ? template.mimeType
          : template.fileType && template.fileType.includes('/')
            ? template.fileType
            : undefined;
      const mimeType =
        downloadResult.headers?.['Content-Type'] ||
        downloadResult.headers?.['content-type'] ||
        fallbackMime;

      await templateCache.set(normalizedTemplate, downloadResult.uri, {
        fileName: finalFileName,
        downloadUrl: remoteUrl,
        version: normalizedTemplate.version,
        updatedAt: normalizedTemplate.updatedAt,
      });

      logger.info('Template download completed', { templateId: template.id, path: downloadResult.uri });

      return {
        localUri: downloadResult.uri,
        remoteUrl,
        fileName: finalFileName,
        fileSize: typeof fileInfo.size === 'number' ? fileInfo.size : undefined,
        mimeType,
        fromCache: false,
      };
    } catch (error: any) {
      logger.error('Error downloading template', error);
      logger.warn('Falling back to remote URL for template download', { templateId: template.id });
      return buildRemoteFallback();
    }
  },

  getTemplateDownloadUrl(template: Template): string {
    return resolveTemplateRemoteUrl(template);
  },
};


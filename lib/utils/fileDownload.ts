import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from '../api/axios';
import { auth } from '../firebase/config';
import { logger } from './logger';
import { downloadHistoryService } from '../services/downloadHistoryService';

export interface DownloadOptions {
  url: string;
  filename: string;
  mimeType?: string;
  source?: 'email' | 'template' | 'document' | 'other';
  sourceId?: string;
}

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const buildDownloadUrl = (url: string) => {
  if (!url) {
    throw new Error('No download URL provided');
  }
  if (isAbsoluteUrl(url)) {
    return url;
  }
  const baseURL = apiClient.defaults.baseURL?.replace(/\/$/, '');
  if (!baseURL) {
    throw new Error('Missing API base URL');
  }
  return `${baseURL}${url.startsWith('/') ? url : `/${url}`}`;
};

const getAuthToken = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    logger.warn('Failed to retrieve auth token for download', error);
  }
  return undefined;
};

export const downloadAndTrackFile = async ({
  url,
  filename,
  mimeType,
  source,
  sourceId,
}: DownloadOptions): Promise<{ success: boolean; localUri?: string; error?: string }> => {
  try {
  const targetDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!targetDirectory) {
      throw new Error('Storage is not available on this device');
    }

    const safeFileName = `${Date.now()}_${filename.replace(/[^\w.-]+/g, '_')}`;
    const targetPath = `${targetDirectory}${safeFileName}`;
    const downloadUrl = buildDownloadUrl(url);
  const token = await getAuthToken();
  const result = await FileSystem.downloadAsync(
    downloadUrl,
    targetPath,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed with status ${result.status}`);
  }

  const finalUri = result.uri;

    let fileSize: number | undefined;
    try {
      const info = await FileSystem.getInfoAsync(finalUri);
      fileSize = typeof info.size === 'number' ? info.size : undefined;
    } catch (infoError) {
      logger.warn('Unable to determine downloaded file size', infoError);
    }

    if (source) {
      await downloadHistoryService.addDownload({
        name: filename,
        url: downloadUrl,
        localUri: finalUri,
        fileSize,
        mimeType,
        fileType: mimeType,
        source,
        sourceId,
      });
    }

    return {
      success: true,
      localUri: finalUri,
    };
  } catch (error: any) {
    logger.error('File download failed', error);
    return {
      success: false,
      error: error?.message || 'Unable to download file',
    };
  }
};



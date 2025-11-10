import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export interface DownloadHistoryRecord {
  id: string;
  name: string;
  url?: string;
  localUri?: string;
  downloadedAt: string;
  fileSize?: number;
  fileType?: string;
  mimeType?: string;
  source?: 'email' | 'template' | 'document' | 'other';
  sourceId?: string;
}

const STORAGE_KEY = 'pt_download_history';
const MAX_ITEMS = 500;

const readDownloads = async (): Promise<DownloadHistoryRecord[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    logger.warn('Failed to read download history', error);
    return [];
  }
};

const writeDownloads = async (records: DownloadHistoryRecord[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    logger.warn('Failed to persist download history', error);
  }
};

export const downloadHistoryService = {
  async getDownloads(): Promise<DownloadHistoryRecord[]> {
    return readDownloads();
  },

  async saveDownloads(records: DownloadHistoryRecord[]): Promise<void> {
    await writeDownloads(records);
  },

  async addDownload(record: Omit<DownloadHistoryRecord, 'id' | 'downloadedAt'>): Promise<DownloadHistoryRecord> {
    const current = await readDownloads();

    const duplicate = current.find((item) => {
      const sameSource = record.source ? item.source === record.source : true;
      const sameSourceId = record.sourceId ? item.sourceId === record.sourceId : true;
      const sameUrl = record.url && item.url ? item.url === record.url : false;
      const sameName = item.name === record.name;

      if (sameUrl && sameSource && sameSourceId) {
        return true;
      }

      if (record.source && record.sourceId) {
        return sameSource && sameSourceId && sameName;
      }

      return sameUrl && sameName;
    });

    if (duplicate) {
      logger.info('Duplicate download skipped', {
        name: record.name,
        source: record.source,
        sourceId: record.sourceId,
      });
      return duplicate;
    }

    const newRecord: DownloadHistoryRecord = {
      ...record,
      id: `download_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      downloadedAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...current];

    if (updated.length > MAX_ITEMS) {
      updated.length = MAX_ITEMS;
    }

    await writeDownloads(updated);
    logger.info('Download stored in history', { name: newRecord.name, source: newRecord.source });
    return newRecord;
  },

  async removeDownload(id: string): Promise<void> {
    const current = await readDownloads();
    const updated = current.filter((item) => item.id !== id);
    if (updated.length === current.length) {
      return;
    }
    await writeDownloads(updated);
    logger.info('Download removed from history', { id });
  },
};



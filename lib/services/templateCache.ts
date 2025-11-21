import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

import { logger } from "@/lib/utils/logger";
import type { Template } from "@/lib/services/templatesService";

const CACHE_STORAGE_KEY = "@mpe/templates/cache/v1";
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedTemplateEntry {
  id: string;
  localUri: string;
  fileName?: string;
  version?: string;
  downloadUrl?: string;
  updatedAt?: string;
  cachedAt: number;
}

type TemplateCacheRecord = Record<string, CachedTemplateEntry>;

const loadCache = async (): Promise<TemplateCacheRecord> => {
  try {
    const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    return JSON.parse(stored) as TemplateCacheRecord;
  } catch (error) {
    logger.warn("Failed to load template cache", error);
    return {};
  }
};

const saveCache = async (cache: TemplateCacheRecord) => {
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    logger.warn("Failed to persist template cache", error);
  }
};

const isEntryStale = (entry: CachedTemplateEntry, template: Template) => {
  const now = Date.now();
  if (now - entry.cachedAt > CACHE_MAX_AGE) {
    return true;
  }

  if (template.version && entry.version && template.version !== entry.version) {
    return true;
  }

  if (
    template.updatedAt &&
    entry.updatedAt &&
    template.updatedAt !== entry.updatedAt
  ) {
    return true;
  }

  if (
    template.downloadUrl &&
    entry.downloadUrl &&
    template.downloadUrl !== entry.downloadUrl
  ) {
    return true;
  }

  return false;
};

const ensureFileExists = async (localUri: string) => {
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    return info.exists;
  } catch (error) {
    logger.warn("Failed to verify cached template file", { error, localUri });
    return false;
  }
};

export const templateCache = {
  async get(template: Template): Promise<CachedTemplateEntry | null> {
    const cache = await loadCache();
    const entry = cache[template.id];
    if (!entry) {
      return null;
    }

    if (isEntryStale(entry, template)) {
      await this.remove(template.id);
      return null;
    }

    const exists = await ensureFileExists(entry.localUri);
    if (!exists) {
      await this.remove(template.id);
      return null;
    }

    return entry;
  },

  async set(
    template: Template,
    localUri: string,
    metadata?: Partial<CachedTemplateEntry>,
  ) {
    const cache = await loadCache();
    const entry: CachedTemplateEntry = {
      id: template.id,
      localUri,
      fileName: metadata?.fileName || template.name,
      version: metadata?.version || template.version,
      downloadUrl: metadata?.downloadUrl || template.downloadUrl,
      updatedAt: metadata?.updatedAt || template.updatedAt,
      cachedAt: Date.now(),
    };

    cache[template.id] = entry;
    await saveCache(cache);
  },

  async remove(id: string) {
    const cache = await loadCache();
    if (!cache[id]) {
      return;
    }

    const { localUri } = cache[id];
    delete cache[id];
    await saveCache(cache);

    if (localUri) {
      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
          await FileSystem.deleteAsync(localUri, { idempotent: true });
        }
      } catch (error) {
        logger.warn("Failed to remove cached template file", {
          error,
          id,
          localUri,
        });
      }
    }
  },

  async clear() {
    await saveCache({});
  },
};

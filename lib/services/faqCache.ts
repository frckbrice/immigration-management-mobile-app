import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FAQItem } from '@/lib/services/faqService';
import { logger } from '@/lib/utils/logger';

const CACHE_STORAGE_KEY = '@mpe/faq/cache/v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CachedFAQPayload {
    items: FAQItem[];
    fetchedAt: number;
}

const loadCache = async (): Promise<CachedFAQPayload | null> => {
    try {
        const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
        if (!stored) {
            return null;
        }
        return JSON.parse(stored) as CachedFAQPayload;
    } catch (error) {
        logger.warn('Failed to load FAQ cache', error);
        return null;
    }
};

const saveCache = async (payload: CachedFAQPayload) => {
    try {
        await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        logger.warn('Failed to persist FAQ cache', error);
    }
};

export const faqCache = {
    async get(): Promise<CachedFAQPayload | null> {
        const cached = await loadCache();
        if (!cached) {
            return null;
        }
        if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
            await AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch((error) => {
                logger.warn('Failed to remove stale FAQ cache', error);
            });
            return null;
        }
        return cached;
    },

    async set(items: FAQItem[]): Promise<void> {
        const payload: CachedFAQPayload = {
            items,
            fetchedAt: Date.now(),
        };
        await saveCache(payload);
    },

    async clear(): Promise<void> {
        try {
            await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
        } catch (error) {
            logger.warn('Failed to clear FAQ cache', error);
        }
    },
};



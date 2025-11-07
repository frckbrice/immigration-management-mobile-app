import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';

interface LegalResponse {
    success: boolean;
    data?: { content: string } | string;
    error?: string;
}

function normalizeContent(data?: { content: string } | string): string {
    if (!data) return '';
    if (typeof data === 'string') return data;
    return data.content || '';
}

export const legalService = {
    async getPrivacy(): Promise<string> {
        try {
            const res = await apiClient.get<LegalResponse>('/legal/privacy');
            return normalizeContent(res.data.data);
        } catch (error: any) {
            logger.error('Failed to load privacy', error);
            throw new Error(error?.response?.data?.error || 'Unable to load privacy policy');
        }
    },
    async getTerms(): Promise<string> {
        try {
            const res = await apiClient.get<LegalResponse>('/legal/terms');
            return normalizeContent(res.data.data);
        } catch (error: any) {
            logger.error('Failed to load terms', error);
            throw new Error(error?.response?.data?.error || 'Unable to load terms');
        }
    },
};



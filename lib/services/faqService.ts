import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category: string;
    isActive?: boolean;
}

interface FAQEnvelope {
    success: boolean;
    data?: {
        faqs?: FAQItem[];
        categories?: string[];
    } | FAQItem[];
    error?: string;
}

export const faqService = {
    async getAllFAQs(category?: string): Promise<FAQItem[]> {
        try {
            const params = category ? { params: { category } } : undefined;
            const response = await apiClient.get<FAQEnvelope>('/faq', params);
            const payload = response.data.data ?? [];
            const faqs = Array.isArray(payload) ? payload : (payload.faqs ?? []);
            return faqs.filter((f) => f && (f.isActive ?? true));
        } catch (error: any) {
            logger.error('Failed to load FAQs', error);
            throw new Error(error?.response?.data?.error || 'Unable to load FAQs');
        }
    },
};



import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { PaymentIntent, PaymentRecord, RefundResponse } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreatePaymentIntentParams {
  amount: number; // in major units (e.g., 150.00)
  currency?: string; // default provided server-side
  description: string;
  metadata?: Record<string, any>; // e.g., { caseNumber, userId }
}

export interface ConfirmPaymentParams {
  paymentIntentId: string;
  paymentMethodId?: string; // If your backend requires a payment method reference
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // optional partial refund in major units
  reason?: string;
}

export const paymentsService = {
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    try {
      const res = await apiClient.post<ApiResponse<PaymentIntent>>('/payments/intents', params);
      if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Failed to create intent');
      return res.data.data;
    } catch (error: any) {
      logger.error('createPaymentIntent failed', error);
      throw new Error(error?.response?.data?.error || 'Unable to create payment intent');
    }
  },

  async confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntent> {
    try {
      const res = await apiClient.post<ApiResponse<PaymentIntent>>(`/payments/intents/${params.paymentIntentId}/confirm`, {
        paymentMethodId: params.paymentMethodId,
      });
      if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Failed to confirm payment');
      return res.data.data;
    } catch (error: any) {
      logger.error('confirmPaymentIntent failed', error);
      throw new Error(error?.response?.data?.error || 'Unable to confirm payment');
    }
  },

  async verifyPaymentStatus(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentIntent>>(`/payments/intents/${paymentIntentId}`);
      if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Failed to verify payment');
      return res.data.data;
    } catch (error: any) {
      logger.error('verifyPaymentStatus failed', error);
      throw new Error(error?.response?.data?.error || 'Unable to verify payment status');
    }
  },

  async getPaymentHistory(userId?: string): Promise<PaymentRecord[]> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentRecord[]>>('/payments/history', {
        params: userId ? { userId } : undefined,
      });
      if (!res.data.success || !res.data.data) return [];
      return res.data.data;
    } catch (error: any) {
      logger.error('getPaymentHistory failed', error);
      return [];
    }
  },

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      const res = await apiClient.post<ApiResponse<void>>(`/payments/intents/${paymentIntentId}/cancel`);
      if (!res.data.success) throw new Error(res.data.error || 'Failed to cancel intent');
    } catch (error: any) {
      logger.error('cancelPaymentIntent failed', error);
      throw new Error(error?.response?.data?.error || 'Unable to cancel payment');
    }
  },

  async requestRefund(params: RefundParams): Promise<RefundResponse> {
    try {
      const res = await apiClient.post<ApiResponse<RefundResponse>>('/payments/refunds', params);
      if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Failed to create refund');
      return res.data.data;
    } catch (error: any) {
      logger.error('requestRefund failed', error);
      throw new Error(error?.response?.data?.error || 'Unable to request refund');
    }
  },
};



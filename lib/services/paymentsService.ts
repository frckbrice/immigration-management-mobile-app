import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { PaymentIntent, PaymentRecord, RefundResponse } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreatePaymentIntentParams {
  amount: number; // in major units (e.g., 500.00 for Basic tier)
  currency?: string; // default provided server-side
  description: string;
  metadata?: Record<string, any>; // MUST include: { tier: "basic"|"standard"|"premium", type: "subscription" }
}

export interface SubscriptionStatus {
  hasPaid: boolean;
  subscriptionTier: "BASIC" | "STANDARD" | "PREMIUM" | null;
  paymentDate: string | null;
  subscriptionExpiresAt: string | null;
  bypassed: boolean;
  isActive: boolean;
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
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntent> {
    try {
      const res = await apiClient.post<ApiResponse<PaymentIntent>>(
        "/payments/intents",
        params,
      );
      if (!res.data.success || !res.data.data)
        throw new Error(res.data.error || "Failed to create intent");
      return res.data.data;
    } catch (error: any) {
      logger.error("createPaymentIntent failed", error);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to create payment intent";
      if (
        message.toLowerCase().includes("stripe") &&
        message.toLowerCase().includes("not configured")
      ) {
        throw new Error(
          "Payments are not yet configured. Please contact support.",
        );
      }
      throw new Error(message);
    }
  },

  async confirmPaymentIntent(
    params: ConfirmPaymentParams,
  ): Promise<PaymentIntent> {
    try {
      const res = await apiClient.post<ApiResponse<PaymentIntent>>(
        `/payments/intents/${params.paymentIntentId}/confirm`,
        {
          paymentMethodId: params.paymentMethodId,
        },
      );
      if (!res.data.success || !res.data.data)
        throw new Error(res.data.error || "Failed to confirm payment");
      return res.data.data;
    } catch (error: any) {
      logger.error("confirmPaymentIntent failed", error);
      throw new Error(
        error?.response?.data?.error || "Unable to confirm payment",
      );
    }
  },

  /**
   * Verify payment and update subscription status
   * This endpoint verifies payment with Stripe and updates User table
   */
  async verifyPayment(paymentIntentId: string): Promise<{
    paymentStatus: string;
    stripeStatus: string;
    hasPaid: boolean;
    subscriptionTier: string | null;
    paymentDate: string | null;
    subscriptionExpiresAt: string | null;
  }> {
    try {
      const res = await apiClient.post<
        ApiResponse<{
          paymentStatus: string;
          stripeStatus: string;
          hasPaid: boolean;
          subscriptionTier: string | null;
          paymentDate: string | null;
          subscriptionExpiresAt: string | null;
        }>
      >("/payments/verify", { paymentIntentId });

      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error || "Failed to verify payment");
      }

      return res.data.data;
    } catch (error: any) {
      logger.error("verifyPayment failed", error);
      throw new Error(
        error?.response?.data?.error || "Unable to verify payment",
      );
    }
  },

  /**
   * Verify payment status (legacy - checks payment intent status)
   * Use verifyPayment() for subscription updates
   */
  async verifyPaymentStatus(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentIntent>>(
        `/payments/intents/${paymentIntentId}`,
      );
      if (!res.data.success || !res.data.data)
        throw new Error(res.data.error || "Failed to verify payment");
      return res.data.data;
    } catch (error: any) {
      logger.error("verifyPaymentStatus failed", error);
      throw new Error(
        error?.response?.data?.error || "Unable to verify payment status",
      );
    }
  },

  /**
   * Get subscription status for current user
   * Cached for performance - use this before case creation
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const res =
        await apiClient.get<ApiResponse<SubscriptionStatus>>(
          "/payments/status",
        );
      if (!res.data.success || !res.data.data) {
        // Return default status if not found
        return {
          hasPaid: false,
          subscriptionTier: null,
          paymentDate: null,
          subscriptionExpiresAt: null,
          bypassed: false,
          isActive: false,
        };
      }
      // Normalize response: ensure isActive is present (derive from hasPaid if missing)
      const status = res.data.data;
      return {
        ...status,
        isActive:
          status.isActive !== undefined ? status.isActive : status.hasPaid,
      };
    } catch (error: any) {
      logger.error("getSubscriptionStatus failed", error);
      // Return default status on error
      return {
        hasPaid: false,
        subscriptionTier: null,
        paymentDate: null,
        subscriptionExpiresAt: null,
        bypassed: false,
        isActive: false,
      };
    }
  },

  async getPaymentHistory(userId?: string): Promise<PaymentRecord[]> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentRecord[]>>(
        "/payments/history",
        {
          params: userId ? { userId } : undefined,
        },
      );
      if (!res.data.success || !res.data.data) return [];
      return res.data.data;
    } catch (error: any) {
      logger.error("getPaymentHistory failed", error);
      return [];
    }
  },

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      const res = await apiClient.post<ApiResponse<void>>(
        `/payments/intents/${paymentIntentId}/cancel`,
      );
      if (!res.data.success)
        throw new Error(res.data.error || "Failed to cancel intent");
    } catch (error: any) {
      logger.error("cancelPaymentIntent failed", error);
      throw new Error(
        error?.response?.data?.error || "Unable to cancel payment",
      );
    }
  },

  async requestRefund(params: RefundParams): Promise<RefundResponse> {
    try {
      const res = await apiClient.post<ApiResponse<RefundResponse>>(
        "/payments/refunds",
        params,
      );
      if (!res.data.success || !res.data.data)
        throw new Error(res.data.error || "Failed to create refund");
      return res.data.data;
    } catch (error: any) {
      logger.error("requestRefund failed", error);
      throw new Error(
        error?.response?.data?.error || "Unable to request refund",
      );
    }
  },
};

/**
 * Payment Service
 * Handles all payment-related API calls
 */

import Constants from "expo-constants";
import { auth } from "../lib/firebase/config";
import { logger } from "../lib/utils/logger";

// Configuration - read from app config or env
// Note: This service uses direct fetch with Firebase auth tokens.
// For automatic auth handling, use lib/services/paymentsService.ts which uses apiClient.
const extra = (Constants.expoConfig?.extra as any) || {};
const API_BASE_URL =
  extra.apiUrl ||
  (process.env as any)?.EXPO_PUBLIC_API_URL ||
  "http://172.20.10.10:3000";

/**
 * Get Firebase auth token for API requests
 */
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  } catch (error) {
    logger.error("[PaymentService] Error getting auth token", error);
    return null;
  }
};

export interface CreatePaymentIntentParams {
  amount: number;
  description: string;
  currency?: string;
  metadata?: {
    caseNumber?: string;
    userId?: string;
    [key: string]: any;
  };
}

export interface PaymentIntentResponse {
  clientSecret: string;
  id: string;
  amount: number;
  currency: string;
}

/**
 * Create a payment intent on the backend
 */
export const createPaymentIntent = async (
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResponse> => {
  logger.info("[PaymentService] Creating payment intent", params);

  try {
    // Backend API endpoint for creating payment intents
    const url = `${API_BASE_URL}/payments/intents`;
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: params.amount,
        description: params.description,
        currency: params.currency || "usd",
        metadata: params.metadata || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error("[PaymentService] Error response", errorData);
      throw new Error(errorData.error || "Failed to create payment intent");
    }

    const data = await response.json();
    logger.info("[PaymentService] Payment intent created", { id: data.id });

    return data;
  } catch (error) {
    logger.error("[PaymentService] Error creating payment intent", error);
    throw error;
  }
};

/**
 * Retrieve payment intent details
 */
export const getPaymentIntent = async (
  paymentIntentId: string,
): Promise<any> => {
  logger.info("[PaymentService] Retrieving payment intent", {
    paymentIntentId,
  });

  try {
    const url = `${API_BASE_URL}/payments/intents/${paymentIntentId}`;
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to retrieve payment intent");
    }

    return await response.json();
  } catch (error) {
    logger.error("[PaymentService] Error retrieving payment intent", error);
    throw error;
  }
};

/**
 * Get payment history for a user
 */
export const getPaymentHistory = async (userId: string): Promise<any[]> => {
  logger.info("[PaymentService] Fetching payment history for user", { userId });

  try {
    const url = `${API_BASE_URL}/payments/history${userId ? `?userId=${userId}` : ""}`;
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to fetch payment history");
    }

    return await response.json();
  } catch (error) {
    logger.error("[PaymentService] Error fetching payment history", error);
    throw error;
  }
};

/**
 * Cancel a payment intent
 */
export const cancelPaymentIntent = async (
  paymentIntentId: string,
): Promise<void> => {
  logger.info("[PaymentService] Canceling payment intent", { paymentIntentId });

  try {
    const url = `${API_BASE_URL}/payments/intents/${paymentIntentId}/cancel`;
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentIntentId }),
    });

    if (!response.ok) {
      throw new Error("Failed to cancel payment intent");
    }

    logger.info("[PaymentService] Payment intent canceled");
  } catch (error) {
    logger.error("[PaymentService] Error canceling payment intent", error);
    throw error;
  }
};

/**
 * Request a refund
 */
export const requestRefund = async (
  paymentIntentId: string,
  amount?: number,
  reason?: string,
): Promise<any> => {
  logger.info("[PaymentService] Requesting refund", {
    paymentIntentId,
    amount,
    reason,
  });

  try {
    const url = `${API_BASE_URL}/payments/refunds`;
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        paymentIntentId,
        amount,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create refund");
    }

    const data = await response.json();
    logger.info("[PaymentService] Refund created", { id: data.id });

    return data;
  } catch (error) {
    logger.error("[PaymentService] Error creating refund", error);
    throw error;
  }
};

/**
 * Verify payment status
 */
export const verifyPaymentStatus = async (
  paymentIntentId: string,
): Promise<string> => {
  logger.info("[PaymentService] Verifying payment status", { paymentIntentId });

  try {
    const paymentIntent = await getPaymentIntent(paymentIntentId);
    return paymentIntent.status;
  } catch (error) {
    logger.error("[PaymentService] Error verifying payment status", error);
    throw error;
  }
};

/**
 * Mock function for testing (remove in production)
 */
export const createMockPaymentIntent = async (
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResponse> => {
  logger.info("[PaymentService] Creating MOCK payment intent", params);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return mock data
  return {
    id: "pi_mock_" + Math.random().toString(36).substring(7),
    clientSecret: "pi_mock_secret_" + Math.random().toString(36).substring(7),
    amount: Math.round(params.amount * 100),
    currency: params.currency || "usd",
  };
};

/**
 * Check if backend is configured
 */
export const isBackendConfigured = (): boolean => {
  return (
    API_BASE_URL !== "YOUR_API_BASE_URL" &&
    API_BASE_URL !== "http://localhost:3000"
  );
};

/**
 * Get backend configuration status
 */
export const getBackendStatus = (): {
  configured: boolean;
  message: string;
} => {
  const configured = isBackendConfigured();

  return {
    configured,
    message: configured
      ? "Backend is configured and ready"
      : "Backend not configured. Update utils/paymentService.ts with your backend URL and keys.",
  };
};

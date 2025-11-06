
/**
 * Payment Service
 * Handles all payment-related API calls
 */

import { STRIPE_PUBLISHABLE_KEY } from './stripeConfig';

// Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase anon key

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
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResponse> => {
  console.log('[PaymentService] Creating payment intent:', params);

  try {
    // TODO: Replace this URL with your actual backend endpoint
    // Option 1: Supabase Edge Function
    const url = `${SUPABASE_URL}/functions/v1/create-payment-intent`;
    
    // Option 2: Your own backend
    // const url = 'https://your-backend.com/api/create-payment-intent';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // For Supabase
        // 'Authorization': `Bearer ${YOUR_AUTH_TOKEN}`, // For your own backend
      },
      body: JSON.stringify({
        amount: params.amount,
        description: params.description,
        currency: params.currency || 'usd',
        metadata: params.metadata || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[PaymentService] Error response:', errorData);
      throw new Error(errorData.error || 'Failed to create payment intent');
    }

    const data = await response.json();
    console.log('[PaymentService] Payment intent created:', data.id);

    return data;
  } catch (error) {
    console.error('[PaymentService] Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Retrieve payment intent details
 */
export const getPaymentIntent = async (paymentIntentId: string): Promise<any> => {
  console.log('[PaymentService] Retrieving payment intent:', paymentIntentId);

  try {
    const url = `${SUPABASE_URL}/functions/v1/get-payment-intent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ paymentIntentId }),
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve payment intent');
    }

    return await response.json();
  } catch (error) {
    console.error('[PaymentService] Error retrieving payment intent:', error);
    throw error;
  }
};

/**
 * Get payment history for a user
 */
export const getPaymentHistory = async (userId: string): Promise<any[]> => {
  console.log('[PaymentService] Fetching payment history for user:', userId);

  try {
    const url = `${SUPABASE_URL}/functions/v1/get-payment-history`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch payment history');
    }

    return await response.json();
  } catch (error) {
    console.error('[PaymentService] Error fetching payment history:', error);
    throw error;
  }
};

/**
 * Cancel a payment intent
 */
export const cancelPaymentIntent = async (paymentIntentId: string): Promise<void> => {
  console.log('[PaymentService] Canceling payment intent:', paymentIntentId);

  try {
    const url = `${SUPABASE_URL}/functions/v1/cancel-payment-intent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ paymentIntentId }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel payment intent');
    }

    console.log('[PaymentService] Payment intent canceled');
  } catch (error) {
    console.error('[PaymentService] Error canceling payment intent:', error);
    throw error;
  }
};

/**
 * Request a refund
 */
export const requestRefund = async (
  paymentIntentId: string,
  amount?: number,
  reason?: string
): Promise<any> => {
  console.log('[PaymentService] Requesting refund:', paymentIntentId);

  try {
    const url = `${SUPABASE_URL}/functions/v1/create-refund`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        paymentIntentId,
        amount,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create refund');
    }

    const data = await response.json();
    console.log('[PaymentService] Refund created:', data.id);

    return data;
  } catch (error) {
    console.error('[PaymentService] Error creating refund:', error);
    throw error;
  }
};

/**
 * Verify payment status
 */
export const verifyPaymentStatus = async (paymentIntentId: string): Promise<string> => {
  console.log('[PaymentService] Verifying payment status:', paymentIntentId);

  try {
    const paymentIntent = await getPaymentIntent(paymentIntentId);
    return paymentIntent.status;
  } catch (error) {
    console.error('[PaymentService] Error verifying payment status:', error);
    throw error;
  }
};

/**
 * Mock function for testing (remove in production)
 */
export const createMockPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResponse> => {
  console.log('[PaymentService] Creating MOCK payment intent:', params);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return mock data
  return {
    id: 'pi_mock_' + Math.random().toString(36).substring(7),
    clientSecret: 'pi_mock_secret_' + Math.random().toString(36).substring(7),
    amount: Math.round(params.amount * 100),
    currency: params.currency || 'usd',
  };
};

/**
 * Check if backend is configured
 */
export const isBackendConfigured = (): boolean => {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
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
      ? 'Backend is configured and ready'
      : 'Backend not configured. Update utils/paymentService.ts with your backend URL and keys.',
  };
};

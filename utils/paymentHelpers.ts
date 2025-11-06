
/**
 * Payment Helper Functions
 * Utility functions for handling payment-related operations
 */

export interface PaymentParams {
  amount: number;
  description: string;
  caseNumber?: string;
  userId?: string;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

/**
 * Format currency amount for display
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Convert dollars to cents for Stripe
 */
export const dollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

/**
 * Convert cents to dollars from Stripe
 */
export const centsToDollars = (cents: number): number => {
  return cents / 100;
};

/**
 * Validate payment amount
 */
export const validatePaymentAmount = (amount: number): { valid: boolean; error?: string } => {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  
  if (amount > 999999.99) {
    return { valid: false, error: 'Amount exceeds maximum allowed' };
  }
  
  if (!Number.isFinite(amount)) {
    return { valid: false, error: 'Invalid amount' };
  }
  
  return { valid: true };
};

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'succeeded':
      return '#4CAF50';
    case 'pending':
    case 'processing':
      return '#FF9800';
    case 'failed':
    case 'canceled':
      return '#F44336';
    case 'refunded':
      return '#9C27B0';
    default:
      return '#999';
  }
};

/**
 * Get payment status display text
 */
export const getPaymentStatusText = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'succeeded':
      return 'Completed';
    case 'processing':
      return 'Processing';
    case 'requires_payment_method':
      return 'Payment Required';
    case 'requires_confirmation':
      return 'Confirmation Required';
    case 'requires_action':
      return 'Action Required';
    case 'canceled':
      return 'Canceled';
    case 'failed':
      return 'Failed';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

/**
 * Format payment date
 */
export const formatPaymentDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
};

/**
 * Generate payment description
 */
export const generatePaymentDescription = (
  type: string,
  caseNumber?: string
): string => {
  const descriptions: Record<string, string> = {
    'processing': 'Case Processing Fee',
    'application': 'Application Fee',
    'translation': 'Document Translation Fee',
    'consultation': 'Consultation Fee',
    'expedited': 'Expedited Processing Fee',
  };
  
  const baseDescription = descriptions[type.toLowerCase()] || 'Payment';
  
  if (caseNumber) {
    return `${baseDescription} - Case ${caseNumber}`;
  }
  
  return baseDescription;
};

/**
 * Calculate processing fee (if applicable)
 */
export const calculateProcessingFee = (amount: number, feePercentage: number = 2.9): number => {
  const fee = (amount * feePercentage) / 100;
  return Math.round(fee * 100) / 100; // Round to 2 decimal places
};

/**
 * Get total with processing fee
 */
export const getTotalWithFee = (amount: number, feePercentage: number = 2.9): number => {
  const fee = calculateProcessingFee(amount, feePercentage);
  return amount + fee;
};

/**
 * Mask card number for display
 */
export const maskCardNumber = (cardNumber: string): string => {
  const last4 = cardNumber.slice(-4);
  return `•••• •••• •••• ${last4}`;
};

/**
 * Get card brand icon name
 */
export const getCardBrandIcon = (brand: string): string => {
  switch (brand.toLowerCase()) {
    case 'visa':
      return 'creditcard.fill';
    case 'mastercard':
      return 'creditcard.fill';
    case 'amex':
    case 'american express':
      return 'creditcard.fill';
    case 'discover':
      return 'creditcard.fill';
    default:
      return 'creditcard';
  }
};

/**
 * Validate card expiry
 */
export const validateCardExpiry = (month: number, year: number): boolean => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (year < currentYear) {
    return false;
  }
  
  if (year === currentYear && month < currentMonth) {
    return false;
  }
  
  return true;
};

/**
 * Format card expiry for display
 */
export const formatCardExpiry = (month: number, year: number): string => {
  const monthStr = month.toString().padStart(2, '0');
  const yearStr = year.toString().slice(-2);
  return `${monthStr}/${yearStr}`;
};

/**
 * Parse payment error message
 */
export const parsePaymentError = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  // Common Stripe error codes
  const errorMessages: Record<string, string> = {
    'card_declined': 'Your card was declined. Please try another payment method.',
    'insufficient_funds': 'Insufficient funds. Please try another card.',
    'expired_card': 'Your card has expired. Please use a different card.',
    'incorrect_cvc': 'The security code is incorrect. Please check and try again.',
    'processing_error': 'An error occurred while processing your card. Please try again.',
    'rate_limit': 'Too many requests. Please wait a moment and try again.',
  };
  
  const errorCode = error?.code || error?.error?.code;
  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }
  
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Log payment event (for debugging)
 */
export const logPaymentEvent = (
  event: string,
  data?: any
): void => {
  console.log(`[Payment] ${event}`, data || '');
};

/**
 * Check if payment amount requires additional verification
 */
export const requiresAdditionalVerification = (amount: number): boolean => {
  // Amounts over $500 might require additional verification
  return amount > 500;
};

/**
 * Get payment method display name
 */
export const getPaymentMethodDisplayName = (type: string): string => {
  const displayNames: Record<string, string> = {
    'card': 'Credit/Debit Card',
    'apple_pay': 'Apple Pay',
    'google_pay': 'Google Pay',
    'bank_account': 'Bank Account',
  };
  
  return displayNames[type.toLowerCase()] || type;
};

/**
 * Calculate estimated processing time
 */
export const getEstimatedProcessingTime = (amount: number): string => {
  if (amount < 100) {
    return 'Instant';
  } else if (amount < 1000) {
    return '1-2 minutes';
  } else {
    return '2-5 minutes';
  }
};

/**
 * Check if refund is possible
 */
export const canRefund = (paymentDate: Date | string, status: string): boolean => {
  const dateObj = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;
  const daysSincePayment = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  
  // Can refund within 90 days if payment was successful
  return daysSincePayment <= 90 && status.toLowerCase() === 'succeeded';
};

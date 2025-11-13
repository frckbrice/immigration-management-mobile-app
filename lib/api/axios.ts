import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from '../firebase/config';
import { logger } from '../utils/logger';

// Lazy import to avoid circular dependency with authStore
const getAuthStore = () => {
    return require('../../stores/auth/authStore').useAuthStore;
};

const REFRESH_AUTH_COOLDOWN_MS = 60 * 1000;
let lastRefreshAuthAttempt = 0;
let refreshAuthInFlight: Promise<void> | null = null;

const invokeRefreshAuth = async (): Promise<void> => {
    if (refreshAuthInFlight) {
        return refreshAuthInFlight;
    }

    const now = Date.now();
    if (now - lastRefreshAuthAttempt < REFRESH_AUTH_COOLDOWN_MS) {
        logger.warn('[Axios] Skipping refreshAuth retry due to cooldown window');
        return Promise.reject(new Error('[Axios] refreshAuth throttled'));
    }

    lastRefreshAuthAttempt = now;
    const authStore = getAuthStore().getState();

    const refreshPromise = authStore
        .refreshAuth()
        .catch((error: any) => {
            logger.error('[Axios] Error refreshing auth', error);
            throw error;
        })
        .finally(() => {
            refreshAuthInFlight = null;
        });

    refreshAuthInFlight = refreshPromise;

    return refreshPromise;
};

// Get API URL from environment or config
// Priority: expo extra.apiUrl → explicit PROD/DEV envs → localhost
const isProduction = process.env.NODE_ENV === 'production';
const PROD_API = process.env.EXPO_PUBLIC_API_PROD_URL;
const DEV_API = process.env.EXPO_PUBLIC_API_URL;

const envSelectedApi = isProduction
    ? (PROD_API || DEV_API)
    : (DEV_API || PROD_API);

const candidateApiUrls = [
    // Constants.expoConfig?.extra?.apiUrl,
    // envSelectedApi,
    // process.env.EXPO_PUBLIC_API_FALLBACK_URL,
    // 'http://192.168.43.4:3000/api',
    'http://172.20.10.10:3000/api',
    'http://localhost:3000/api',
];

const API_BASE_URL =
    candidateApiUrls.find((url) => typeof url === 'string' && url.length > 0) ||
    'http://localhost:3000/api';

logger.info('API Client initialized', { baseURL: API_BASE_URL });

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add Firebase auth token
apiClient.interceptors.request.use(
    async (config) => {
        try {
            // Try Firebase user first (most up-to-date)
            const user = auth.currentUser;
            if (user) {
                try {
                    // Don't force refresh on every request - only get current token
                    // Force refresh only happens in response interceptor when we get 401
                    const token = await user.getIdToken(false);
                    config.headers.Authorization = `Bearer ${token}`;
                    return config;
                } catch (firebaseError: any) {
                    // If quota exceeded, don't retry
                    if (firebaseError?.code === 'auth/quota-exceeded') {
                        logger.error('Token quota exceeded in request interceptor - skipping token', firebaseError);
                        return config;
                    }
                    logger.warn('Failed to get Firebase token, trying auth store', firebaseError);
                    // Fall through to auth store
                }
            }

            // Fallback to auth store token if Firebase user not available
            const authStore = getAuthStore().getState();
            if (authStore.user) {
                try {
                    // Don't force refresh - use cached token
                    const token = await authStore.user.getIdToken(false);
                    config.headers.Authorization = `Bearer ${token}`;
                } catch (error: any) {
                    // If quota exceeded, don't retry
                    if (error?.code === 'auth/quota-exceeded') {
                        logger.error('Token quota exceeded in request interceptor - skipping token', error);
                        return config;
                    }
                    logger.warn('Failed to get token from auth store user', error);
                }
            }
        } catch (error) {
            logger.error('Error getting auth token', error);
            // Don't fail the request - let it proceed and handle auth errors in response interceptor
        }
        return config;
    },
    (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors and token expiration
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Safety check: if there's no original request config, just reject
        if (!originalRequest) {
            logger.error('API error with no request config', error);
            return Promise.reject(error);
        }

        // Handle 403 Forbidden - Account inactive or insufficient permissions
        if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.error || 'Access forbidden';

            // Check if account is inactive (common 403 reason)
            if (errorMessage.toLowerCase().includes('inactive') ||
                errorMessage.toLowerCase().includes('account')) {
                logger.warn('403 Forbidden: Account inactive or access denied', {
                    message: errorMessage,
                    url: originalRequest.url,
                });

                // Log out user if account is inactive
                const logout = getAuthStore().getState().logout;
                await logout();

                // Return error with user-friendly message
                error.response.data = {
                    ...error.response.data,
                    error: 'Your account has been deactivated. Please contact support.',
                };
                return Promise.reject(error);
            }

            // For other 403 errors (permission-based), just reject
            logger.warn('403 Forbidden: Insufficient permissions', {
                message: errorMessage,
                url: originalRequest.url,
            });
            return Promise.reject(error);
        }

        // Handle 401 Unauthorized - Invalid or expired token
        if (error.response?.status === 401) {
            // Skip logout if this is already a logout/auth-related endpoint to prevent loops
            const url = originalRequest?.url || '';
            const isAuthEndpoint = url.includes('/auth/logout') ||
                url.includes('/users/push-token') ||
                url.includes('/auth/');

            // If request is marked to stop retrying, reject immediately
            if (originalRequest._stopRetry) {
                logger.warn('401 received but retries are disabled - rejecting immediately');
                return Promise.reject(error);
            }

            // If we already retried multiple times, log out (unless it's an auth endpoint)
            const retryCount = originalRequest._retryCount || 0;
            if (retryCount >= 2 && !isAuthEndpoint) {
                logger.warn('401 received after multiple retries - logging out user');
                const authStore = getAuthStore().getState();
                const hasStoredUser = authStore.user !== null;

                if (!hasStoredUser) {
                    logger.warn('No stored user found after multiple 401s - logging out user');
                    const logout = authStore.logout;
                    await logout();
                } else {
                    logger.info('User has stored credentials - attempting refreshAuth before logout');
                    try {
                        await invokeRefreshAuth();
                        // If refreshAuth succeeded, retry the request one more time
                        const refreshedUser = auth.currentUser;
                        if (refreshedUser) {
                            const token = await refreshedUser.getIdToken(true);
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            originalRequest._retryCount = 0; // Reset retry count
                            return await apiClient(originalRequest);
                        }
                    } catch (refreshError) {
                        logger.warn('refreshAuth failed after multiple 401s - logging out user', refreshError);
                        const logout = authStore.logout;
                        await logout();
                    }
                }
                return Promise.reject(error);
            } else if (retryCount >= 2 && isAuthEndpoint) {
                logger.warn('401 received after multiple retries on auth endpoint - skipping logout to prevent loop');
                return Promise.reject(error);
            }

            originalRequest._retryCount = (retryCount || 0) + 1;

            try {
                // Try to refresh token from Firebase first
                const user = auth.currentUser;
                if (user) {
                    try {
                        const token = await user.getIdToken(true); // Force refresh
                        originalRequest.headers.Authorization = `Bearer ${token}`;

                        // Retry the request with new token
                        try {
                            return await apiClient(originalRequest);
                        } catch (retryError: any) {
                            // If retry also returns 401, don't retry again to prevent infinite loop
                            if (retryError?.response?.status === 401) {
                                logger.warn('401 persisted after token refresh - stopping retries to prevent loop');
                                // Mark request to prevent further retries
                                originalRequest._stopRetry = true;
                            }
                            return Promise.reject(retryError);
                        }
                    } catch (getIdTokenError: any) {
                        // Check for quota-exceeded or other fatal errors - stop retrying immediately
                        if (getIdTokenError?.code === 'auth/quota-exceeded' || 
                            getIdTokenError?.code === 'auth/network-request-failed' ||
                            getIdTokenError?.message?.includes('quota-exceeded')) {
                            logger.error('Firebase quota exceeded or network error - stopping retries immediately', getIdTokenError);
                            // Mark request to prevent further retries
                            originalRequest._stopRetry = true;
                            return Promise.reject(error);
                        }
                        throw getIdTokenError;
                    }
                } else {
                    // No Firebase user - try refreshAuth to restore from storage
                    logger.info('401 received with no Firebase user - attempting refreshAuth');
                    const authStore = getAuthStore().getState();

                    try {
                        await invokeRefreshAuth();
                        const refreshedUser = auth.currentUser;

                        if (refreshedUser) {
                            // Got Firebase user after refreshAuth - retry request
                            try {
                                const token = await refreshedUser.getIdToken(true);
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                                originalRequest._retryCount = 0; // Reset count

                                try {
                                    return await apiClient(originalRequest);
                                } catch (retryError: any) {
                                    // Stop retrying if we get another 401
                                    if (retryError?.response?.status === 401) {
                                        originalRequest._stopRetry = true;
                                        if (!isAuthEndpoint && originalRequest._retryCount >= 2) {
                                            logger.warn('401 persisted after refreshAuth - logging out user');
                                            const logout = authStore.logout;
                                            await logout();
                                        }
                                    }
                                    return Promise.reject(retryError);
                                }
                            } catch (tokenError: any) {
                                // Check for quota-exceeded - stop retrying immediately
                                if (tokenError?.code === 'auth/quota-exceeded' || 
                                    tokenError?.message?.includes('quota-exceeded')) {
                                    logger.error('Token refresh quota exceeded - stopping retries', tokenError);
                                    originalRequest._stopRetry = true;
                                    return Promise.reject(error);
                                }
                                throw tokenError;
                            }
                        } else {
                            // refreshAuth couldn't restore auth
                            if (!isAuthEndpoint && originalRequest._retryCount >= 2) {
                                logger.info('401 received with no Firebase user and refreshAuth failed - clearing auth state');
                                const logout = authStore.logout;
                                await logout();
                            }
                            originalRequest._stopRetry = true;
                            return Promise.reject(error);
                        }
                    } catch (refreshError: any) {
                        logger.error('refreshAuth failed during 401 handling', refreshError);
                        // Check for quota-exceeded - stop retrying immediately
                        if (refreshError?.code === 'auth/quota-exceeded' || 
                            refreshError?.message?.includes('quota-exceeded')) {
                            logger.error('Refresh auth quota exceeded - stopping all retries', refreshError);
                            originalRequest._stopRetry = true;
                            return Promise.reject(error);
                        }
                        if (!isAuthEndpoint && originalRequest._retryCount >= 2) {
                            logger.error('Token refresh failed - logging out user after retries');
                            const logout = authStore.logout;
                            await logout();
                        }
                        originalRequest._stopRetry = true;
                        return Promise.reject(error);
                    }
                }
            } catch (refreshError: any) {
                logger.error('Token refresh failed during 401 handling', refreshError);
                // Check for quota-exceeded - stop retrying immediately
                if (refreshError?.code === 'auth/quota-exceeded' || 
                    refreshError?.message?.includes('quota-exceeded')) {
                    logger.error('Token refresh quota exceeded - stopping all retries', refreshError);
                    originalRequest._stopRetry = true;
                    return Promise.reject(error);
                }
                
                if (!isAuthEndpoint) {
                    // Only try one more refreshAuth if we haven't exceeded retries
                    if (originalRequest._retryCount < 2) {
                        try {
                            const authStore = getAuthStore().getState();
                            await invokeRefreshAuth();

                            const refreshedUser = auth.currentUser;
                            if (refreshedUser) {
                                try {
                                    const token = await refreshedUser.getIdToken(true);
                                    originalRequest.headers.Authorization = `Bearer ${token}`;
                                    originalRequest._retryCount = 0;
                                    return await apiClient(originalRequest);
                                } catch (tokenError: any) {
                                    if (tokenError?.code === 'auth/quota-exceeded') {
                                        originalRequest._stopRetry = true;
                                        return Promise.reject(error);
                                    }
                                    throw tokenError;
                                }
                            }
                        } catch (finalError: any) {
                            logger.error('Final refreshAuth attempt failed', finalError);
                            if (finalError?.code === 'auth/quota-exceeded') {
                                originalRequest._stopRetry = true;
                                return Promise.reject(error);
                            }
                        }
                    }

                    // Only logout if we've truly exhausted all options
                    if (originalRequest._retryCount >= 2) {
                        logger.error('All token refresh attempts failed - logging out user');
                        originalRequest._stopRetry = true;
                        try {
                            await auth.signOut();
                        } catch (signOutError) {
                            logger.error('Firebase sign out error', signOutError);
                        }
                        const logout = getAuthStore().getState().logout;
                        await logout();
                    }
                }
                originalRequest._stopRetry = true;
                return Promise.reject(error);
            }
        }

        // Handle 429 Too Many Requests - Rate limiting with exponential backoff
        if (error.response?.status === 429) {
            const retryAfter = error.response?.headers?.['retry-after'];
            const retryCount = originalRequest._retryCount || 0;
            const maxRetries = 3;

            // Don't retry more than maxRetries times
            if (retryCount >= maxRetries) {
                logger.warn('429 Rate limit exceeded - max retries reached', {
                    url: originalRequest.url,
                    retryCount,
                });
                return Promise.reject(error);
            }

            // Calculate delay: use retry-after header if available, otherwise exponential backoff
            let delay: number;
            if (retryAfter) {
                delay = parseInt(retryAfter, 10) * 1000; // Convert seconds to milliseconds
            } else {
                // Exponential backoff: 1s, 2s, 4s
                delay = Math.pow(2, retryCount) * 1000;
            }

            originalRequest._retryCount = retryCount + 1;

            logger.warn('429 Rate limit exceeded - retrying with backoff', {
                url: originalRequest.url,
                retryCount: originalRequest._retryCount,
                delayMs: delay,
            });

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Retry the request
            try {
                return await apiClient(originalRequest);
            } catch (retryError: any) {
                return Promise.reject(retryError);
            }
        }

        // Don't log 404 as error - resource not found is normal
        if (error.response?.status === 404) {
            return Promise.reject(error);
        }

        // Don't log errors for network errors when user is not authenticated
        const isNetworkError = !error.response && error.message === 'Network Error';
        const hasNoAuth = !error.config?.headers?.Authorization;

        if (isNetworkError && hasNoAuth) {
            return Promise.reject(error);
        }

        // Log other errors
        const sanitizedError = {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
        };

        logger.error('API request failed', sanitizedError);
        return Promise.reject(error);
    }
);


import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from '../firebase/config';
import { logger } from '../utils/logger';

// Lazy import to avoid circular dependency with authStore
const getAuthStore = () => {
    return require('../../stores/auth/authStore').useAuthStore;
};

// Get API URL from environment or config
// Priority: expo extra.apiUrl → explicit PROD/DEV envs → localhost
const isProduction = process.env.NODE_ENV === 'production';
const PROD_API = process.env.EXPO_PUBLIC_API_PROD_URL;
const DEV_API = process.env.EXPO_PUBLIC_API_URL;

const envSelectedApi = isProduction
    ? (PROD_API || DEV_API)
    : (DEV_API || PROD_API);

// const API_BASE_URL =
//     Constants.expoConfig?.extra?.apiUrl ||
//     envSelectedApi ||
//     'http://localhost:3000/api';

const API_BASE_URL = 'http://172.20.10.10:3000/api';

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
                    const token = await user.getIdToken();
                    config.headers.Authorization = `Bearer ${token}`;
                    return config;
                } catch (firebaseError) {
                    logger.warn('Failed to get Firebase token, trying auth store', firebaseError);
                    // Fall through to auth store
                }
            }

            // Fallback to auth store token if Firebase user not available
            const authStore = getAuthStore().getState();
            if (authStore.user) {
                try {
                    const token = await authStore.user.getIdToken();
                    config.headers.Authorization = `Bearer ${token}`;
                } catch (error) {
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
                        await authStore.refreshAuth();
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
                            // If retry also returns 401, try refreshAuth before giving up
                            if (retryError?.response?.status === 401 && !isAuthEndpoint) {
                                logger.warn('401 persisted after token refresh - trying refreshAuth');
                                const authStore = getAuthStore().getState();
                                try {
                                    await authStore.refreshAuth();
                                    // Try one more time with refreshed auth
                                    const refreshedUser = auth.currentUser;
                                    if (refreshedUser) {
                                        const newToken = await refreshedUser.getIdToken(true);
                                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                                        originalRequest._retryCount = 0; // Reset count
                                        return await apiClient(originalRequest);
                                    }
                                } catch (refreshError) {
                                    logger.warn('refreshAuth failed after retry 401', refreshError);
                                }

                                // Only logout if we've exhausted all retries
                                if (originalRequest._retryCount >= 2 && !isAuthEndpoint) {
                                    logger.warn('401 persisted after all retries - logging out user');
                                    const logout = authStore.logout;
                                    await logout();
                                }
                            }
                            return Promise.reject(retryError);
                        }
                    } catch (getIdTokenError: any) {
                        // Firebase network error - don't retry, just fail fast
                        if (getIdTokenError?.code === 'auth/network-request-failed') {
                            logger.error('Firebase network error during token refresh - not retrying', getIdTokenError);
                            return Promise.reject(error);
                        }
                        throw getIdTokenError;
                    }
                } else {
                    // No Firebase user - try refreshAuth to restore from storage
                    logger.info('401 received with no Firebase user - attempting refreshAuth');
                    const authStore = getAuthStore().getState();

                    try {
                        await authStore.refreshAuth();
                        const refreshedUser = auth.currentUser;

                        if (refreshedUser) {
                            // Got Firebase user after refreshAuth - retry request
                            const token = await refreshedUser.getIdToken(true);
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            originalRequest._retryCount = 0; // Reset count

                            try {
                                return await apiClient(originalRequest);
                            } catch (retryError: any) {
                                if (retryError?.response?.status === 401 && !isAuthEndpoint && originalRequest._retryCount >= 2) {
                                    logger.warn('401 persisted after refreshAuth - logging out user');
                                    const logout = authStore.logout;
                                    await logout();
                                }
                                return Promise.reject(retryError);
                            }
                        } else {
                            // refreshAuth couldn't restore auth
                            if (!isAuthEndpoint && originalRequest._retryCount >= 2) {
                                logger.info('401 received with no Firebase user and refreshAuth failed - clearing auth state');
                                const logout = authStore.logout;
                                await logout();
                            }
                            return Promise.reject(error);
                        }
                    } catch (refreshError) {
                        logger.error('refreshAuth failed during 401 handling', refreshError);
                        if (!isAuthEndpoint && originalRequest._retryCount >= 2) {
                            logger.error('Token refresh failed - logging out user after retries');
                            const logout = authStore.logout;
                            await logout();
                        }
                        return Promise.reject(error);
                    }
                }
            } catch (refreshError) {
                logger.error('Token refresh failed during 401 handling', refreshError);
                if (!isAuthEndpoint) {
                    try {
                        const authStore = getAuthStore().getState();
                        await authStore.refreshAuth();

                        const refreshedUser = auth.currentUser;
                        if (refreshedUser) {
                            const token = await refreshedUser.getIdToken(true);
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            originalRequest._retryCount = 0;
                            return await apiClient(originalRequest);
                        }
                    } catch (finalError) {
                        logger.error('Final refreshAuth attempt failed', finalError);
                    }

                    // Only logout if we've truly exhausted all options
                    if (originalRequest._retryCount >= 2) {
                        logger.error('All token refresh attempts failed - logging out user');
                        try {
                            await auth.signOut();
                        } catch (signOutError) {
                            logger.error('Firebase sign out error', signOutError);
                        }
                        const logout = getAuthStore().getState().logout;
                        await logout();
                    }
                }
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


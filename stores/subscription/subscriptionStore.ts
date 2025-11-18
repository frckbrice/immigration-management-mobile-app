import { create } from 'zustand';
import { paymentsService, SubscriptionStatus } from '../../lib/services/paymentsService';
import { logger } from '../../lib/utils/logger';
import { secureStorage } from '../../lib/storage/secureStorage';
import { useAuthStore } from '../auth/authStore';

const SUBSCRIPTION_STATUS_CACHE_KEY_PREFIX = 'subscription_status_cache_'; // Will be suffixed with user ID
const SUBSCRIPTION_STATUS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to get user-specific cache key
const getSubscriptionStatusCacheKey = (userId: string | null | undefined): string => {
    if (!userId) return 'subscription_status_cache_no_user';
    return `${SUBSCRIPTION_STATUS_CACHE_KEY_PREFIX}${userId}`;
};

interface SubscriptionState {
    subscriptionStatus: SubscriptionStatus | null;
    isLoading: boolean;
    error: string | null;
    lastChecked: number | null;

    // Actions
    checkSubscriptionStatus: (options?: { force?: boolean }) => Promise<void>;
    clearSubscriptionStatus: () => Promise<void>;
    refreshSubscriptionStatus: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
    subscriptionStatus: null,
    isLoading: false,
    error: null,
    lastChecked: null,

    checkSubscriptionStatus: async (options) => {
        const force = options?.force || false;
        const now = Date.now();

        // Get current user ID from auth store
        const userId = useAuthStore.getState().user?.uid;
        if (!userId) {
            logger.warn('Cannot check subscription status: user not authenticated');
            set({ error: 'User not authenticated', isLoading: false });
            return;
        }

        const cacheKey = getSubscriptionStatusCacheKey(userId);

        // Check in-memory cache first
        const currentState = get();
        if (!force && currentState.subscriptionStatus && currentState.lastChecked !== null) {
            const timeSinceCheck = now - currentState.lastChecked;
            if (timeSinceCheck < SUBSCRIPTION_STATUS_CACHE_TTL) {
                logger.debug('Subscription status cache hit (in-memory)', { timeSinceCheck });
                return;
            }
        }

        // Check persistent cache (user-specific)
        if (!force) {
            try {
                const cached = await secureStorage.get<{
                    status: SubscriptionStatus;
                    checkedAt: number;
                    userId?: string;
                }>(cacheKey);

                // Verify cache is for current user
                if (cached && cached.userId === userId && now - cached.checkedAt < SUBSCRIPTION_STATUS_CACHE_TTL) {
                    logger.debug('Subscription status cache hit (persistent)', { userId });
                    // Normalize cached status to ensure isActive is present
                    const normalizedStatus: SubscriptionStatus = {
                        ...cached.status,
                        isActive: cached.status.isActive !== undefined ? cached.status.isActive : cached.status.hasPaid,
                    };
                    set({
                        subscriptionStatus: normalizedStatus,
                        lastChecked: cached.checkedAt,
                        isLoading: false,
                        error: null,
                    });
                    return;
                }
            } catch (error) {
                logger.debug('Failed to read subscription status cache', error);
            }
        }

        set({ isLoading: true, error: null });

        try {
            const status = await paymentsService.getSubscriptionStatus();
            const checkedAt = Date.now();

            // Ensure isActive is normalized (should already be done by service, but double-check)
            const normalizedStatus: SubscriptionStatus = {
                ...status,
                isActive: status.isActive !== undefined ? status.isActive : status.hasPaid,
            };

            set({
                subscriptionStatus: normalizedStatus,
                isLoading: false,
                lastChecked: checkedAt,
                error: null,
            });

            // Update persistent cache with user ID
            try {
                await secureStorage.set(cacheKey, {
                    status,
                    checkedAt,
                    userId, // Store user ID for verification
                });
            } catch (error) {
                logger.debug('Failed to save subscription status cache', error);
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to check subscription status';
            logger.error('Error checking subscription status', error);

            // Try to use cached data on error (only if same user)
            try {
                const cached = await secureStorage.get<{
                    status: SubscriptionStatus;
                    checkedAt: number;
                    userId?: string;
                }>(cacheKey);

                // Verify cache is for current user
                if (cached && cached.userId === userId) {
                    logger.info('Using cached subscription status due to fetch error', { userId });
                    // Normalize cached status to ensure isActive is present
                    const normalizedStatus: SubscriptionStatus = {
                        ...cached.status,
                        isActive: cached.status.isActive !== undefined ? cached.status.isActive : cached.status.hasPaid,
                    };
                    set({
                        subscriptionStatus: normalizedStatus,
                        isLoading: false,
                        error: null,
                        lastChecked: cached.checkedAt,
                    });
                    return;
                }
            } catch (cacheError) {
                logger.debug('Failed to read subscription status cache on error', cacheError);
            }

            set({ error: errorMessage, isLoading: false });
        }
    },

    clearSubscriptionStatus: async () => {
        try {
            const userId = useAuthStore.getState().user?.uid;
            if (userId) {
                const cacheKey = getSubscriptionStatusCacheKey(userId);
                await secureStorage.delete(cacheKey);
            }
            set({ subscriptionStatus: null, lastChecked: null, error: null });
        } catch (error) {
            logger.debug('Failed to clear subscription status cache', error);
        }
    },

    refreshSubscriptionStatus: async () => {
        // Force refresh by clearing cache first
        await get().clearSubscriptionStatus();
        await get().checkSubscriptionStatus({ force: true });
    },
}));


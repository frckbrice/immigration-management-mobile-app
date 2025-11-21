import { create } from "zustand";
import { notificationsService } from "../../lib/services/notificationsService";
import { logger } from "../../lib/utils/logger";
import { secureStorage } from "../../lib/storage/secureStorage";
import type { Notification } from "../../lib/types";
import { useAuthStore } from "../auth/authStore";

const NOTIFICATIONS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes (notifications change frequently)
const UNREAD_COUNT_CACHE_TTL = 1 * 60 * 1000; // 1 minute
const NOTIFICATIONS_CACHE_KEY_PREFIX = "notifications_cache_"; // Will be suffixed with user ID
const UNREAD_COUNT_CACHE_KEY_PREFIX = "unread_count_cache_"; // Will be suffixed with user ID

// Helper to get user-specific cache keys
const getNotificationsCacheKey = (
  userId: string | null | undefined,
): string => {
  if (!userId) return "notifications_cache_no_user";
  return `${NOTIFICATIONS_CACHE_KEY_PREFIX}${userId}`;
};

const getUnreadCountCacheKey = (userId: string | null | undefined): string => {
  if (!userId) return "unread_count_cache_no_user";
  return `${UNREAD_COUNT_CACHE_KEY_PREFIX}${userId}`;
};

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchNotifications: (options?: { force?: boolean }) => Promise<void>;
  fetchUnreadCount: (options?: { force?: boolean }) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchNotifications: async (options) => {
    const force = options?.force || false;
    const now = Date.now();

    // Get current user ID from auth store
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) {
      logger.warn("Cannot fetch notifications: user not authenticated");
      set({ error: "User not authenticated", isLoading: false });
      return;
    }

    const cacheKey = getNotificationsCacheKey(userId);

    // Check in-memory cache first
    const lastFetched = get().lastFetched;
    if (!force && get().notifications.length > 0 && lastFetched !== null) {
      const timeSinceFetch = now - lastFetched;
      if (timeSinceFetch < NOTIFICATIONS_CACHE_TTL) {
        logger.debug("Notifications cache hit (in-memory)", { timeSinceFetch });
        return;
      }
    }

    // Check persistent cache (user-specific)
    if (!force) {
      try {
        const cached = await secureStorage.get<{
          notifications: Notification[];
          fetchedAt: number;
          userId?: string;
        }>(cacheKey);
        // Verify cache is for current user
        if (
          cached &&
          cached.userId === userId &&
          now - cached.fetchedAt < NOTIFICATIONS_CACHE_TTL
        ) {
          logger.debug("Notifications cache hit (persistent)", { userId });
          set({
            notifications: cached.notifications,
            isLoading: false,
            error: null,
            lastFetched: cached.fetchedAt,
          });
          return;
        }
      } catch (error) {
        logger.debug("Failed to read notifications cache", error);
      }
    }

    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationsService.getNotifications();
      const fetchedAt = Date.now();

      set({ notifications, isLoading: false, lastFetched: fetchedAt });

      // Update persistent cache with user ID
      try {
        await secureStorage.set(cacheKey, {
          notifications,
          fetchedAt,
          userId, // Store user ID for verification
        });
      } catch (error) {
        logger.debug("Failed to save notifications cache", error);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch notifications";
      logger.error("Error fetching notifications", error);

      // Try to use cached data on error (only if same user)
      try {
        const cached = await secureStorage.get<{
          notifications: Notification[];
          fetchedAt: number;
          userId?: string;
        }>(cacheKey);
        // Verify cache is for current user
        if (
          cached &&
          cached.userId === userId &&
          cached.notifications.length > 0
        ) {
          logger.info("Using cached notifications due to fetch error", {
            userId,
          });
          set({
            notifications: cached.notifications,
            isLoading: false,
            error: null,
            lastFetched: cached.fetchedAt,
          });
          return;
        }
      } catch (cacheError) {
        logger.debug("Failed to read notifications cache on error", cacheError);
      }

      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchUnreadCount: async (options) => {
    const force = options?.force || false;
    const now = Date.now();

    // Get current user ID from auth store
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) {
      logger.warn("Cannot fetch unread count: user not authenticated");
      return;
    }

    const cacheKey = getUnreadCountCacheKey(userId);

    // Check persistent cache (user-specific)
    if (!force) {
      try {
        const cached = await secureStorage.get<{
          count: number;
          fetchedAt: number;
          userId?: string;
        }>(cacheKey);
        // Verify cache is for current user
        if (
          cached &&
          cached.userId === userId &&
          now - cached.fetchedAt < UNREAD_COUNT_CACHE_TTL
        ) {
          logger.debug("Unread count cache hit", { userId });
          set({ unreadCount: cached.count });
          return;
        }
      } catch (error) {
        logger.debug("Failed to read unread count cache", error);
      }
    }

    try {
      const count = await notificationsService.getUnreadCount();
      set({ unreadCount: count });

      // Update persistent cache with user ID
      try {
        await secureStorage.set(cacheKey, {
          count,
          fetchedAt: now,
          userId, // Store user ID for verification
        });
      } catch (error) {
        logger.debug("Failed to save unread count cache", error);
      }
    } catch (error: any) {
      logger.error("Error fetching unread count", error);

      // Try to use cached data on error (only if same user)
      try {
        const cached = await secureStorage.get<{
          count: number;
          fetchedAt: number;
          userId?: string;
        }>(cacheKey);
        // Verify cache is for current user
        if (cached && cached.userId === userId && cached !== null) {
          logger.info("Using cached unread count due to fetch error", {
            userId,
          });
          set({ unreadCount: cached.count });
          return;
        }
      } catch (cacheError) {
        logger.debug("Failed to read unread count cache on error", cacheError);
      }
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationsService.markAsRead(notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, unread: false } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error: any) {
      logger.error("Error marking notification as read", error);
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsService.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          unread: false,
        })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      logger.error("Error marking all notifications as read", error);
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await notificationsService.deleteNotification(notificationId);
      set((state) => {
        const notification = state.notifications.find(
          (n) => n.id === notificationId,
        );
        return {
          notifications: state.notifications.filter(
            (n) => n.id !== notificationId,
          ),
          unreadCount: notification?.unread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to delete notification";
      logger.error("Error deleting notification", error);
      set({ error: errorMessage });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearCache: async () => {
    try {
      const userId = useAuthStore.getState().user?.uid;
      if (userId) {
        const notificationsKey = getNotificationsCacheKey(userId);
        const unreadCountKey = getUnreadCountCacheKey(userId);
        await secureStorage.delete(notificationsKey);
        await secureStorage.delete(unreadCountKey);
      }
      set({ lastFetched: null });
    } catch (error) {
      logger.debug("Failed to clear notifications cache", error);
    }
  },
}));

import { create } from 'zustand';
import { notificationsService } from '../../lib/services/notificationsService';
import { logger } from '../../lib/utils/logger';
import type { Notification } from '../../lib/types';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearError: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationsService.getNotifications();
      set({ notifications, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch notifications';
      logger.error('Error fetching notifications', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await notificationsService.getUnreadCount();
      set({ unreadCount: count });
    } catch (error: any) {
      logger.error('Error fetching unread count', error);
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationsService.markAsRead(notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, unread: false } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error: any) {
      logger.error('Error marking notification as read', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsService.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, unread: false })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      logger.error('Error marking all notifications as read', error);
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await notificationsService.deleteNotification(notificationId);
      set((state) => {
        const notification = state.notifications.find((n) => n.id === notificationId);
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount: notification?.unread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete notification';
      logger.error('Error deleting notification', error);
      set({ error: errorMessage });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));


import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { Notification } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const notificationsService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(page = 1, pageSize = 20): Promise<Notification[]> {
    try {
      const response = await apiClient.get<
        ApiResponse<{
          notifications: Notification[];
          unreadCount: number;
          pagination: any;
        }>
      >(`/notifications?page=${page}&limit=${pageSize}`);

      const notifications = response.data.data?.notifications || [];
      logger.info("Notifications fetched successfully", {
        count: notifications.length,
      });
      return notifications;
    } catch (error: any) {
      logger.error("Error fetching notifications", error);
      throw error;
    }
  },

  /**
   * Get unread notifications count
   */
  async getUnreadCount(): Promise<number> {
    try {
      // The API returns unreadCount in the GET /notifications response
      const response = await apiClient.get<
        ApiResponse<{
          notifications: Notification[];
          unreadCount: number;
          pagination: any;
        }>
      >("/notifications?page=1&limit=1");
      const count = response.data.data?.unreadCount || 0;
      logger.info("Unread notifications count fetched", { count });
      return count;
    } catch (error: any) {
      logger.error("Error fetching unread count", error);
      return 0;
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>(
        `/notifications/${notificationId}`,
      );
      logger.info("Notification marked as read", { notificationId });
    } catch (error: any) {
      logger.error("Error marking notification as read", error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>("/notifications/mark-all-read");
      logger.info("All notifications marked as read");
    } catch (error: any) {
      logger.error("Error marking all notifications as read", error);
      throw error;
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<void>>(
        `/notifications/${notificationId}`,
      );
      logger.info("Notification deleted successfully", { notificationId });
    } catch (error: any) {
      logger.error("Error deleting notification", error);
      throw error;
    }
  },
};

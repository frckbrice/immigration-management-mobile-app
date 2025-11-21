import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { NotificationSettings } from "../types";

const BACKEND_SETTING_KEYS: Array<keyof NotificationSettings> = [
  "emailNotifications",
  "pushNotifications",
  "smsNotifications",
];

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SettingsResponse {
  settings: NotificationSettings;
}

export const settingsService = {
  async getSettings(): Promise<NotificationSettings> {
    try {
      const response =
        await apiClient.get<ApiResponse<SettingsResponse>>("/users/settings");
      const settings = response.data.data?.settings;
      if (!settings) {
        throw new Error(
          response.data.error || "Failed to load notification settings",
        );
      }
      logger.info("Notification settings fetched");
      return settings;
    } catch (error: any) {
      logger.error("Error fetching notification settings", error);
      throw error;
    }
  },

  async updateSettings(
    partial: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    try {
      const payloadEntries = Object.entries(partial).filter(([key]) =>
        BACKEND_SETTING_KEYS.includes(key as keyof NotificationSettings),
      );

      if (payloadEntries.length === 0) {
        logger.info("Notification settings update skipped (local-only keys)", {
          partial,
        });
        // Return latest backend settings to keep signature consistent
        return this.getSettings();
      }

      const payload = Object.fromEntries(payloadEntries);
      const response = await apiClient.patch<ApiResponse<SettingsResponse>>(
        "/users/settings",
        payload,
      );
      const settings = response.data.data?.settings;
      if (!settings) {
        throw new Error(
          response.data.error || "Failed to update notification settings",
        );
      }
      logger.info("Notification settings updated", { payload });
      return settings;
    } catch (error: any) {
      logger.error("Error updating notification settings", error);
      throw error;
    }
  },
};

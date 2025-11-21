import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { DashboardStats } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    try {
      const response =
        await apiClient.get<ApiResponse<DashboardStats>>("/dashboard/stats");
      const stats = response.data.data || {};
      logger.info("Dashboard stats fetched successfully");
      return stats;
    } catch (error: any) {
      logger.error("Error fetching dashboard stats", error);
      throw error;
    }
  },
};

import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { UserProfile } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const profileService = {
  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    try {
      // Use /auth/me which returns user directly
      const response = await apiClient.get<ApiResponse<UserProfile>>('/auth/me');

      const profile = response.data.data;
      if (!profile) {
        throw new Error(response.data.error || 'Failed to fetch profile');
      }

      logger.info('Profile fetched successfully');
      return profile;
    } catch (error: any) {
      logger.error('Error fetching profile', error);
      throw error;
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // API uses PATCH for partial updates
      const response = await apiClient.patch<ApiResponse<{ user: UserProfile }>>('/users/profile', data);

      const profile = response.data.data?.user;
      if (!profile) {
        throw new Error(response.data.error || 'Failed to update profile');
      }

      logger.info('Profile updated successfully');
      return profile;
    } catch (error: any) {
      logger.error('Error updating profile', error);
      throw error;
    }
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>('/users/password', {
        currentPassword,
        newPassword,
      });
      logger.info('Password changed successfully');
    } catch (error: any) {
      logger.error('Error changing password', error);
      throw error;
    }
  },

  /**
   * Export user data
   */
  async exportData(): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/users/data-export');
      logger.info('User data exported successfully');
      return response.data.data;
    } catch (error: any) {
      logger.error('Error exporting data', error);
      throw error;
    }
  },

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<void>>('/users/account');
      logger.info('Account deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting account', error);
      throw error;
    }
  },
};


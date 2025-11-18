import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import { auth } from '../firebase/config';
import type { UserProfile } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export type ExportDataResponse = ApiResponse<any>;

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

      // logger.info('Profile fetched successfully', { profile });
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
    const user = auth.currentUser;

    if (!user || !user.email) {
      logger.error('Attempted to change password without authenticated user');
      throw new Error('You need to be logged in to change your password.');
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Force refresh token so backend sees a recent auth_time for sensitive action
      await user.getIdToken(true);
    } catch (reauthError: any) {
      logger.error('Error reauthenticating before changing password', reauthError);

      const errorCode = reauthError?.code;
      switch (errorCode) {
        case 'auth/wrong-password':
          throw new Error('Current password is incorrect.');
        case 'auth/too-many-requests':
          throw new Error('Too many attempts. Please wait a moment and try again.');
        case 'auth/network-request-failed':
          throw new Error('Network error while verifying your password. Check your connection and try again.');
        default:
          throw new Error(reauthError?.message || 'Unable to verify your current password. Please try again.');
      }
    }

    try {
      await apiClient.put<ApiResponse<void>>('/users/password', {
        currentPassword,
        newPassword,
      });
      logger.info('Password changed successfully');
    } catch (error: any) {
      logger.error('Error changing password', error);

      // Some environments restrict direct password updates via the REST API.
      // Fall back to the Firebase SDK so users can still change their credentials.
      if (error?.response?.status === 403) {
        logger.warn('Falling back to Firebase updatePassword after 403 from /users/password');
        try {
          await updatePassword(user, newPassword);
          logger.info('Password changed via Firebase fallback');
          return;
        } catch (firebaseUpdateError: any) {
          logger.error('Firebase updatePassword fallback failed', firebaseUpdateError);
          const fallbackMessage = firebaseUpdateError?.message || 'Failed to change password via fallback method.';
          throw new Error(fallbackMessage);
        }
      }

      const backendMessage = error?.response?.data?.error;
      throw new Error(backendMessage || error?.message || 'Failed to change password');
    }
  },

  /**
   * Export user data
   */
  async exportData(): Promise<ExportDataResponse> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/users/data-export');
      logger.info('User data exported successfully');
      return response.data;
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


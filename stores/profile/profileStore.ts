import { create } from 'zustand';
import { profileService } from '../../lib/services/profileService';
import { logger } from '../../lib/utils/logger';
import type { UserProfile } from '../../lib/types';

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  exportData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await profileService.getProfile();
      set({ profile, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch profile';
      logger.error('Error fetching profile', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    set({ isLoading: true, error: null });
    try {
      const updatedProfile = await profileService.updateProfile(data);
      set({ profile: updatedProfile, isLoading: false });
      return updatedProfile;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update profile';
      logger.error('Error updating profile', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await profileService.changePassword(currentPassword, newPassword);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to change password';
      logger.error('Error changing password', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  exportData: async () => {
    set({ isLoading: true, error: null });
    try {
      await profileService.exportData();
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to export data';
      logger.error('Error exporting data', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await profileService.deleteAccount();
      set({ profile: null, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete account';
      logger.error('Error deleting account', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));


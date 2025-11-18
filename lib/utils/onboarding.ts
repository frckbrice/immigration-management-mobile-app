/**
 * Onboarding Utilities
 * Manages onboarding state persistence
 *
 * The onboarding screen is shown only once on first app launch.
 * State is stored in AsyncStorage and persists across app sessions.
 * Will reset only when the app is uninstalled and reinstalled.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { logger } from './logger';

/**
 * Check if user has completed onboarding
 * @returns true if onboarding was completed, false otherwise
 */
export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return value === 'true';
  } catch (error) {
    logger.error('Error checking onboarding status', error);
    return false;
  }
};

/**
 * Mark onboarding as completed
 * This will prevent the onboarding screen from showing again
 */
export const completeOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    logger.info('Onboarding marked as completed');
  } catch (error) {
    logger.error('Error saving onboarding completion', error);
  }
};

/**
 * Reset onboarding status (for testing purposes)
 * WARNING: This will cause onboarding to show again on next app start
 */
export const resetOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    logger.info('Onboarding status reset');
  } catch (error) {
    logger.error('Error resetting onboarding', error);
  }
};

/**
 * Check if user has seen the get started screen
 * @returns true if get started was completed, false otherwise
 */
export const hasSeenGetStarted = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.GET_STARTED_COMPLETED);
    return value === 'true';
  } catch (error) {
    logger.error('Error checking get started status', error);
    return false;
  }
};

/**
 * Mark get started as completed
 * This will prevent the get started screen from showing again
 */
export const completeGetStarted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GET_STARTED_COMPLETED, 'true');
    logger.info('Get started marked as completed');
  } catch (error) {
    logger.error('Error saving get started completion', error);
  }
};

/**
 * Reset get started status (for testing purposes)
 * WARNING: This will cause get started to show again on next app start
 */
export const resetGetStarted = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.GET_STARTED_COMPLETED);
    logger.info('Get started status reset');
  } catch (error) {
    logger.error('Error resetting get started', error);
  }
};


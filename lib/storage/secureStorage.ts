import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../utils/logger";

const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  REFRESH_TOKEN: "refresh_token",
  USER_DATA: "user_data",
  BIOMETRIC_ENABLED: "biometric_enabled",
  REMEMBER_ME: "remember_me",
} as const;

class SecureStorage {
  // Secure storage (for sensitive data like tokens)
  async setSecure(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      logger.error(`Error saving secure item ${key}`, error);
      throw error;
    }
  }

  async getSecure(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      logger.error(`Error retrieving secure item ${key}`, error);
      return null;
    }
  }

  async deleteSecure(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.error(`Error deleting secure item ${key}`, error);
    }
  }

  // Regular storage (for non-sensitive data)
  async set(key: string, value: any): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (error) {
      logger.error(`Error saving item ${key}`, error);
      throw error;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error retrieving item ${key}`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logger.error(`Error deleting item ${key}`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
      // Also clear secure storage
      for (const key of Object.values(STORAGE_KEYS)) {
        await this.deleteSecure(key);
      }
    } catch (error) {
      logger.error("Error clearing storage", error);
    }
  }

  // Specific methods for common operations
  async setAuthToken(token: string | null | undefined): Promise<void> {
    if (!token || typeof token !== "string") {
      logger.warn("Invalid auth token provided", { type: typeof token });
      throw new Error("Auth token must be a non-empty string");
    }
    await this.setSecure(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.getSecure(STORAGE_KEYS.AUTH_TOKEN);
  }

  async setRefreshToken(token: string | null | undefined): Promise<void> {
    if (!token || typeof token !== "string") {
      logger.warn("Invalid refresh token provided", { type: typeof token });
      throw new Error("Refresh token must be a non-empty string");
    }
    await this.setSecure(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  async getRefreshToken(): Promise<string | null> {
    return await this.getSecure(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async setUserData(user: any): Promise<void> {
    await this.set(STORAGE_KEYS.USER_DATA, user);
  }

  async getUserData<T = any>(): Promise<T | null> {
    return await this.get<T>(STORAGE_KEYS.USER_DATA);
  }

  async clearAuthData(): Promise<void> {
    await this.deleteSecure(STORAGE_KEYS.AUTH_TOKEN);
    await this.deleteSecure(STORAGE_KEYS.REFRESH_TOKEN);
    await this.delete(STORAGE_KEYS.USER_DATA);
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.set(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled);
  }

  async getBiometricEnabled(): Promise<boolean> {
    const value = await this.get<boolean>(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return value ?? false;
  }

  async setRememberMe(remember: boolean): Promise<void> {
    await this.set(STORAGE_KEYS.REMEMBER_ME, remember);
  }

  async getRememberMe(): Promise<boolean> {
    const value = await this.get<boolean>(STORAGE_KEYS.REMEMBER_ME);
    return value ?? false;
  }
}

export const secureStorage = new SecureStorage();
export { STORAGE_KEYS };

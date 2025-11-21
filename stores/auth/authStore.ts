/**
 * Auth Store using Zustand
 * Manages authentication state with persistence
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, database } from "../../lib/firebase/config";
import { secureStorage } from "../../lib/storage/secureStorage";
import { logger } from "../../lib/utils/logger";
import type { PushNotificationToken } from "../../lib/services/pushNotifications";

interface AuthState {
  // State
  user: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  pushToken: string | null;
  pushTokenPlatform: PushNotificationToken["platform"] | null;
  pushTokenDeviceId: string | null;

  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  registerPushToken: () => Promise<PushNotificationToken | null>;
  unregisterPushToken: () => Promise<void>;
}

/**
 * Auth Store with persistence
 * - Firebase Auth handles session persistence via AsyncStorage
 * - This store manages the React state and provides a clean API
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      pushToken: null,
      pushTokenPlatform: null,
      pushTokenDeviceId: null,

      // Set user (called by auth state listener)
      setUser: (user: FirebaseUser | null) => {
        logger.info("Auth store: User state updated", {
          userId: user?.uid || null,
          email: user?.email || null,
        });
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          error: null,
        });
      },

      // Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Set error
      setError: (error: string | null) => {
        set({ error });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh auth state from Firebase
      refreshAuth: async () => {
        try {
          set({ isLoading: true });

          // Firebase Auth automatically persists sessions
          // We just need to wait for the auth state to be ready
          return new Promise<void>((resolve) => {
            const unsubscribe = onAuthStateChanged(
              auth,
              (firebaseUser) => {
                get().setUser(firebaseUser);

                // If user exists, store their token
                if (firebaseUser) {
                  firebaseUser.getIdToken().then((token) => {
                    secureStorage.setAuthToken(token).catch((err) => {
                      logger.warn("Failed to store auth token", err);
                    });
                  });
                }

                unsubscribe();
                resolve();
              },
              (error) => {
                logger.error("Auth state change error during refresh", error);
                get().setUser(null);
                get().setError(error.message);
                unsubscribe();
                resolve();
              },
            );
          });
        } catch (error: any) {
          logger.error("Error refreshing auth", error);
          set({
            error: error.message || "Failed to refresh authentication",
            isLoading: false,
          });
        }
      },

      // Logout
      logout: async () => {
        try {
          set({ isLoading: true });

          // Get user ID before clearing auth (needed for cache cleanup)
          const userId = get().user?.uid;

          // Best-effort push token cleanup before logout
          try {
            await get().unregisterPushToken();
          } catch (cleanupError) {
            logger.warn(
              "Failed to remove push token during logout",
              cleanupError,
            );
          }

          // Clear all user-specific caches before logout
          if (userId) {
            try {
              const { useCasesStore } = await import("../cases/casesStore");
              const { useNotificationsStore } = await import(
                "../notifications/notificationsStore"
              );
              const { useSubscriptionStore } = await import(
                "../subscription/subscriptionStore"
              );
              const { useDocumentsStore } = await import(
                "../documents/documentsStore"
              );

              // Clear all caches for this user
              await Promise.all([
                useCasesStore.getState().clearCache(),
                useNotificationsStore.getState().clearCache(),
                useSubscriptionStore.getState().clearSubscriptionStatus(),
                useDocumentsStore.getState().clearCache(),
              ]);

              logger.info("Cleared all user caches on logout", { userId });
            } catch (cacheError) {
              logger.warn("Failed to clear some caches on logout", cacheError);
              // Non-blocking - continue with logout
            }
          }

          // Sign out from Firebase
          await firebaseSignOut(auth);

          // Clear secure storage
          await secureStorage.clearAuthData();

          // Reset state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            pushToken: null,
            pushTokenPlatform: null,
            pushTokenDeviceId: null,
          });

          logger.info("User logged out successfully");
        } catch (error: any) {
          logger.error("Error during logout", error);
          set({
            error: error.message || "Failed to logout",
            isLoading: false,
          });
          throw error;
        }
      },

      // Register push token
      registerPushToken: async () => {
        try {
          const { registerForPushNotifications, registerPushTokenWithBackend } =
            await import("../../lib/services/pushNotifications");
          const tokenData = await registerForPushNotifications();

          if (tokenData) {
            set({
              pushToken: tokenData.token,
              pushTokenPlatform: tokenData.platform,
              pushTokenDeviceId: tokenData.deviceId || null,
            });
            await registerPushTokenWithBackend(
              tokenData.token,
              tokenData.platform,
              tokenData.deviceId,
            );
            logger.info("Push token registered successfully");
            return tokenData;
          }
          return null;
        } catch (error: any) {
          logger.warn("Failed to register push token (non-blocking)", error);
          // Non-blocking - app continues normally
          return null;
        }
      },

      unregisterPushToken: async () => {
        try {
          const { unregisterPushTokenWithBackend } = await import(
            "../../lib/services/pushNotifications"
          );
          const { pushTokenPlatform, pushTokenDeviceId } = get();
          await unregisterPushTokenWithBackend(
            pushTokenPlatform || undefined,
            pushTokenDeviceId || undefined,
          );
        } catch (error: any) {
          logger.warn("Failed to unregister push token (non-blocking)", error);
        } finally {
          set({
            pushToken: null,
            pushTokenPlatform: null,
            pushTokenDeviceId: null,
          });
        }
      },
    }),
    {
      name: "auth-storage", // Storage key
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive data
      partialize: (state) => ({
        // Don't persist user object (Firebase handles that)
        // Don't persist tokens (use secure storage)
        // Only persist isLoading and error for UI state
        isLoading: state.isLoading,
        error: state.error,
      }),
    },
  ),
);

// Initialize auth state listener on app start
let authListenerInitialized = false;

export const initializeAuthListener = () => {
  if (authListenerInitialized) return;

  authListenerInitialized = true;

  // Listen to Firebase auth state changes
  onAuthStateChanged(
    auth,
    (firebaseUser) => {
      useAuthStore.getState().setUser(firebaseUser);

      // Store token if user exists
      if (firebaseUser) {
        firebaseUser.getIdToken().then((token) => {
          secureStorage.setAuthToken(token).catch((err) => {
            logger.warn("Failed to store auth token", err);
          });
        });
      }
    },
    (error) => {
      logger.error("Auth state listener error", error);
      useAuthStore.getState().setUser(null);
      useAuthStore.getState().setError(error.message);
    },
  );

  logger.info("Auth state listener initialized");
};

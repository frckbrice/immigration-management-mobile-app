/**
 * Firebase Authentication Hook
 * Manages authentication state and session persistence
 */

import { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "../firebase/config";
import { logger } from "../utils/logger";

interface AuthState {
  user: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook to manage Firebase authentication state
 * Session is automatically persisted by Firebase Auth with AsyncStorage
 */
export const useAuth = (): AuthState => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    // Firebase Auth automatically persists sessions using AsyncStorage
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        logger.info("Auth state changed", {
          userId: firebaseUser?.uid || null,
          email: firebaseUser?.email || null,
        });
        setUser(firebaseUser);
        setIsLoading(false);
      },
      (error) => {
        logger.error("Auth state change error", error);
        setUser(null);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
};

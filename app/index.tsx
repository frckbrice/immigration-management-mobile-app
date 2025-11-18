import { useEffect, useState, useRef } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../stores/auth/authStore';
import { initializeAuthListener } from '../stores/auth/authStore';
import { hasCompletedOnboarding } from '../lib/utils/onboarding';
import { COLORS } from '../lib/constants';
import { presenceService } from '@/lib/services/presenceService';
import { useTranslation } from '@/lib/hooks/useTranslation';

console.log('[App] index.tsx loaded');

export default function Index() {
  console.log('[App] Index component rendering');
  const { t } = useTranslation();
  const router = useRouter();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.isLoading);
  const refreshAuth = useAuthStore((state) => state.refreshAuth);
  const refreshAuthRef = useRef(refreshAuth);

  // Temporarily disabled presence tracking to test app functionality
  // useEffect(() => {
  //   const cleanup = presenceService.initializePresenceTracking();
  //   return () => cleanup();
  // }, []);

  useEffect(() => {
    refreshAuthRef.current = refreshAuth;
  }, [refreshAuth]);
  const [hasCompletedOnboardingState, setHasCompletedOnboardingState] = useState<boolean | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Initialize auth and check onboarding
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    console.log('[App] Index useEffect running');

    try {
      // Initialize auth state listener once
      initializeAuthListener();

      // Refresh auth state on mount
      refreshAuthRef.current();

      // Check onboarding status (get started and onboarding are one feature)
      const checkOnboarding = async () => {
        try {
          const completed = await hasCompletedOnboarding();
          console.log('[App] Onboarding check:', completed);
          setHasCompletedOnboardingState(completed);
        } catch (err) {
          console.error('[App] Onboarding check error:', err);
          setError(err instanceof Error ? err.message : 'Failed to check onboarding');
          // Default to showing get started/onboarding if check fails
          setHasCompletedOnboardingState(false);
        }
      };
      checkOnboarding();
    } catch (err) {
      console.error('[App] Index initialization error:', err);
      setError(err instanceof Error ? err.message : 'Initialization failed');
    }
  }, []);

  // Navigate based on state - must be after all other hooks
  useEffect(() => {
    if (authLoading || hasCompletedOnboardingState === null || error) {
      return; // Wait for loading to complete or error to resolve
    }

    // If user hasn't completed onboarding, show get started (which leads to onboarding)
    // Get started and onboarding are treated as one feature
    if (!hasCompletedOnboardingState) {
      console.log('[App] Navigating to get started (onboarding flow)');
      router.replace('/getstarted');
      return;
    }

    // User has completed onboarding, check auth status
    if (isAuthenticated) {
      console.log('[App] Navigating to home');
      router.replace('/(tabs)/(home)');
      return;
    }

    console.log('[App] Navigating to login');
    router.replace('/login');
  }, [authLoading, hasCompletedOnboardingState, isAuthenticated, error, router]);

  console.log('[App] Index state:', { authLoading, hasCompletedOnboardingState, isAuthenticated, error });

  // Show error if something failed
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('common.error')}: {error}</Text>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show loading while checking onboarding and auth state
  if (authLoading || hasCompletedOnboardingState === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show loading while navigating
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

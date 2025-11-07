import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../stores/auth/authStore';
import { initializeAuthListener } from '../stores/auth/authStore';
import { hasCompletedOnboarding } from '../lib/utils/onboarding';
import { COLORS } from '../lib/constants';

console.log('[App] index.tsx loaded');

export default function Index() {
  console.log('[App] Index component rendering');
  const router = useRouter();

  const { isAuthenticated, isLoading: authLoading, refreshAuth } = useAuthStore();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Initialize auth and check onboarding
  useEffect(() => {
    console.log('[App] Index useEffect running');

    try {
      // Initialize auth state listener once
      initializeAuthListener();

      // Refresh auth state on mount
      refreshAuth();

      // Check onboarding status
      const checkOnboarding = async () => {
        try {
          const completed = await hasCompletedOnboarding();
          console.log('[App] Onboarding check:', completed);
          setHasSeenOnboarding(completed);
        } catch (err) {
          console.error('[App] Onboarding check error:', err);
          setError(err instanceof Error ? err.message : 'Failed to check onboarding');
          // Default to showing onboarding if check fails
          setHasSeenOnboarding(false);
        }
      };
      checkOnboarding();
    } catch (err) {
      console.error('[App] Index initialization error:', err);
      setError(err instanceof Error ? err.message : 'Initialization failed');
    }
  }, [refreshAuth]);

  // Navigate based on state - must be after all other hooks
  useEffect(() => {
    if (authLoading || hasSeenOnboarding === null || error) {
      return; // Wait for loading to complete or error to resolve
    }

    if (!hasSeenOnboarding) {
      console.log('[App] Navigating to onboarding');
      router.replace('/onboarding');
      return;
    }

    if (isAuthenticated) {
      console.log('[App] Navigating to home');
      router.replace('/(tabs)/(home)');
      return;
    }

    console.log('[App] Navigating to login');
    router.replace('/login');
  }, [authLoading, hasSeenOnboarding, isAuthenticated, error, router]);

  console.log('[App] Index state:', { authLoading, hasSeenOnboarding, isAuthenticated, error });

  // Show error if something failed
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show loading while checking onboarding and auth state
  if (authLoading || hasSeenOnboarding === null) {
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

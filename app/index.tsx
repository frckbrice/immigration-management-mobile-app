import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth/authStore';
import { initializeAuthListener } from '../stores/auth/authStore';
import { hasCompletedOnboarding } from '../lib/utils/onboarding';
import { COLORS } from '../lib/constants';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, refreshAuth } = useAuthStore();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    // Initialize auth state listener once
    initializeAuthListener();
    
    // Refresh auth state on mount
    refreshAuth();
    
    // Check onboarding status
    const checkOnboarding = async () => {
      const completed = await hasCompletedOnboarding();
      setHasSeenOnboarding(completed);
    };
    checkOnboarding();
  }, [refreshAuth]);

  // Show loading while checking onboarding and auth state
  if (authLoading || hasSeenOnboarding === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show onboarding if user hasn't seen it
  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // If authenticated, go to tabs (main app)
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, go to login
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});

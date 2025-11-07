
import React, { useState, useRef } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, Image, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import FormInput from "@/components/FormInput";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/auth/authStore";
import { logger } from "@/lib/utils/logger";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setError, clearError } = useAuthStore();
  const { showAlert } = useBottomSheetAlert();
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({ title: t('common.error'), message: t('validation.required') });
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      logger.info('User logged in successfully', { email: userCredential.user.email });

      // Set user in store - this will update isAuthenticated
      setUser(userCredential.user);

      // Wait for auth state to propagate, then navigate
      // Firebase auth state listener will also update the store
      await new Promise(resolve => setTimeout(resolve, 300));

      // Navigate to home screen
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      logger.error('Login error', error);
      let errorMessage = 'Failed to login. Please try again.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setError(errorMessage);
      showAlert({ title: t('auth.login'), message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Logo - Matching onboarding design */}
          <View style={styles.logoContainer}>
              <View style={styles.logoIconContainer}>
                <Image
                  source={require('@/assets/app_logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
              {t('auth.welcomeBack')}
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('auth.loginToContinue')}
            </Text>
          </View>

          {/* Email Input */}
          <FormInput
            label={t('auth.email')}
            placeholder={t('auth.enterEmail')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            textContentType="emailAddress"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />

          {/* Password Input */}
          <FormInput
            ref={passwordInputRef}
            label={t('auth.password')}
            placeholder={t('auth.enterPassword')}
            value={password}
            onChangeText={setPassword}
            enablePasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            textContentType="password"
            onSubmitEditing={() => passwordInputRef.current?.blur()}
            labelRight={(
              <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>
            )}
          />

          {/* Login Button */}
          <Pressable 
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>{t('auth.login')}</Text>
            )}
          </Pressable>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={[styles.signupText, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('auth.dontHaveAccount')}{' '}
            </Text>
                <Pressable onPress={() => router.push('/register')}>
              <Text style={styles.signupLink}>{t('auth.signUp')}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40, // Reduced padding, KeyboardAvoidingView handles the rest
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  welcomeContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  forgotText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '700',
  },
});

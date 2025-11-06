
import React, { useState } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, Image, Alert, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setError, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('validation.required'));
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(userCredential.user);
      logger.info('User logged in successfully', { email: userCredential.user.email });
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
      Alert.alert(t('auth.login'), errorMessage);
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/app_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
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
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {t('auth.email')}
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('auth.enterEmail')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordHeader}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                {t('auth.password')}
              </Text>
              <Pressable onPress={() => console.log('Forgot password pressed')}>
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('auth.enterPassword')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable 
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <IconSymbol 
                  name={showPassword ? 'eye.slash.fill' : 'eye.fill'} 
                  size={20} 
                  color={theme.dark ? '#98989D' : '#666'} 
                />
              </Pressable>
            </View>
          </View>

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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 200,
  },
  welcomeContainer: {
    marginBottom: 32,
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
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 8,
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

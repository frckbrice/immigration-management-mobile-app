import React, { useState } from 'react';
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, Alert, ActivityIndicator, Switch, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import FormInput from '@/components/FormInput';

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const validate = (): string | null => {
    if (!firstName.trim() || !lastName.trim()) return t('validation.required');
    if (!email.trim()) return t('validation.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('validation.invalidEmail');
    if (password.length < 8) return t('validation.passwordTooShort');
    if (password !== confirmPassword) return t('validation.passwordsDontMatch');
    if (!acceptTerms || !acceptPrivacy) return t('validation.acceptTerms');
    return null;
  };

  const handleRegister = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      showAlert({ title: t('common.error'), message: errorMsg });
      return;
    }

    setIsLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        try {
          await updateProfile(result.user, { displayName: `${firstName.trim()} ${lastName.trim()}` });
        } catch {}

        try {
          await sendEmailVerification(result.user);
        } catch (e) {
          logger.warn('Failed to send verification email', e);
        }

        const consent = {
          acceptedTermsAt: Date.now(),
          acceptedPrivacyAt: Date.now(),
          version: '1.0',
        };
        await AsyncStorage.setItem('consent_record', JSON.stringify(consent));

        showAlert({
          title: t('auth.registrationSuccess'),
          message: t('auth.checkEmail'),
          actions: [{ text: t('common.close'), onPress: () => router.replace('/login'), variant: 'primary' }]
        });
      }
    } catch (error: any) {
      logger.error('Registration error', error);
      const message = error?.message || t('errors.generic');
      showAlert({ title: t('common.error'), message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background }]} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('auth.createAccount')}</Text>

          <View style={styles.rowInputs}>
            <FormInput
              label={t('auth.firstName')}
              placeholder={t('auth.firstName')}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              containerStyle={[styles.halfInput, styles.halfInputSpacing]}
            />
            <FormInput
              label={t('auth.lastName')}
              placeholder={t('auth.lastName')}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              containerStyle={styles.halfInput}
            />
          </View>

          <FormInput
            label={t('auth.email')}
            placeholder={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <FormInput
            label={t('auth.password')}
            placeholder={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            enablePasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />

          <FormInput
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            enablePasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />

          <View style={styles.consentRow}>
            <Text style={[styles.consentText, { color: theme.colors.text }]}>{t('auth.acceptTerms')}</Text>
            <Switch value={acceptTerms} onValueChange={setAcceptTerms} trackColor={{ false: '#767577', true: '#2196F3' }} thumbColor="#fff" />
          </View>
          <View style={styles.consentRow}>
            <Text style={[styles.consentText, { color: theme.colors.text }]}>{t('auth.acceptPrivacy')}</Text>
            <Switch value={acceptPrivacy} onValueChange={setAcceptPrivacy} trackColor={{ false: '#767577', true: '#2196F3' }} thumbColor="#fff" />
          </View>

          <Pressable style={[styles.registerButton, isLoading && styles.registerButtonDisabled]} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerButtonText}>{t('auth.createAccount')}</Text>}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('auth.alreadyHaveAccount')}</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}> {t('auth.signIn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
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
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  rowInputs: { flexDirection: 'row', marginBottom: 20 },
  consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  consentText: { fontSize: 14, fontWeight: '500' },
  registerButton: { backgroundColor: '#2196F3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  registerButtonDisabled: { opacity: 0.6 },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, color: '#2196F3', fontWeight: '700' },
  halfInput: { flex: 1, marginBottom: 0 },
  halfInputSpacing: { marginRight: 12 },
});



import React, { useState } from 'react';
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, Alert, ActivityIndicator, Switch, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/lib/hooks/useTranslation';

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
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
      Alert.alert(t('common.error'), errorMsg);
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

        Alert.alert(
          t('auth.registrationSuccess'),
          t('auth.checkEmail'),
          [{ text: t('common.close'), onPress: () => router.replace('/login') }]
        );
      }
    } catch (error: any) {
      logger.error('Registration error', error);
      const message = error?.message || t('errors.generic');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/app_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('auth.createAccount')}</Text>

          <View style={styles.rowInputs}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('auth.firstName')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('auth.lastName')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder={t('auth.email')}
              placeholderTextColor={theme.dark ? '#98989D' : '#666'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder={t('auth.password')}
              placeholderTextColor={theme.dark ? '#98989D' : '#666'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder={t('auth.confirmPassword')}
              placeholderTextColor={theme.dark ? '#98989D' : '#666'}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

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
  logo: { width: 150, height: 150 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  inputWrapper: { borderRadius: 12, paddingHorizontal: 16, marginBottom: 12 },
  input: { paddingVertical: 16, fontSize: 16 },
  consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  consentText: { fontSize: 14, fontWeight: '500' },
  registerButton: { backgroundColor: '#2196F3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  registerButtonDisabled: { opacity: 0.6 },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, color: '#2196F3', fontWeight: '700' },
});



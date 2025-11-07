import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { profileService } from '@/lib/services/profileService';
import FormInput from '@/components/FormInput';
import { IconSymbol } from '@/components/IconSymbol';
import { useToast } from '@/components/Toast';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({ title: 'Validation', message: t('validation.required') });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: 'Validation', message: t('validation.passwordsDontMatch') });
      return;
    }
    try {
      setSubmitting(true);
      await profileService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('profile.passwordUpdated', { defaultValue: 'Your password has been changed.' }),
      });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to change password' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Pressable style={styles.headerIcon} hitSlop={12} onPress={() => router.back()}>
                <IconSymbol name="chevron.left" size={22} color={theme.colors.text} />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.changePassword')}</Text>
                <Text style={[styles.subtitle, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                  {t('profile.changePasswordSubtitle', { defaultValue: 'Use a strong password that you have not used elsewhere.' })}
                </Text>
              </View>
              <View style={styles.headerIcon} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.dark ? '#111113' : '#FFFFFF', borderColor: theme.dark ? '#2C2C2E' : '#E2E8F0' }]}>
              <FormInput
                label={t('profile.currentPassword', { defaultValue: 'Current Password' })}
                placeholder={t('profile.currentPassword', { defaultValue: 'Current Password' })}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                enablePasswordToggle
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
              />
              <FormInput
                label={t('profile.newPassword', { defaultValue: 'New Password' })}
                placeholder={t('auth.password')}
                value={newPassword}
                onChangeText={setNewPassword}
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

              <View style={styles.metaRow}>
                <IconSymbol name="shield.checkerboard" size={18} color={theme.dark ? '#38BDF8' : '#2563EB'} />
                <Text style={[styles.metaText, { color: theme.dark ? '#94A3B8' : '#475569' }]}>
                  {t('profile.passwordHint', { defaultValue: 'Passwords must be at least 8 characters and include a combination of numbers and letters.' })}
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={[
            styles.footerBar,
            {
              backgroundColor: theme.dark ? '#000000E6' : '#FFFFFFEE',
              borderTopColor: theme.dark ? '#1E293B' : '#E2E8F0',
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable style={[styles.secondaryButton, { borderColor: theme.dark ? '#1E293B' : '#CBD5F5' }]} onPress={() => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }} disabled={submitting}>
            <Text style={[styles.secondaryText, { color: theme.dark ? '#E2E8F0' : '#1E293B' }]}>{t('common.reset')}</Text>
          </Pressable>
          <Pressable style={[styles.primaryButton, { opacity: submitting ? 0.7 : 1 }]} onPress={onChange} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('common.save')}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 14 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaText: { fontSize: 13, flex: 1, lineHeight: 18 },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  primaryButton: { flex: 1, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', paddingVertical: 12 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  flex: { flex: 1 },
});



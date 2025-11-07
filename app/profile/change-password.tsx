import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { profileService } from '@/lib/services/profileService';
import FormInput from '@/components/FormInput';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
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
      showAlert({ title: 'Success', message: 'Password changed', actions: [{ text: t('common.close'), variant: 'primary' }] });
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.changePassword')}</Text>
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
        <Pressable style={[styles.button, { opacity: submitting ? 0.7 : 1 }]} onPress={onChange} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('common.save')}</Text>}
        </Pressable>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  button: { backgroundColor: '#2196F3', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});



import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { profileService } from '@/lib/services/profileService';
import { useAuthStore } from '@/stores/auth/authStore';

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const logout = useAuthStore((s) => s.logout);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    showAlert({
      title: 'Confirm',
      message: 'This action is irreversible. Continue?',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        {
          text: 'Delete',
          variant: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await profileService.deleteAccount();
              await logout();
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Failed to delete account' });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.deleteAccount')}</Text>
        <Text style={[styles.warning, { color: theme.dark ? '#98989D' : '#666' }]}>This will permanently delete your account and data.</Text>
        <Pressable style={[styles.button, { opacity: deleting ? 0.7 : 1 }]} onPress={onDelete} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete Account</Text>}
        </Pressable>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  warning: { fontSize: 14, marginBottom: 16 },
  button: { backgroundColor: '#F44336', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});



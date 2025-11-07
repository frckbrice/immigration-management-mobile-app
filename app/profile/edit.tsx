import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { profileService } from '@/lib/services/profileService';
import type { UserProfile } from '@/lib/types';
import FormInput from '@/components/FormInput';

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const profile = await profileService.getProfile();
        setName(profile.name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setAddress(profile.address || '');
      } catch (e) {
        // non-blocking
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      const data: Partial<UserProfile> = { name, phone, address };
      await profileService.updateProfile(data);
      showAlert({ title: 'Success', message: 'Profile updated', actions: [{ text: t('common.close'), variant: 'primary' }] });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.editProfile')}</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <>
            <FormInput
              label={t('profile.name')}
              placeholder={t('profile.name')}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <FormInput
              label={t('profile.email')}
              placeholder={t('profile.email')}
              value={email}
              editable={false}
              style={{ opacity: 0.75 }}
              helperText={t('profile.emailReadOnly', { defaultValue: 'Email cannot be changed' })}
            />
            <FormInput
              label={t('profile.phone')}
              placeholder={t('profile.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <FormInput
              label={t('profile.address')}
              placeholder={t('profile.address')}
              value={address}
              onChangeText={setAddress}
            />
            <Pressable style={[styles.button, { opacity: saving ? 0.7 : 1 }]} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('common.save')}</Text>}
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});



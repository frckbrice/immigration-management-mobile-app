import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { profileService } from '@/lib/services/profileService';
import type { UserProfile } from '@/lib/types';

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await profileService.getProfile();
        setProfile(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.personalInfo')}</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <Row label={t('profile.name')} value={profile?.name || '-'} themeText={theme.colors.text} />
            <Row label={t('profile.email')} value={profile?.email || '-'} themeText={theme.colors.text} />
            <Row label={t('profile.phone')} value={profile?.phone || '-'} themeText={theme.colors.text} />
            <Row label={t('profile.address')} value={profile?.address || '-'} themeText={theme.colors.text} />
            <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
              <Text style={styles.editBtnText}>{t('profile.editProfile')}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

function Row({ label, value, themeText }: { label: string; value: string; themeText: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: '#888' }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: themeText }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  card: { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  rowValue: { fontSize: 16, fontWeight: '600' },
  editBtn: { backgroundColor: '#2196F3', borderRadius: 12, alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});



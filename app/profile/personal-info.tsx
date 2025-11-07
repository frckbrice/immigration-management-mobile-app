import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { profileService } from '@/lib/services/profileService';
import type { UserProfile } from '@/lib/types';
import { IconSymbol } from '@/components/IconSymbol';

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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable style={styles.headerIcon} hitSlop={8} onPress={() => router.back()}>
              <IconSymbol name="chevron.left" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.personalInfo')}</Text>
              <Text style={[styles.subtitle, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                {t('profile.personalInfoSubtitle', { defaultValue: 'Everything we know about you in one place.' })}
              </Text>
            </View>
            <View style={styles.headerIcon} />
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.dark ? '#111113' : '#FFFFFF', borderColor: theme.dark ? '#2C2C2E' : '#E2E8F0' }]}
            >
              <Row label={t('profile.name')} value={profile?.name || '-'} themeText={theme.colors.text} />
              <Row label={t('profile.email')} value={profile?.email || '-'} themeText={theme.colors.text} muted />
              <Row label={t('profile.phone')} value={profile?.phone || t('profile.addPhone', { defaultValue: 'Add a phone number' })} themeText={theme.colors.text} />
              <Row label={t('profile.address')} value={profile?.address || t('profile.addAddress', { defaultValue: 'Add your address' })} themeText={theme.colors.text} />

              <View style={styles.quickActions}>
                <Pressable style={[styles.actionChip, { backgroundColor: '#DBEAFE' }]} onPress={() => router.push('/profile/edit')}>
                  <IconSymbol name="square.and.pencil" size={16} color="#1D4ED8" />
                  <Text style={[styles.actionChipText, { color: '#1D4ED8' }]}>{t('profile.editProfile')}</Text>
                </Pressable>
                <Pressable style={[styles.actionChip, { backgroundColor: '#F1F5F9' }]} onPress={() => router.push('/profile/change-password')}>
                  <IconSymbol name="lock.rotation" size={16} color="#0F172A" />
                  <Text style={[styles.actionChipText, { color: '#0F172A' }]}>{t('profile.changePassword')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={[styles.secondaryCard, { backgroundColor: theme.dark ? '#0B1220' : '#F8FAFC', borderColor: theme.dark ? '#1E293B' : '#E2E8F0' }]}
          >
            <IconSymbol name="shield.checkerboard" size={24} color={theme.dark ? '#38BDF8' : '#2563EB'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.secondaryTitle, { color: theme.colors.text }]}>{t('profile.securityHeadline', { defaultValue: 'Your data stays secure' })}</Text>
              <Text style={[styles.secondaryBody, { color: theme.dark ? '#94A3B8' : '#475569' }]}>
                {t('profile.securityCopy', { defaultValue: 'We use industry-leading encryption to protect your personal information.' })}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function Row({ label, value, themeText, muted }: { label: string; value: string; themeText: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: '#94A3B8' }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: muted ? '#94A3B8' : themeText }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 14 },
  loadingState: { paddingVertical: 80, alignItems: 'center' },
  card: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 3,
  },
  row: { gap: 6 },
  rowLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  rowValue: { fontSize: 16, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionChipText: { fontSize: 14, fontWeight: '600' },
  secondaryCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  secondaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  secondaryBody: { fontSize: 14, lineHeight: 20 },
});



import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { IconSymbol } from '@/components/IconSymbol';
import { BackButton } from '@/components/BackButton';
import { useProfileStore } from '@/stores/profile/profileStore';
import type { UserProfile } from '@/lib/types';

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useProfileStore((state) => state.profile);
  const isLoading = useProfileStore((state) => state.isLoading);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const hasRequestedProfile = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!profile && !hasRequestedProfile.current) {
      hasRequestedProfile.current = true;
      fetchProfile().catch(() => undefined);
    }
  }, [profile, fetchProfile]);

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingTop: insets.top }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.personalInfo')}</Text>
              <Text style={[styles.subtitle, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                {t('profile.personalInfoSubtitle', { defaultValue: 'Everything we know about you in one place.' })}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator />
            </View>
          ) : (
            <ProfileSummaryCard
              name={formatFullName(profile)}
              email={profile?.email || ''}
              phone={profile?.phone}
              onEditProfile={() => router.push('/profile/edit')}
              onChangePassword={() => router.push('/profile/change-password')}
              theme={theme}
              t={t}
            />
          )}

          <SecurityCallout theme={theme} t={t} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function formatFullName(profile: UserProfile | null) {
  if (!profile) return '-';
  const parts = [profile.firstName, profile.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return profile.name || '-';
}

type ProfileSummaryCardProps = {
  name: string;
  email: string;
  phone?: string | null;
  onEditProfile: () => void;
  onChangePassword: () => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
};

function ProfileSummaryCard({ name, email, phone, onEditProfile, onChangePassword, theme, t }: ProfileSummaryCardProps) {
  const primaryColor = theme.colors.primary;
  const surface = theme.dark ? '#0F172A' : '#FFFFFF';
  const border = theme.dark ? '#1E293B' : '#E2E8F0';
  const muted = theme.dark ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.summaryCard, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.summaryHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.dark ? '#1D4ED8' : '#DBEAFE' }]}>
          <Text style={[styles.avatarInitials, { color: theme.dark ? '#E0F2FE' : '#1D4ED8' }]}>
            {name !== '-' ? name.slice(0, 2).toUpperCase() : '--'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.summaryName, { color: theme.colors.text }]}>{name}</Text>
          {/* <Text style={[styles.summaryEmail, { color: muted }]}>{email || t('profile.addEmail', { defaultValue: 'Add your email' })}</Text> */}
        </View>
      </View>

      <View style={styles.summaryInfoGrid}>
        <InfoTile
          icon="envelope.fill"
          label={t('profile.email')}
          value={email || t('profile.addEmail', { defaultValue: 'Add your email' })}
          theme={theme}
        />
        <InfoTile
          icon="phone.fill"
          label={t('profile.phone')}
          value={phone || t('profile.addPhone', { defaultValue: 'Add a phone number' })}
          theme={theme}
        />
      </View>

      <View style={styles.summaryActions}>
        <Pressable style={[styles.primaryAction, { backgroundColor: primaryColor }]} onPress={onEditProfile}>
          <IconSymbol name="square.and.pencil" size={18} color={theme.dark ? '#0B1220' : '#FFFFFF'} />
          <Text style={[styles.primaryActionText, { color: theme.dark ? '#0B1220' : '#FFFFFF' }]}>{t('profile.editProfile')}</Text>
        </Pressable>
        <Pressable style={[styles.secondaryAction, { borderColor: theme.dark ? '#334155' : '#CBD5F5' }]} onPress={onChangePassword}>
          <IconSymbol name="lock.rotation" size={18} color={primaryColor} />
          <Text style={[styles.secondaryActionText, { color: primaryColor }]}>{t('profile.changePassword')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

type InfoTileProps = {
  icon: string;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
};

function InfoTile({ icon, label, value, theme }: InfoTileProps) {
  const muted = theme.dark ? '#94A3B8' : '#64748B';
  return (
    <View style={[styles.infoTile, { backgroundColor: theme.dark ? '#111827' : '#F8FAFC', borderColor: theme.dark ? '#1E293B' : '#E2E8F0' }]}>
      <View style={[styles.infoTileIconWrap, { backgroundColor: theme.dark ? '#1D4ED8' : '#DBEAFE' }]}>
        <IconSymbol name={icon} size={18} color={theme.dark ? '#E0F2FE' : '#1D4ED8'} />
      </View>
      <Text style={[styles.infoTileLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.infoTileValue, { color: theme.colors.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SecurityCallout({ theme, t }: { theme: ReturnType<typeof useTheme>; t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <View style={[styles.secondaryCard, { backgroundColor: theme.dark ? '#0B1220' : '#F8FAFC', borderColor: theme.dark ? '#1E293B' : '#E2E8F0' }]}>
      <IconSymbol name="shield.checkerboard" size={24} color={theme.dark ? '#38BDF8' : '#2563EB'} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.secondaryTitle, { color: theme.colors.text }]}>{t('profile.securityHeadline', { defaultValue: 'Your data stays secure' })}</Text>
        <Text style={[styles.secondaryBody, { color: theme.dark ? '#94A3B8' : '#475569' }]}>
          {t('profile.securityCopy', { defaultValue: 'We use industry-leading encryption to protect your personal information.' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerSpacer: { width: 40, height: 40 },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 14 },
  loadingState: { paddingVertical: 80, alignItems: 'center' },
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
  summaryCard: {
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryName: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryEmail: {
    fontSize: 14,
  },
  summaryInfoGrid: {
    gap: 14,
    marginTop: 16,
  },
  infoTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  infoTileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTileLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  infoTileValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  summaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});



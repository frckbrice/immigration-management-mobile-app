import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import type { UserProfile } from '@/lib/types';
import { IconSymbol } from '@/components/IconSymbol';
import FormInput from '@/components/FormInput';
import { useToast } from '@/components/Toast';
import { useProfileStore } from '@/stores/profile/profileStore';

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const hasRequestedProfile = useRef(false);

  useEffect(() => {
    if (!profile) {
      if (!hasRequestedProfile.current) {
        hasRequestedProfile.current = true;
        fetchProfile().finally(() => setLoading(false));
      }
      return;
    }

    const nextFirst = profile.firstName || extractFirstName(profile);
    const nextLast = profile.lastName || extractLastName(profile);

    setInitialProfile(profile);
    setFirstName(nextFirst);
    setLastName(nextLast);
    setEmail(profile.email || '');
    setPhone(profile.phone || '');
    setAddress(profile.address || '');
    setLoading(false);
  }, [profile, fetchProfile]);

  const isDirty = useMemo(() => {
    if (!initialProfile) return false;
    const normalized = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };
    return (
      normalized.firstName !== (initialProfile.firstName || extractFirstName(initialProfile)) ||
      normalized.lastName !== (initialProfile.lastName || extractLastName(initialProfile)) ||
      normalized.phone !== (initialProfile.phone || '') ||
      normalized.address !== (initialProfile.address || '')
    );
  }, [initialProfile, firstName, lastName, phone, address]);

  const onSave = async () => {
    if (!initialProfile) {
      return;
    }

    if (!isDirty) {
      showToast({
        type: 'info',
        title: t('common.info'),
        message: t('profile.noChanges', { defaultValue: 'No changes to save. Update a field first.' }),
      });
      return;
    }

    try {
      setSaving(true);
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const payload: Partial<UserProfile> = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: buildFullNameFromParts(trimmedFirst, trimmedLast),
        phone: phone.trim(),
        address: address.trim(),
      };
      const updated = await updateProfile(payload);

      setInitialProfile(updated);
      setFirstName(updated.firstName || extractFirstName(updated));
      setLastName(updated.lastName || extractLastName(updated));
      setEmail(updated.email || '');
      setPhone(updated.phone || '');
      setAddress(updated.address || '');

      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('profile.profileUpdated', { defaultValue: 'Your profile has been updated successfully.' }),
      });
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e?.message || t('errors.generic') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.safeArea, {
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Pressable style={[styles.headerIcon, { marginRight: 12 }]} onPress={() => router.back()} hitSlop={12}>
                <IconSymbol name="chevron.left" size={22} color={theme.colors.text} />
              </Pressable>
              <View style={styles.headerTextGroup}>
                <Text style={[styles.screenTitle, { color: theme.colors.text }]}>{t('profile.editProfile')}</Text>
                <Text style={[styles.screenSubtitle, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                  {t('profile.editProfileSubtitle', { defaultValue: 'Update your personal details so we can stay in touch.' })}
                </Text>
              </View>
              <View style={styles.headerIcon} />
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator />
                <Text style={[styles.loadingText, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                  {t('common.loading')}
                </Text>
              </View>
            ) : (
                <View style={[styles.card, {
                  backgroundColor: theme.dark ? '#111113' : '#FFFFFF',
                  borderColor: theme.dark ? '#2C2C2E' : '#E2E8F0',
                  paddingBottom: insets.bottom,
                }]}
                >
                  <View style={[styles.nameRow, { paddingTop: insets.top }]}>
                    <FormInput
                      label={t('profile.firstName', { defaultValue: 'First Name' })}
                      placeholder={t('profile.firstName', { defaultValue: 'First Name' })}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      containerStyle={styles.nameField}
                    />
                    <FormInput
                      label={t('profile.lastName', { defaultValue: 'Last Name' })}
                      placeholder={t('profile.lastName', { defaultValue: 'Last Name' })}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      containerStyle={styles.nameField}
                    />
                  </View>
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
                    placeholder={t('profile.phonePlaceholder', { defaultValue: 'Add a phone number for quick contact' })}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <FormInput
                    label={t('profile.address')}
                    placeholder={t('profile.addressPlaceholder', { defaultValue: 'Street, City, Country' })}
                    value={address}
                    onChangeText={setAddress}
                  />

                <View style={styles.divider} />

                <View style={styles.metaRow}>
                  <IconSymbol name="info.circle" size={18} color={theme.dark ? '#8E8E93' : '#64748B'} />
                  <Text style={[styles.metaText, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                    {t('profile.syncNotice', { defaultValue: 'Your updates sync instantly across all your devices.' })}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: theme.dark ? '#000000E6' : 'transparent',
              borderTopColor: theme.dark ? '#2C2C2E' : '#E2E8F0',
              // paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.dark ? '#2C2C2E' : '#CBD5F5' }]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.dark ? '#E2E8F0' : '#1E293B' }]}>
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, { opacity: saving || !isDirty ? 0.6 : 1 }]}
            onPress={onSave}
            disabled={saving || !isDirty}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('common.save')}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  nameField: {
    flex: 1,
    minWidth: '48%',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 12 : 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 14,
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 3,
    gap: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#33415533',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

function buildFullNameFromParts(first: string, last: string) {
  return [first, last].map((part) => part.trim()).filter(Boolean).join(' ');
}

function extractFirstName(profile: UserProfile) {
  if (profile.firstName) return profile.firstName;
  if (!profile.name) return '';
  return profile.name.split(' ')[0] || '';
}

function extractLastName(profile: UserProfile) {
  if (profile.lastName) return profile.lastName;
  if (!profile.name) return '';
  const parts = profile.name.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}




import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, Image, Alert } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { BackButton } from "@/components/BackButton";
import { useProfileStore } from "@/stores/profile/profileStore";
import { useAuthStore } from "@/stores/auth/authStore";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { type AppThemeColors } from "@/styles/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { uploadFileToAPI } from "@/lib/services/fileUpload";
import { logger } from "@/lib/utils/logger";
import { useToast } from "@/components/Toast";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const colors = theme.colors as AppThemeColors;
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile, isLoading, fetchProfile, updateProfile } = useProfileStore();
  const { user, logout } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { showToast } = useToast();

  const avatarUri = useMemo(() => {
    if (avatarPreview) {
      return avatarPreview;
    }

    return (
      profile?.profilePicture ||
      profile?.avatar ||
      user?.photoURL ||
      null
    );
  }, [avatarPreview, profile?.profilePicture, profile?.avatar, user?.photoURL]);

  const uploadAndSave = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      try {
        setIsUploadingPhoto(true);

        const uploadResult = await uploadFileToAPI(
          asset.uri,
          asset.fileName || `profile_${Date.now()}.jpg`,
          asset.mimeType || 'image/jpeg',
        );

        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(uploadResult.error || 'Failed to upload profile photo');
        }

        await updateProfile({ avatar: uploadResult.url });
        setAvatarPreview(uploadResult.url);
        fetchProfile().catch((error) => {
          logger.warn('Failed to refresh profile after photo upload', error);
        });
        showToast({
          title: t('common.success'),
          message: t('profile.photoUpdated', { defaultValue: 'Profile photo updated successfully.' }),
          type: 'success',
        });
      } catch (error: any) {
        logger.error('Profile photo update failed', error);
        showToast({
          title: t('common.error'),
          message: error?.message || t('profile.failedToChangePhoto', { defaultValue: 'Unable to update profile photo.' }),
          type: 'error',
        });
      } finally {
        setIsUploadingPhoto(false);
      }
    },
    [fetchProfile, showToast, t, updateProfile],
  );

  const pickImage = useCallback(
    async (mode: 'camera' | 'library') => {
      try {
        const permissionStatus =
          mode === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionStatus.status !== 'granted') {
          showToast({
            title: t('profile.noPermissions', { defaultValue: 'Permission needed' }),
            message: t('profile.photosPermissionNeeded', {
              defaultValue: 'Please grant access in settings to update your profile photo.',
            }),
            type: 'error',
          });
          return;
        }

        const pickerResult =
          mode === 'camera'
            ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            })
            : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

        if (pickerResult.canceled || !pickerResult.assets?.length) {
          return;
        }

        await uploadAndSave(pickerResult.assets[0]);
      } catch (error: any) {
        logger.error('Image picker error', error);
        showToast({
          title: t('common.error'),
          message: error?.message || t('profile.failedToChangePhoto', { defaultValue: 'Unable to pick an image.' }),
          type: 'error',
        });
      }
    },
    [t, uploadAndSave],
  );

  const handleChangeProfilePhoto = useCallback(() => {
    Alert.alert(
      t('profile.changeProfilePhoto', { defaultValue: 'Change profile photo' }),
      t('profile.choosePhotoOption', { defaultValue: 'Choose how to upload a new photo.' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.takePhoto', { defaultValue: 'Take photo' }),
          onPress: () => pickImage('camera'),
        },
        {
          text: t('profile.chooseFromLibrary', { defaultValue: 'Choose from library' }),
          onPress: () => pickImage('library'),
        },
      ],
    );
  }, [pickImage, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (
      avatarPreview &&
      profile?.profilePicture &&
      profile.profilePicture === avatarPreview
    ) {
      setAvatarPreview(null);
    }
  }, [avatarPreview, profile?.profilePicture]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} iconSize={24} />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('profile.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar,
            { paddingBottom: insets.bottom + 160 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarLarge}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <IconSymbol name="person.fill" size={48} color="#fff" />
                )}
                {isUploadingPhoto && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <Pressable
                  style={[styles.avatarEditButton, { marginRight: 10, marginBottom: 10, backgroundColor: '#e7eeff' }]}
                  onPress={() => handleChangeProfilePhoto()}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.changeProfilePhoto', { defaultValue: 'Change profile photo' })}
                  disabled={isUploadingPhoto}
                >
                  <MaterialCommunityIcons name="camera-plus" size={20} color={theme.colors.primary} />
                </Pressable>
              </View>
            </View>
            {isLoading ? (
              <ActivityIndicator size="large" color="#2196F3" />
            ) : (
              <>
                <Text style={[styles.profileName, { color: theme.colors.text }]}>
                  {profile?.name || user?.displayName || 'User'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {profile?.email || user?.email || 'No email'}
                </Text>
              </>
            )}
            <Pressable
              style={styles.editProfileButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Text style={styles.editProfileButtonText}>{t('profile.editProfile')}</Text>
            </Pressable>
          </View>

          {/* Account Settings Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('profile.sections.accountSettings')}
            </Text>
            <View style={[styles.menuGroup, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Pressable
                style={[styles.menuItem, styles.menuItemFirst]}
                onPress={() => router.push('/profile/personal-info')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
                  <IconSymbol name="person.fill" size={20} color="#2196F3" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.personalInfo')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={styles.menuItem}
                onPress={() => router.push('/profile/change-password')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
                  <IconSymbol name="lock.fill" size={20} color="#FF9800" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.changePassword')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => router.push('/payment-history')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
                  <IconSymbol name="creditcard.fill" size={20} color="#4CAF50" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.paymentHistory')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            </View>
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('profile.sections.preferences')}
            </Text>
            <View style={[styles.menuGroup, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Pressable
                style={[styles.menuItem, styles.menuItemFirst, styles.menuItemLast]}
                onPress={() => router.push('/profile/preferences')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#E0F2FE' }]}>
                  <IconSymbol name="gear" size={20} color={colors.primary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                    {t('profile.openPreferences', { defaultValue: 'Theme, Language & Notifications' })}
                  </Text>
                  <Text style={[styles.menuSubtitle, { color: theme.dark ? '#8E8E93' : '#64748B' }]}>
                    {t('profile.preferencesRowDescription', { defaultValue: 'Manage appearance, language and notification alerts.' })}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            </View>
          </View>

          {/* Support & Legal Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('profile.sections.supportLegal')}
            </Text>
            <View style={[styles.menuGroup, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Pressable
                style={[styles.menuItem, styles.menuItemFirst]}
                onPress={() => router.push('/support/faq')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
                  <IconSymbol name="questionmark.circle.fill" size={20} color="#9C27B0" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.faq')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={styles.menuItem}
                onPress={() => router.push('/support/contact')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#E0F7FA' }]}>
                  <IconSymbol name="headphones" size={20} color="#00BCD4" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.contactUs')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={styles.menuItem}
                onPress={() => router.push('/legal/privacy')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#ECEFF1' }]}>
                  <IconSymbol name="hand.raised.fill" size={20} color="#607D8B" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.privacy')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => router.push('/legal/terms')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#EFEBE9' }]}>
                  <IconSymbol name="doc.text.fill" size={20} color="#795548" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.terms')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            </View>
          </View>

          {/* Data & Account Actions Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              {t('profile.sections.dataAndAccount')}
            </Text>
            <View style={[styles.menuGroup, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Pressable
                style={[styles.menuItem, styles.menuItemFirst]}
                onPress={() => router.push('/account/export-data')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#E8EAF6' }]}>
                  <IconSymbol name="square.and.arrow.up.fill" size={20} color="#3F51B5" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.exportMyData')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

              <Pressable
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => router.push('/account/delete-account')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#FFEBEE' }]}>
                  <IconSymbol name="trash.fill" size={20} color="#F44336" />
                </View>
                <Text style={[styles.menuTitle, { color: '#F44336' }]}>
                  {t('profile.deleteAccount')}
                </Text>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            </View>
          </View>

          {/* Logout Button */}
          <Pressable
            style={[
              styles.logoutButton,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.backdrop,
              },
            ]}
            onPress={handleLogout}
          >
            <Text style={[styles.logoutText, { color: colors.background }]}>{t('profile.logout')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scrollContentWithTabBar: {
    paddingBottom: 140,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0B93F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#00000033',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    marginBottom: 16,
  },
  editProfileButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  editProfileButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  menuItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
    gap: 4,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 12,
  },
  logoutButton: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

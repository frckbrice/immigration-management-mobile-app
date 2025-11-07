
import React, { useState, useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, Switch, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useProfileStore } from "@/stores/profile/profileStore";
import { useAuthStore } from "@/stores/auth/authStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { profile, isLoading, fetchProfile } = useProfileStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    fetchProfile();
  }, []);

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
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('profile.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.avatarLarge}>
              <IconSymbol name="person.fill" size={48} color="#fff" />
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
              <View style={[styles.menuItem, styles.menuItemFirst, styles.menuItemLast]}>
                <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
                  <IconSymbol name="bell.fill" size={20} color="#4CAF50" />
                </View>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                  {t('profile.notifications')}
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#767577', true: '#2196F3' }}
                  thumbColor="#fff"
                />
              </View>
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
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    width: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
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
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#003366',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

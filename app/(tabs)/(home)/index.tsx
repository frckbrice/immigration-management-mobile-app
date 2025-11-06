
import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, Image, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth/authStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { cases, fetchCases } = useCasesStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const { messages, fetchMessages } = useMessagesStore();
  const { documents, fetchDocuments } = useDocumentsStore();

  useEffect(() => {
    fetchCases();
    fetchUnreadCount();
    fetchMessages();
    fetchDocuments();
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const activeCases = cases.filter(c => c.status === 'pending' || c.status === 'in-review' || c.status === 'action-required');
  const pendingDocs = documents.length; // You can add a status filter if needed
  const newMessages = messages.filter(m => m.unread).length;

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.dark ? '#000' : '#F5F5F5' }]} 
        edges={['top']}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Greeting and Notification */}
          <View style={styles.header}>
            <View style={styles.greetingContainer}>
              <View style={styles.avatarCircle}>
                <IconSymbol name="mail.fill" size={28} color="#fff" />
              </View>
              <View style={styles.greetingTextContainer}>
                <Text style={[styles.greetingText, { color: theme.dark ? '#999' : '#666' }]}>
                  {t('home.goodMorning')}
                </Text>
                <Text style={[styles.welcomeText, { color: theme.dark ? '#fff' : '#000' }]}>
                  {t('home.welcome', { name: userName })}
                </Text>
              </View>
            </View>
            <Pressable 
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/notifications')}
            >
              <IconSymbol name="bell.fill" size={26} color={theme.dark ? '#fff' : '#000'} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Current Case Status Card */}
          <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                {t('home.currentCaseStatus')}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/cases')}>
                <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
              </Pressable>
            </View>
            
            {/* Current Case Status */}
            {cases.length > 0 ? (
              cases.slice(0, 1).map((caseItem) => (
                <View key={caseItem.id} style={styles.statusRow}>
                  <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                    <IconSymbol name="hourglass" size={24} color="#2196F3" />
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={[styles.statusSubtitle, { color: theme.dark ? '#999' : '#666' }]}>
                      {caseItem.title} ({caseItem.caseNumber})
                    </Text>
                    <Text style={[styles.statusTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                      {caseItem.status === 'in-review' ? t('cases.underReview') : 
                       caseItem.status === 'action-required' ? t('cases.filterActionRequired') :
                       caseItem.status === 'approved' ? t('cases.approved') :
                       caseItem.status === 'pending' ? t('cases.submitted') : caseItem.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.statusRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                  <IconSymbol name="folder.fill" size={24} color="#2196F3" />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusSubtitle, { color: theme.dark ? '#999' : '#666' }]}>
                    {t('cases.noCases')}
                  </Text>
                  <Text style={[styles.statusTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                    {t('cases.newCase')}
                  </Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.dark ? '#333' : '#F0F0F0' }]} />

            {/* Next Appointment */}
            <View style={styles.statusRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                <IconSymbol name="calendar" size={24} color="#2196F3" />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusSubtitle, { color: theme.dark ? '#999' : '#666' }]}>
                  Next Appointment
                </Text>
                <Text style={[styles.statusTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                  October 20th, 10:00 AM
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Cards Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.statLabel, { color: theme.dark ? '#999' : '#666' }]}>
                {t('home.activeCases')}
              </Text>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>{activeCases.length}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.statLabel, { color: theme.dark ? '#999' : '#666' }]}>
                {t('home.pendingDocuments')}
              </Text>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>{pendingDocs}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.statLabel, { color: theme.dark ? '#999' : '#666' }]}>
                {t('home.newMessages')}
              </Text>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>{newMessages}</Text>
            </View>
          </View>

          {/* Quick Access Section */}
          <Text style={[styles.sectionTitle, { color: theme.dark ? '#fff' : '#000' }]}>
            {t('home.quickAccess')}
          </Text>
          <View style={styles.quickAccessGrid}>
            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => router.push('/cases/new')}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <IconSymbol name="plus.circle.fill" size={32} color="#2196F3" />
              </View>
              <Text style={[styles.quickAccessLabel, { color: theme.dark ? '#fff' : '#000' }]}>
                {t('cases.newCase')}
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => router.push('/documents/upload')}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <IconSymbol name="doc.fill" size={32} color="#2196F3" />
              </View>
              <Text style={[styles.quickAccessLabel, { color: theme.dark ? '#fff' : '#000' }]}>
                {t('home.uploadDocument')}
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => router.push({
                pathname: '/payment',
                params: {
                  amount: '150.00',
                  description: 'Case Processing Fee',
                  caseNumber: 'V-23-145'
                }
              })}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <IconSymbol name="creditcard.fill" size={32} color="#4CAF50" />
              </View>
              <Text style={[styles.quickAccessLabel, { color: theme.dark ? '#fff' : '#000' }]}>
                Make Payment
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => {
                // Navigate to cases first, user can select a case to chat about
                // Or if there's an active case, navigate directly to its chat
                if (cases.length > 0) {
                  router.push({
                    pathname: '/chat',
                    params: { id: cases[0].id, caseId: cases[0].id }
                  });
                } else {
                  router.push('/(tabs)/cases');
                }
              }}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <IconSymbol name="message.fill" size={32} color="#2196F3" />
              </View>
              <Text style={[styles.quickAccessLabel, { color: theme.dark ? '#fff' : '#000' }]}>
                {t('home.getHelp')}
              </Text>
            </Pressable>
          </View>

          {/* Important Updates Section */}
          <Text style={[styles.sectionTitle, { color: theme.dark ? '#fff' : '#000' }]}>
            Important Updates
          </Text>

          {/* Update Card 1 - Success */}
          <View style={[styles.updateCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={[styles.updateIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <IconSymbol name="checkmark.circle.fill" size={32} color="#4CAF50" />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                Case V-23-145 Approved!
              </Text>
              <Text style={[styles.updateDescription, { color: theme.dark ? '#999' : '#666' }]}>
                Your visa application has been approved. Further instructions have been sent to your email.
              </Text>
            </View>
          </View>

          {/* Update Card 2 - Warning */}
          <View style={[styles.updateCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={[styles.updateIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={32} color="#FF9800" />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: theme.dark ? '#fff' : '#000' }]}>
                Action Required: Document Submission
              </Text>
              <Text style={[styles.updateDescription, { color: theme.dark ? '#999' : '#666' }]}>
                Please upload a copy of your new passport for case V-23-188.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
  },
  
  // Header Section
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9966',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Card Styles
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },

  // Stats Cards
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 100,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
  },

  // Section Title
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Quick Access Grid
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickAccessButton: {
    width: '48%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  quickAccessIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickAccessLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Update Cards
  updateCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  updateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  updateTextContainer: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  updateDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
});

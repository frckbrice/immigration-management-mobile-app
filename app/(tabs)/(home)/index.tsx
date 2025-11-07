
import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Stack, useRouter } from "expo-router";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, Image, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth/authStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useScrollContext } from "@/contexts/ScrollContext";
import { dashboardService } from "@/lib/services/dashboardService";
import { logger } from "@/lib/utils/logger";
import type { DashboardStats } from "@/lib/types";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

const normalizeStatus = (status?: string | null) => (status ?? '').toLowerCase();
const formatServiceTypeLabel = (serviceType?: string) =>
  serviceType
    ? serviceType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/(^|\s)\w/g, (char) => char.toUpperCase())
    : '';

export default function HomeScreen() {
  console.log('[HomeScreen] Component rendering');
  const theme = useAppTheme();
  const colors = useThemeColors();
  const surfaceCard = theme.dark ? colors.surfaceElevated : colors.surface;
  const iconTint = useMemo(
    () => withOpacity(colors.primary, theme.dark ? 0.35 : 0.12),
    [colors.primary, theme.dark]
  );
  const successTint = useMemo(
    () => withOpacity(colors.success, theme.dark ? 0.35 : 0.16),
    [colors.success, theme.dark]
  );
  const warningTint = useMemo(
    () => withOpacity(colors.warning, theme.dark ? 0.35 : 0.2),
    [colors.warning, theme.dark]
  );
  const router = useRouter();
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setScrollDirection, setAtBottom } = useScrollContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const statsCacheRef = useRef<{ data: DashboardStats | null; fetchedAt: number }>({ data: null, fetchedAt: 0 });
  const statsUpdateRef = useRef(false);
  const { user, isAuthenticated } = useAuthStore();
  const { cases, fetchCases } = useCasesStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const { messages, fetchMessages } = useMessagesStore();
  const { documents, fetchDocuments } = useDocumentsStore();
  const { showAlert } = useBottomSheetAlert();
  const tabBarHeight = useBottomTabBarHeight();

  const scrollContentPaddingBottom = useMemo(() => tabBarHeight + 40, [tabBarHeight]);

  const formatCaseDate = (dateString?: string | null) => {
    if (!dateString) {
      return t('common.unknownDate', { defaultValue: 'Unknown date' });
    }
    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) {
      return t('common.unknownDate', { defaultValue: 'Unknown date' });
    }
    return parsedDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCaseStatusLabel = (status?: string | null) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'submitted':
        return t('cases.submitted');
      case 'under_review':
      case 'under-review':
        return t('cases.underReview');
      case 'documents_required':
      case 'action-required':
        return t('cases.filterActionRequired');
      case 'processing':
        return t('cases.processing');
      case 'approved':
        return t('cases.approved');
      case 'rejected':
        return t('cases.rejected');
      case 'closed':
        return t('cases.closed', { defaultValue: 'Closed' });
      default:
        return status || t('cases.statusUnknown', { defaultValue: 'Unknown status' });
    }
  };

  const refreshStats = useCallback(
    (force = false) => {
      if (!isAuthenticated) {
        setStats(null);
        return Promise.resolve();
      }

      const now = Date.now();
      if (!force && statsCacheRef.current.data && now - statsCacheRef.current.fetchedAt < 60_000) {
        setStats(statsCacheRef.current.data);
        return Promise.resolve();
      }

      return dashboardService
        .getStats()
        .then((data) => {
          statsCacheRef.current = { data, fetchedAt: now };
          setStats(data);
        })
        .catch((error) => {
          logger.error('Failed to fetch dashboard stats', error);
        });
    },
    [isAuthenticated]
  );

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Helper function to navigate to payment with type safety
  // Platform-specific routes (payment.native.tsx, payment.web.tsx) are resolved at runtime
  const navigateToPayment = (params: { amount: string; description: string; referenceNumber: string }) => {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const route = `/payment?${queryString}`;
    logger.info('Navigating to payment screen', {
      route,
      referenceNumber: params.referenceNumber,
      amount: params.amount,
    });
    // Type assertion: platform-specific routes aren't in typed routes but work at runtime
    router.push(route as typeof route & Parameters<typeof router.push>[0]);
  };

  useEffect(() => {
    console.log('[HomeScreen] Mounted, isAuthenticated:', isAuthenticated);
    console.log('[HomeScreen] User:', user?.email || 'No user');

    // Only fetch data if user is authenticated
    if (isAuthenticated && user) {
      Promise.all([
        fetchCases(),
        fetchUnreadCount(),
        fetchMessages(),
        fetchDocuments(),
      ]).finally(() => {
        refreshStats(true);
      });
    }

    // Initialize: assume we're at bottom when page loads
    setAtBottom(true);
    setScrollDirection(false); // Not scrolling down initially

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user, setAtBottom, setScrollDirection, fetchCases, fetchUnreadCount, fetchMessages, fetchDocuments, refreshStats]);

  const sortedCases = useMemo(() => {
    if (!cases || cases.length === 0) {
      return [] as typeof cases;
    }
    return [...cases].sort((a, b) => {
      const dateA = new Date(a.lastUpdated || a.submissionDate || 0);
      const dateB = new Date(b.lastUpdated || b.submissionDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [cases]);

  const activeCases = useMemo(() => {
    return sortedCases.filter((caseItem) => {
      const status = normalizeStatus(caseItem.status);
      return ['submitted', 'under_review', 'documents_required', 'processing'].includes(status);
    });
  }, [sortedCases]);

  const latestActiveCase = useMemo(() => {
    return (
      sortedCases.find((caseItem) => {
        const status = normalizeStatus(caseItem.status);
        return ['submitted', 'under_review', 'documents_required', 'processing'].includes(status);
      }) ?? null
    );
  }, [sortedCases]);

  const latestCase = sortedCases[0] ?? null;
  const caseForStatusCard = latestActiveCase ?? latestCase;

  const latestApprovedCase = useMemo(() => {
    return (
      sortedCases.find((caseItem) => normalizeStatus(caseItem.status) === 'approved') ?? null
    );
  }, [sortedCases]);

  const upcomingActionCase = useMemo(() => {
    return (
      sortedCases.find((caseItem) => {
        const status = normalizeStatus(caseItem.status);
        return ['action-required', 'pending'].includes(status);
      }) ?? null
    );
  }, [sortedCases]);

  const pendingDocsCount = stats?.pendingDocuments ?? documents.length;
  const activeCasesCount = stats?.activeCases ?? activeCases.length;
  const newMessagesCount = useMemo(() => messages.filter((m) => m.unread).length, [messages]);

  useEffect(() => {
    if (!isAuthenticated) {
      statsUpdateRef.current = false;
      return;
    }
    if (!statsUpdateRef.current) {
      statsUpdateRef.current = true;
      return;
    }
    refreshStats(true);
  }, [isAuthenticated, cases.length, documents.length, unreadCount, newMessagesCount, refreshStats]);

  const importantUpdatesTitle = t('home.importantUpdates', { defaultValue: 'Important Updates' });
  const paymentDescription = t('home.paymentDescription', { defaultValue: 'Case Processing Fee' });
  const paymentButtonLabel = t('home.makePayment', { defaultValue: 'Make Payment' });

  const approvedUpdateTitle = latestApprovedCase
    ? t('home.caseApprovedTitle', {
      defaultValue: '{{service}} ({{reference}}) Approved',
      service: formatServiceTypeLabel(latestApprovedCase.serviceType),
      reference: latestApprovedCase.referenceNumber,
    })
    : t('home.noRecentApprovalsTitle', { defaultValue: 'No cases approved yet' });

  const approvedUpdateDescription = latestApprovedCase
    ? t('home.caseApprovedDescription', {
      defaultValue: 'Case {{reference}} was approved on {{date}}.',
      reference: latestApprovedCase.referenceNumber,
      date: formatCaseDate(latestApprovedCase.approvedAt || latestApprovedCase.lastUpdated),
    })
    : t('home.noRecentApprovalsDescription', {
      defaultValue: 'You will be notified when a case is approved.',
    });

  const pendingUpdateTitle = upcomingActionCase
    ? t('home.pendingActionTitle', {
      defaultValue: 'Action Required: {{service}} ({{reference}})',
      service: formatServiceTypeLabel(upcomingActionCase.serviceType),
      reference: upcomingActionCase.referenceNumber,
    })
    : t('home.noPendingActionsTitle', { defaultValue: 'No pending actions' });

  const pendingUpdateDescription = upcomingActionCase
    ? t('home.pendingActionDescription', {
      defaultValue: 'Latest update on {{date}}. Please review the case details.',
      date: formatCaseDate(upcomingActionCase.lastUpdated || upcomingActionCase.submissionDate),
    })
    : t('home.noPendingActionsDescription', {
      defaultValue: 'Great job! You are all caught up.',
    });

  const upcomingAppointment = useMemo(() => {
    const now = Date.now();
    const futureCases = sortedCases.filter((caseItem) => {
      if (!caseItem.estimatedCompletion) return false;
      const time = new Date(caseItem.estimatedCompletion).getTime();
      return time > now;
    });

    futureCases.sort((a, b) => {
      const timeA = new Date(a.estimatedCompletion || 0).getTime();
      const timeB = new Date(b.estimatedCompletion || 0).getTime();
      return timeA - timeB;
    });

    return futureCases[0] ?? null;
  }, [sortedCases]);

  const nextAppointmentLabel = t('home.nextAppointment', { defaultValue: 'Next Appointment' });
  const nextAppointmentValue = upcomingAppointment
    ? t('home.nextAppointmentValueWithCase', {
      defaultValue: '{{date}} · {{reference}}',
      date: formatCaseDate(upcomingAppointment.estimatedCompletion),
      reference: upcomingAppointment.referenceNumber,
    })
    : t('home.noUpcomingAppointments', { defaultValue: 'No upcoming appointments' });

  const userName = user?.displayName || user?.email?.split('@')[0] || t('home.defaultUserName', { defaultValue: 'User' });

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
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollContentPaddingBottom }
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const currentScrollY = event.nativeEvent.contentOffset.y;
            const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
            const contentHeight = event.nativeEvent.contentSize.height;

            // Clear any pending timeout
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }

            // Debounce state updates to prevent excessive re-renders
            scrollTimeoutRef.current = setTimeout(() => {
              // Check if at bottom (with 50px threshold)
              const isAtBottom = currentScrollY + scrollViewHeight >= contentHeight - 50;
              setAtBottom(isAtBottom);

              // Determine scroll direction (only update if changed significantly)
              const scrollDiff = currentScrollY - lastScrollY.current;
              if (Math.abs(scrollDiff) > 5) { // Only update if scrolled more than 5px
                if (scrollDiff > 0) {
                  // Scrolling down
                  setScrollDirection(true);
                } else {
                  // Scrolling up
                  setScrollDirection(false);
                }
                lastScrollY.current = currentScrollY;
              }
            }, 50); // Debounce by 50ms
          }}
          scrollEventThrottle={16}
        >
          {/* Header with Greeting and Notification */}
          <View style={styles.header}>
            <View style={styles.greetingContainer}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                <IconSymbol name="mail.fill" size={28} color={colors.onPrimary} />
              </View>
              <View style={styles.greetingTextContainer}>
                <Text style={[styles.greetingText, { color: colors.muted }]}>
                  {t('home.goodMorning')}
                </Text>
                <Text style={[styles.welcomeText, { color: colors.text }]}>
                  {t('home.welcome', { name: userName })}
                </Text>
              </View>
            </View>
            <Pressable 
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/notifications')}
            >
              <IconSymbol name="bell.fill" size={26} color={colors.text} />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: colors.danger }]}>
                  <Text style={[styles.notificationBadgeText, { color: colors.onPrimary }]}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Current Case Status Card */}
          <View style={[styles.card, { backgroundColor: surfaceCard }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('home.currentCaseStatus')}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/cases')}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('common.viewAll')}</Text>
              </Pressable>
            </View>
            
            {/* Current Case Status */}
            {caseForStatusCard ? (
              <View key={caseForStatusCard.id} style={styles.statusRow}>
                <View style={[styles.iconCircle, { backgroundColor: iconTint }]}>
                  <IconSymbol name="hourglass" size={24} color={colors.primary} />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusSubtitle, { color: colors.muted }]}>
                    {formatServiceTypeLabel(caseForStatusCard.serviceType)} ({caseForStatusCard.referenceNumber})
                  </Text>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {getCaseStatusLabel(caseForStatusCard.status)}
                  </Text>
                  <Text style={[styles.statusMeta, { color: colors.mutedAlt }]}>
                    {t('home.updatedOn', {
                      defaultValue: 'Updated on {{date}}',
                      date: formatCaseDate(caseForStatusCard.lastUpdated || caseForStatusCard.submissionDate)
                    })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.statusRow}>
                  <View style={[styles.iconCircle, { backgroundColor: iconTint }]}>
                    <IconSymbol name="folder.fill" size={24} color={colors.primary} />
                </View>
                <View style={styles.statusTextContainer}>
                    <Text style={[styles.statusSubtitle, { color: colors.muted }]}>
                    {t('cases.noCases')}
                  </Text>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {t('cases.newCase')}
                  </Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Next Appointment */}
            <View style={styles.statusRow}>
              <View style={[styles.iconCircle, { backgroundColor: iconTint }]}>
                <IconSymbol name="calendar" size={24} color={colors.primary} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusSubtitle, { color: colors.muted }]}>
                  {nextAppointmentLabel}
                </Text>
                <Text style={[styles.statusTitle, { color: colors.text }]}>
                  {nextAppointmentValue}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Cards Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {t('home.activeCases')}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{activeCasesCount}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {t('home.pendingDocuments')}
              </Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>{pendingDocsCount}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {t('home.newMessages')}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{newMessagesCount}</Text>
            </View>
          </View>

          {/* Quick Access Section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('home.quickAccess')}
          </Text>
          <View style={styles.quickAccessGrid}>
            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: surfaceCard }]}
              onPress={() => router.push('/cases/new')}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: iconTint }]}>
                <IconSymbol name="plus.circle.fill" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {t('cases.newCase')}
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: surfaceCard }]}
              onPress={() => router.push('/documents/upload')}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: iconTint }]}>
                <IconSymbol name="doc.fill" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {t('home.uploadDocument')}
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: surfaceCard }]}
              onPress={() => {
                if (!caseForStatusCard?.referenceNumber) {
                  showAlert({
                    title: t('common.info', { defaultValue: 'Heads up' }),
                    message: t('home.noCaseForPayment', { defaultValue: 'No case is ready for payment yet.' }),
                    actions: [{ text: t('common.close'), variant: 'primary' }],
                  });
                  return;
                }
                navigateToPayment({
                  amount: '150.00',
                  description: paymentDescription,
                  referenceNumber: caseForStatusCard.referenceNumber,
                });
              }}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: successTint }]}>
                <IconSymbol name="creditcard.fill" size={32} color={colors.success} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {paymentButtonLabel}
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.quickAccessButton, { backgroundColor: surfaceCard }]}
              onPress={() => router.push('/support/contact')}
            >
              <View style={[styles.quickAccessIconCircle, { backgroundColor: iconTint }]}>
                <IconSymbol name="message.fill" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {t('home.getHelp')}
              </Text>
            </Pressable>
          </View>

          {/* Important Updates Section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {importantUpdatesTitle}
          </Text>

          {/* Update Card 1 - Success */}
          <View style={[styles.updateCard, { backgroundColor: surfaceCard }]}>
            <View style={[styles.updateIconCircle, { backgroundColor: successTint }]}>
              <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: colors.text }]}>
                {approvedUpdateTitle}
              </Text>
              <Text style={[styles.updateDescription, { color: colors.muted }]}>
                {approvedUpdateDescription}
              </Text>
            </View>
          </View>

          {/* Update Card 2 - Warning */}
          <View style={[styles.updateCard, { backgroundColor: surfaceCard }]}>
            <View style={[styles.updateIconCircle, { backgroundColor: warningTint }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={32} color={colors.warning} />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: colors.text }]}>
                {pendingUpdateTitle}
              </Text>
              <Text style={[styles.updateDescription, { color: colors.muted }]}>
                {pendingUpdateDescription}
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
    paddingBottom: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
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
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  notificationBadgeText: {
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
  statusMeta: {
    fontSize: 12,
    marginTop: 4,
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

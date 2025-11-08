import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, Modal, TouchableWithoutFeedback, RefreshControl } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth/authStore";
import { paymentsService } from "@/lib/services/paymentsService";
import type { PaymentRecord, Case } from "@/lib/types";
import { casesService } from "@/lib/services/casesService";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function PaymentHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const backendConfigured = true; // backend-driven payments
  const insets = useSafeAreaInsets();
  const [caseOptions, setCaseOptions] = useState<Case[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [isCasePickerVisible, setCasePickerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!backendConfigured || !user?.uid) {
      if (silent) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
      return;
    }
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const result = await paymentsService.getPaymentHistory(user.uid);
      setPayments(Array.isArray(result) ? result : []);
    } catch (e) {
      setPayments([]);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [backendConfigured, user?.uid]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useFocusEffect(
    useCallback(() => {
      fetchPayments({ silent: true });
    }, [fetchPayments])
  );

  const loadOutstandingCases = useCallback(async () => {
    if (!user?.uid) {
      setCaseOptions([]);
      return;
    }

    try {
      setCasesLoading(true);
      const result = await casesService.getCases({ limit: 100 });
      const outstanding = result.filter((item) => !['APPROVED', 'REJECTED', 'CLOSED'].includes(item.status));
      setCaseOptions(outstanding);
    } catch (error) {
      setCaseOptions([]);
    } finally {
      setCasesLoading(false);
    }
  }, [user?.uid]);

  const openCaseSheet = useCallback(async () => {
    console.log('[Payments] openCaseSheet tapped', { existing: caseOptions.length });
    if (!caseOptions.length) {
      try {
        await loadOutstandingCases();
      } catch (error) {
        console.warn('[Payments] Failed to load cases before presenting sheet', error);
      }
    }
    setCasePickerVisible(true);
  }, [caseOptions.length, loadOutstandingCases]);

  const closeCaseSheet = useCallback(() => {
    setCasePickerVisible(false);
  }, []);

  const handleSelectCase = useCallback((caseItem: Case) => {
    const amount = deriveCaseAmount(caseItem);
    closeCaseSheet();
    router.push({
      pathname: '/payment',
      params: {
        referenceNumber: caseItem.referenceNumber,
        description: caseItem.displayName,
        amount: amount.toFixed(2),
      },
    });
  }, [closeCaseSheet, router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark.circle.fill';
      case 'pending':
        return 'clock.fill';
      case 'failed':
        return 'xmark.circle.fill';
      default:
        return 'circle.fill';
    }
  };

  const getPaymentStatusLabel = useCallback((status: string) => {
    const normalized = normalizeStatusKey(status);
    return t(`payments.history.status.${normalized}`, {
      defaultValue: formatStatusLabel(status),
    });
  }, [t]);

  const getCaseStatusLabel = useCallback((status: string) => {
    const normalized = normalizeStatusKey(status);
    return t(`cases.statusLabels.${normalized}`, {
      defaultValue: formatStatusLabel(status),
    });
  }, [t]);

  const getPriorityLabel = useCallback((priority: Case['priority']) => {
    const normalized = normalizeStatusKey(priority);
    return t(`cases.priority.${normalized}`, {
      defaultValue: formatStatusLabel(priority),
    });
  }, [t]);

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
        style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('payments.history.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPayments({ silent: true })}
              tintColor={theme.colors.primary}
            />
          )}
        >
          {/* Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>{t('payments.history.summary.totalPaid')}</Text>
                <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
                  ${payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>{t('payments.history.summary.transactions')}</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{payments.length}</Text>
              </View>
            </View>
          </View>

          {/* Payment List */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('payments.history.recentPayments')}
          </Text>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : payments.map((payment) => {
            const caseReference = payment.caseNumber || payment.metadata?.caseNumber || null;
            return (
              <Pressable
                key={payment.id}
                style={[styles.paymentCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
                onPress={() => console.log('Payment details:', payment.id)}
              >
                <View style={styles.paymentHeader}>
                  <View style={[styles.paymentIconCircle, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}>
                    <IconSymbol name="creditcard.fill" size={24} color="#2196F3" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentDescription, { color: theme.colors.text }]}>
                      {payment.description}
                    </Text>
                    <Text style={[styles.paymentCase, { color: theme.dark ? '#999' : '#666' }]}>
                      {t('payments.history.caseLabel', {
                        caseNumber: caseReference ?? t('payments.history.caseUnknown'),
                      })}
                    </Text>
                  </View>
                  <View style={styles.paymentAmount}>
                    <Text style={[styles.amountText, { color: theme.colors.text }]}>
                      ${payment.amount.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]} />

                <View style={styles.paymentFooter}>
                  <View style={styles.statusContainer}>
                    <IconSymbol
                      name={getStatusIcon(payment.status)}
                      size={16}
                      color={getStatusColor(payment.status)}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                      {getPaymentStatusLabel(payment.status)}
                    </Text>
                  </View>
                  <Text style={[styles.dateText, { color: theme.dark ? '#999' : '#666' }]}>
                    {payment.date}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {/* Empty State (if no payments) */}
          {!isLoading && payments.length === 0 && (
            <View style={styles.emptyState}>
              <IconSymbol name="creditcard" size={64} color={theme.dark ? '#FFB020' : '#F97316'} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
                {t('payments.history.empty.title')}
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.dark ? '#999' : '#666' }]}>
                {t('payments.history.empty.description')}
              </Text>
            </View>
          )}

          {/* Make New Payment Button */}
          <Pressable 
            style={styles.newPaymentButton}
            onPress={openCaseSheet}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#fff" />
            <Text style={styles.newPaymentButtonText}>{t('payments.history.actions.makePayment')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isCasePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCaseSheet}
      >
        <TouchableWithoutFeedback onPress={closeCaseSheet}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheetContainer, { backgroundColor: theme.dark ? '#0F172A' : '#FFFFFF' }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{t('payments.history.sheet.title')}</Text>
            <Text style={[styles.sheetSubtitle, { color: theme.dark ? '#94A3B8' : '#64748B' }]}>
              {t('payments.history.sheet.subtitle')}
            </Text>
          </View>

          {casesLoading ? (
            <View style={styles.sheetLoader}>
              <ActivityIndicator />
            </View>
          ) : caseOptions.length > 0 ? (
            <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
              {caseOptions.map((caseItem) => (
                <Pressable
                  key={caseItem.id}
                  style={[styles.caseCard, {
                    backgroundColor: theme.dark ? '#111827' : '#F8FAFC',
                    borderColor: theme.dark ? '#1F2937' : '#E2E8F0',
                    shadowColor: theme.dark ? '#020617' : '#CBD5F5',
                  }]}
                  onPress={() => handleSelectCase(caseItem)}
                >
                  <View style={styles.caseHeader}>
                    <View style={[styles.caseBadge, { backgroundColor: theme.dark ? '#1D4ED8' : '#DBEAFE' }]}>
                      <IconSymbol name="folder.fill" size={18} color={theme.dark ? '#E0F2FE' : '#1D4ED8'} />
                    </View>
                    <Text style={[styles.caseReference, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {caseItem.referenceNumber}
                    </Text>
                    <View style={styles.amountPill}>
                      <Text style={styles.amountPillText}>${deriveCaseAmount(caseItem).toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.caseDescription, { color: theme.dark ? '#94A3B8' : '#475569' }]}>{caseItem.displayName}</Text>
                  <View style={styles.caseMetaRow}>
                    <View style={styles.caseMetaItem}>
                      <IconSymbol name="chart.bar.fill" size={14} color={theme.dark ? '#F97316' : '#F97316'} />
                      <Text style={[styles.caseMetaText, { color: theme.dark ? '#F97316' : '#F97316' }]}
                      >
                        {getCaseStatusLabel(caseItem.status)}
                      </Text>
                    </View>
                    <View style={styles.caseMetaItem}>
                      <IconSymbol name="flag.fill" size={14} color={theme.dark ? '#FB923C' : '#FB923C'} />
                      <Text style={[styles.caseMetaText, { color: theme.dark ? '#FB923C' : '#FB923C' }]}
                      >
                        {t('payments.history.priorityLabel', { priority: getPriorityLabel(caseItem.priority) })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.caseMetaRowSecondary}>
                    <IconSymbol name="info.circle" size={14} color={theme.dark ? '#94A3B8' : '#64748B'} />
                    <Text style={[styles.caseMetaTextSecondary, { color: theme.dark ? '#94A3B8' : '#64748B' }]}>
                      {t('payments.history.sheet.secondaryInfo', { defaultValue: 'Tap to review and pay this case in full.' })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.sheetEmptyState}>
              <IconSymbol name="checkmark.seal" size={48} color={theme.dark ? '#1D4ED8' : '#94A3B8'} />
              <Text style={[styles.sheetEmptyTitle, { color: theme.colors.text }]}>{t('payments.history.sheet.empty.title')}</Text>
              <Text style={[styles.sheetEmptySubtitle, { color: theme.dark ? '#94A3B8' : '#64748B' }]}> {t('payments.history.sheet.empty.subtitle')} </Text>
            </View>
          )}

          <Pressable style={styles.sheetDismissButton} onPress={closeCaseSheet}>
            <Text style={styles.sheetDismissText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function deriveCaseAmount(caseItem: Case): number {
  const baseByPriority: Record<Case['priority'], number> = {
    URGENT: 1850,
    HIGH: 1550,
    NORMAL: 1125,
    LOW: 850,
  };
  const base = baseByPriority[caseItem.priority] ?? 995;
  const varianceSeed = caseItem.referenceNumber?.charCodeAt(0) || 42;
  const variance = (varianceSeed % 7) * 25;
  return base + variance;
}

function normalizeStatusKey(value: string | null | undefined) {
  if (!value) return 'unknown';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) {
    return '';
  }
  return status
    .toString()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  paymentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentCase: {
    fontSize: 14,
    fontWeight: '400',
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '400',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  newPaymentButton: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  newPaymentButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetHeader: {
    gap: 6,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetList: {
    gap: 12,
    paddingBottom: 12,
  },
  caseCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  caseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  caseBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseReference: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 12,
  },
  caseDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  caseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caseMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caseMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  caseMetaRowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  caseMetaTextSecondary: {
    fontSize: 12,
    flex: 1,
  },
  sheetEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  sheetEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetEmptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetDismissButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sheetDismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  amountPill: {
    borderRadius: 14,
    backgroundColor: '#22C55E1A',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  amountPillText: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '700',
  },
});

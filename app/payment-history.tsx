
import React from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

interface PaymentRecord {
  id: string;
  amount: number;
  description: string;
  caseNumber: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function PaymentHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Mock payment history data
  const payments: PaymentRecord[] = [
    {
      id: 'pi_1234567890',
      amount: 150.00,
      description: 'Case Processing Fee',
      caseNumber: 'V-23-145',
      date: 'Oct 15, 2024',
      status: 'completed',
    },
    {
      id: 'pi_0987654321',
      amount: 75.00,
      description: 'Document Translation Fee',
      caseNumber: 'V-23-145',
      date: 'Oct 10, 2024',
      status: 'completed',
    },
    {
      id: 'pi_1122334455',
      amount: 200.00,
      description: 'Application Fee',
      caseNumber: 'V-23-188',
      date: 'Oct 5, 2024',
      status: 'completed',
    },
  ];

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
        style={[styles.container, { backgroundColor: theme.colors.background }]} 
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Payment History</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>
                  Total Paid
                </Text>
                <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
                  ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>
                  Transactions
                </Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {payments.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment List */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Recent Payments
          </Text>

          {payments.map((payment) => (
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
                    Case: {payment.caseNumber}
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
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: theme.dark ? '#999' : '#666' }]}>
                  {payment.date}
                </Text>
              </View>
            </Pressable>
          ))}

          {/* Empty State (if no payments) */}
          {payments.length === 0 && (
            <View style={styles.emptyState}>
              <IconSymbol name="creditcard" size={64} color={theme.dark ? '#333' : '#E0E0E0'} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
                No Payments Yet
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.dark ? '#999' : '#666' }]}>
                Your payment history will appear here
              </Text>
            </View>
          )}

          {/* Make New Payment Button */}
          <Pressable 
            style={styles.newPaymentButton}
            onPress={() => router.push('/payment')}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#fff" />
            <Text style={styles.newPaymentButtonText}>Make New Payment</Text>
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
});

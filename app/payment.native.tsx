
import React, { useState, useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY, getStripeUrlScheme } from '@/utils/stripeConfig';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { useToast } from '@/components/Toast';
import { paymentsService } from '@/lib/services/paymentsService';
import { useAuthStore } from '@/stores/auth/authStore';
import { logger } from '@/lib/utils/logger';

export default function PaymentScreen() {
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { confirmPayment } = useStripe();
  const user = useAuthStore((state) => state.user);

  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Get payment details from params or use defaults
  const amount = params.amount ? parseFloat(params.amount as string) : 100.0;
  const description = params.description as string || 'Case Processing Fee';
  const referenceNumber = (params.referenceNumber as string) || (params.caseNumber as string) || 'PT-REF-000';

  const handlePayment = async () => {
    if (!cardComplete) {
      logger.warn('Payment attempted with incomplete card details', {
        referenceNumber,
        amount,
      });
      showAlert({ title: 'Incomplete Card', message: 'Please enter complete card details' });
      return;
    }

    setLoading(true);

    let paymentWasSuccessful = false;
    try {
      logger.info('Creating payment intent', {
        amount,
        description,
        referenceNumber,
      });
      // Step 1: Create Payment Intent on backend (amount in major units)
      const paymentIntent = await paymentsService.createPaymentIntent({
        amount,
        currency: 'usd',
        description,
        metadata: {
          caseNumber: referenceNumber,
          userId: user?.uid,
        },
      });

      if (!paymentIntent.clientSecret) {
        logger.error('Payment intent missing client secret', { paymentIntentId: paymentIntent.id });
        throw new Error('Backend did not return client secret for payment confirmation');
      }

      // Step 2: Confirm the payment with Stripe SDK
      logger.info('Confirming payment intent with Stripe', { paymentIntentId: paymentIntent.id });
      const { error, paymentIntent: confirmedIntent } = await confirmPayment(paymentIntent.clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        logger.error('Stripe confirmation failed', {
          paymentIntentId: paymentIntent.id,
          error: error.message,
        });
        showAlert({ 
          title: 'Payment Failed', 
          message: error.message || 'An error occurred during payment processing' 
        });
        return;
      }

      if (confirmedIntent) {
        logger.info('Stripe confirmed payment intent', {
          paymentIntentId: confirmedIntent.id,
          status: confirmedIntent.status,
        });
        // Step 3: Verify payment status with backend
        try {
          logger.info('Verifying payment status with backend', { paymentIntentId: paymentIntent.id });
          const verifiedIntent = await paymentsService.verifyPaymentStatus(paymentIntent.id);
          
          if (verifiedIntent.status === 'succeeded') {
            logger.info('Payment verified as succeeded', { paymentIntentId: paymentIntent.id });
            paymentWasSuccessful = true;
            showToast({
              type: 'success',
              title: 'Payment Successful',
              message: `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
            });
            showAlert({
              title: 'Payment Successful!',
              message: `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
              actions: [{ text: 'OK', onPress: () => router.back(), variant: 'primary' }]
            });
          } else {
            logger.warn('Payment verification returned non-success status', {
              paymentIntentId: paymentIntent.id,
              status: verifiedIntent.status,
            });
            showToast({
              type: 'info',
              title: 'Payment Processing',
              message: 'Your payment is being processed. Check your history for updates.',
            });
            showAlert({
              title: 'Payment Processing',
              message: 'Your payment is being processed. Please check your payment history for updates.',
              actions: [{ text: 'OK', onPress: () => router.back(), variant: 'primary' }]
            });
          }
        } catch (verifyError: any) {
          // If verification fails but Stripe confirmed, still show success
          // Backend webhook will update status
          logger.error('Payment verification failed after Stripe confirmation', {
            paymentIntentId: paymentIntent.id,
            error: verifyError?.message,
          });
          paymentWasSuccessful = true;
          showToast({
            type: 'success',
            title: 'Payment Submitted',
            message: `Your payment of $${amount.toFixed(2)} has been submitted. You will receive a confirmation shortly.`,
          });
          showAlert({
            title: 'Payment Submitted',
            message: `Your payment of $${amount.toFixed(2)} has been submitted. You will receive a confirmation shortly.`,
            actions: [{ text: 'OK', onPress: () => router.back(), variant: 'primary' }]
          });
        }
      }
    } catch (error: any) {
      logger.error('Unhandled payment error', {
        referenceNumber,
        amount,
        error: error?.message,
      });
      showToast({
        type: 'error',
        title: 'Payment Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
      });
      showAlert({ 
        title: 'Payment Error', 
        message: error.message || 'An unexpected error occurred. Please try again.' 
      });
    } finally {
      logger.info('Payment flow finished', {
        referenceNumber,
        amount,
        success: paymentWasSuccessful,
      });
      setLoading(false);
    }
  };

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      urlScheme={getStripeUrlScheme()}
      merchantIdentifier="merchant.com.yourapp"
    >
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Payment</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Payment Summary Card */}
          <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.summaryHeader}>
              <IconSymbol name="creditcard.fill" size={32} color="#2196F3" />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Payment Summary
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>
                Case Reference:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {referenceNumber}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.dark ? '#999' : '#666' }]}>
                Description:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {description}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.dark ? '#333' : '#E0E0E0' }]} />

            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
                Total Amount:
              </Text>
              <Text style={[styles.totalValue, { color: '#2196F3' }]}>
                ${amount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Test Mode Notice */}
          <View style={[styles.testModeNotice, { backgroundColor: '#FFF3E0' }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF9800" />
            <Text style={[styles.testModeText, { color: '#F57C00' }]}>
              Test Mode: Use card 4242 4242 4242 4242 with any future date and CVC
            </Text>
          </View>

          {/* Card Input Section */}
          <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Card Details
            </Text>

            <View style={[
              styles.cardFieldContainer,
              {
                backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5',
                borderColor: theme.dark ? '#3C3C3E' : '#E0E0E0',
              }
            ]}>
              <CardField
                postalCodeEnabled={false}
                placeholders={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={{
                  backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5',
                  textColor: theme.dark ? '#FFFFFF' : '#000000',
                  placeholderColor: theme.dark ? '#666666' : '#999999',
                }}
                style={styles.cardField}
                onCardChange={(cardDetails) => {
                  console.log('Card details changed:', cardDetails.complete);
                  setCardComplete(cardDetails.complete);
                }}
              />
            </View>

            <View style={styles.securityNotice}>
              <IconSymbol name="lock.fill" size={16} color="#4CAF50" />
              <Text style={[styles.securityText, { color: theme.dark ? '#999' : '#666' }]}>
                Your payment information is encrypted and secure
              </Text>
            </View>
          </View>

          {/* Payment Information */}
          <View style={[styles.infoCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
              Payment Information
            </Text>
            <Text style={[styles.infoText, { color: theme.dark ? '#999' : '#666' }]}>
              • Payments are processed securely through Stripe{'\n'}
              • You will receive a receipt via email{'\n'}
              • Refunds take 5-10 business days{'\n'}
              • Contact support for payment issues
            </Text>
            <Pressable onPress={() => router.push('/support/contact')} style={styles.supportLinkContainer}>
              <Text style={styles.supportLinkText}>Contact support for payment issues</Text>
            </Pressable>
          </View>

          {/* Pay Button */}
          <Pressable
            style={[
              styles.payButton,
              (!cardComplete || loading) && styles.payButtonDisabled
            ]}
            onPress={handlePayment}
            disabled={!cardComplete || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay ${amount.toFixed(2)}
                </Text>
              </>
            )}
          </Pressable>

          {/* Cancel Button */}
          <Pressable
            style={[styles.cancelButton, { borderColor: '#2196F3', backgroundColor: theme.dark ? '#1C1C1E' : '#ffffff' }]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: '#2196F3' }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </StripeProvider>
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
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  testModeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  testModeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  cardFieldContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  securityText: {
    fontSize: 13,
    marginLeft: 6,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  supportLinkContainer: {
    marginTop: 8,
  },
  supportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
  },
  payButton: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  payButtonDisabled: {
    backgroundColor: '#999',
    shadowOpacity: 0,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

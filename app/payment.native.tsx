
import React, { useState, useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, Alert, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY, getStripeUrlScheme } from '@/utils/stripeConfig';

export default function PaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { confirmPayment } = useStripe();

  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Get payment details from params or use defaults
  const amount = params.amount ? parseFloat(params.amount as string) : 100.00;
  const description = params.description as string || 'Case Processing Fee';
  const caseNumber = params.caseNumber as string || 'V-23-145';

  const handlePayment = async () => {
    if (!cardComplete) {
      Alert.alert('Incomplete Card', 'Please enter complete card details');
      return;
    }

    setLoading(true);
    console.log('Starting payment process...');

    try {
      // In a real app, you would call your backend to create a PaymentIntent
      // For now, we'll simulate the payment process

      // Step 1: Create Payment Intent on your backend
      const paymentIntentResponse = await createPaymentIntent(amount, description);

      if (!paymentIntentResponse.clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      console.log('Payment intent created:', paymentIntentResponse.id);

      // Step 2: Confirm the payment with Stripe
      const { error, paymentIntent } = await confirmPayment(paymentIntentResponse.clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Payment confirmation error:', error);
        Alert.alert(
          'Payment Failed',
          error.message || 'An error occurred during payment processing'
        );
      } else if (paymentIntent) {
        console.log('Payment successful:', paymentIntent.id);
        setPaymentSuccess(true);
        Alert.alert(
          'Payment Successful!',
          `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Simulate backend call to create payment intent
  // In production, this should call your Supabase Edge Function or backend API
  const createPaymentIntent = async (amount: number, description: string) => {
    console.log('Creating payment intent for amount:', amount);

    // This is a mock response - in production, call your backend
    // Example: const response = await fetch('YOUR_SUPABASE_EDGE_FUNCTION_URL/create-payment-intent', {...})

    // For testing purposes, we'll return a mock client secret
    // NOTE: This won't actually process a payment - you need a real backend
    return {
      id: 'pi_test_' + Math.random().toString(36).substring(7),
      clientSecret: 'pi_test_secret_' + Math.random().toString(36).substring(7),
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
    };
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
                Case Number:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {caseNumber}
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
                postalCodeEnabled={true}
                placeholders={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={{
                  backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5',
                  textColor: theme.dark ? '#fff' : '#000',
                  placeholderColor: theme.dark ? '#666' : '#999',
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
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
              Cancel
            </Text>
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
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

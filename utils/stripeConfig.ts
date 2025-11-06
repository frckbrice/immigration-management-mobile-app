
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51234567890abcdefghijklmnopqrstuvwxyz'; // Replace with your actual test publishable key

// Get the proper URL scheme for redirects
export const getStripeUrlScheme = () => {
  if (Constants.appOwnership === 'expo') {
    return Linking.createURL('/--/');
  }
  return Linking.createURL('');
};

// Merchant identifier for Apple Pay (iOS only)
export const MERCHANT_IDENTIFIER = 'merchant.com.yourapp'; // Replace with your actual merchant ID

console.log('Stripe config initialized with URL scheme:', getStripeUrlScheme());

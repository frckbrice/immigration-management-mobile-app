import { Platform } from "react-native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";

// Stripe configuration (prefer env/extra, fallback to placeholder)
export const STRIPE_PUBLISHABLE_KEY =
  (Constants.expoConfig?.extra as any)?.stripePublishableKey ||
  (process.env as any)?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51234567890abcdefghijklmnopqrstuvwxyz";

// Get the proper URL scheme for redirects
export const getStripeUrlScheme = () => {
  if (Constants.appOwnership === "expo") {
    return Linking.createURL("/--/");
  }
  return Linking.createURL("");
};

// Merchant identifier for Apple Pay (iOS only)
export const MERCHANT_IDENTIFIER =
  (Constants.expoConfig?.extra as any)?.appleMerchantId ||
  (process.env as any)?.EXPO_PUBLIC_APPLE_MERCHANT_ID ||
  "merchant.com.yourapp";

console.log("Stripe config initialized with URL scheme:", getStripeUrlScheme());

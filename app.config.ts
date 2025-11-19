import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'Patrick Travel agency',
  slug: config.slug || 'patrick-travel-service-mobile-2',
  version: config.version || '1.0.0',
  owner: config.owner || 'ubuntu-dev-group',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ubuntu.patrickagency',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#e7eeff',
    },
    edgeToEdgeEnabled: true,
    package: 'com.ubuntu.patrickagency',
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'com.google.android.c2dm.permission.RECEIVE',
      "CAMERA", "RECORD_AUDIO", "INTERNET", "WAKE_LOCK"
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  scheme: 'patrick-agency',
  plugins: [
    'expo-font',
    'expo-router',
    'expo-asset',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#0066CC',
        sound: true,
        defaultChannel: 'default',
      },
    ],
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: 'merchant.com.yourapp',
        enableGooglePay: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#e7eeff',
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        imageWidth: 200,
        dark: {
          backgroundColor: '#1f2937',
          image: './assets/splash-icon-dark.png',
          imageWidth: 200,
          resizeMode: 'contain',
        },
      },
    ]
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    // Always prefer explicit PROD URL if present, otherwise fall back to DEV URL
    apiUrl:
      process.env.EXPO_PUBLIC_API_PROD_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      'http://localhost:3000/api',
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseDatabaseUrl: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    eas: {
      projectId: 'bc0069cd-836a-45fb-8a75-c1bc726660b3',
    },
  },
});


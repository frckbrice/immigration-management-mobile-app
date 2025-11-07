// Firebase configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For React Native, we need to use ReactNativeAsyncStorage adapter
// Firebase v12+ uses a different persistence mechanism
let ReactNativeAsyncStorage: any;
try {
  ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  ReactNativeAsyncStorage = AsyncStorage;
}

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
  databaseURL: Constants.expoConfig?.extra?.firebaseDatabaseUrl,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase config is missing required fields:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  });
}

const ensureAuth = (firebaseApp: FirebaseApp) => {
  try {
    // Lazy load to avoid bundler errors when the optional module is unavailable at build time
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { getReactNativePersistence } = require('firebase/auth/react-native');
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (error: any) {
    if (error?.code === 'auth/already-initialized') {
      return getAuth(firebaseApp);
    }
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.message?.includes('firebase/auth/react-native')) {
      // Fallback to default persistence (memory) when the helper isn't available
      return initializeAuth(firebaseApp);
    }
    throw error;
  }
};

let app: FirebaseApp;
let authInstance: ReturnType<typeof getAuth>;
let database: ReturnType<typeof getDatabase>;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  authInstance = ensureAuth(app);
  database = getDatabase(app);
} else {
  app = getApps()[0];
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = ensureAuth(app);
  }
  database = getDatabase(app);
}

// Export messaging sender ID for FCM integration
export const messagingSenderId = firebaseConfig.messagingSenderId;

export const auth = authInstance;
export { app, database };


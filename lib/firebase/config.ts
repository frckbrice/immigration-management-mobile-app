// Firebase configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import Constants from 'expo-constants';

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

let app: FirebaseApp;
let auth: ReturnType<typeof getAuth>;
let database: ReturnType<typeof getDatabase>;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // Initialize Auth - Firebase automatically handles persistence in React Native
  // No need to explicitly set persistence option
  try {
    auth = initializeAuth(app);
  } catch (error: any) {
    // If auth already initialized (e.g., hot reload), use getAuth instead
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
  database = getDatabase(app);
} else {
  app = getApps()[0];
  auth = getAuth(app);
  database = getDatabase(app);
}

// Export messaging sender ID for FCM integration
export const messagingSenderId = firebaseConfig.messagingSenderId;

export { app, auth, database };


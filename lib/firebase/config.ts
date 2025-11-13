// // Firebase configuration
// import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
// import { getDatabase } from 'firebase/database';
// import Constants from 'expo-constants';
// import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// import { logger } from '../utils/logger';





// // For React Native, we need to use ReactNativeAsyncStorage adapter"
// // Firebase v12+ uses a different persistence mechanism
// // let ReactNativeAsyncStorage: any;
// // try {
// //   ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
// // } catch {
// //   ReactNativeAsyncStorage = AsyncStorage;
// // }

// logger.info('\n\n\n [Firebase] Constants.expoConfig?.extra', Constants.expoConfig?.extra);


// // Get Firebase config from Constants.expoConfig?.extra or fallback to process.env
// // This ensures we can access the values even if they're not in extra
// const extra = Constants.expoConfig?.extra || {};
// const firebaseConfig = {
//   apiKey: extra.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
//   authDomain: extra.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: extra.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: extra.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: extra.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: extra.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
//   databaseURL: extra.firebaseDatabaseUrl || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
// };

// logger.info('\n\n\n [Firebase] firebaseConfig', firebaseConfig);
// // Validate Firebase configuration
// if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
//   logger.warn('Firebase config is missing required fields:', {
//     hasApiKey: !!firebaseConfig.apiKey,
//     hasProjectId: !!firebaseConfig.projectId,
//     hasAuthDomain: !!firebaseConfig.authDomain,
//     hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
//   });
// }

// const ensureAuth = (firebaseApp: FirebaseApp) => {
//   try {
//     // Try to use React Native persistence if available
//     // In Firebase v12+, getReactNativePersistence might be in a different location
//     let getReactNativePersistence: any;
//     try {
//       // Try importing from firebase/auth/react-native
//       getReactNativePersistence = require('firebase/auth/react-native').getReactNativePersistence;
//     } catch {
//       // Fallback: try to get it from firebase/auth (might not exist in v12)
//       try {
//         getReactNativePersistence = require('firebase/auth').getReactNativePersistence;
//       } catch {
//         // If not available, use default persistence
//         getReactNativePersistence = null;
//       }
//     }

//     if (getReactNativePersistence) {
//       return initializeAuth(firebaseApp, {
//         persistence: getReactNativePersistence(ReactNativeAsyncStorage),
//       });
//     } else {
//       // Fallback to default persistence (memory) when React Native persistence isn't available
//       return initializeAuth(firebaseApp);
//     }
//   } catch (error: any) {
//     if (error?.code === 'auth/already-initialized') {
//       return getAuth(firebaseApp);
//     }
//     if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.message?.includes('firebase/auth/react-native')) {
//       // Fallback to default persistence (memory) when the helper isn't available
//       return initializeAuth(firebaseApp);
//     }
//     throw error;
//   }
// };

// let app: FirebaseApp;
// let authInstance: ReturnType<typeof getAuth>;
// let database: ReturnType<typeof getDatabase> | null = null;

// // Initialize Firebase app and auth
// if (!getApps().length) {
//   app = initializeApp(firebaseConfig);
//   authInstance = ensureAuth(app);
// } else {
//   app = getApps()[0];
//   try {
//     authInstance = getAuth(app);
//   } catch {
//     authInstance = ensureAuth(app);
//   }
// }

// // Initialize database with error handling
// // This prevents app crash if Realtime Database is not enabled
// try {
//   // Check if databaseURL is configured
//   if (firebaseConfig.databaseURL) {
//     // Explicitly pass databaseURL to getDatabase() to ensure it's properly initialized
//     // This is required in some Firebase SDK versions
//     database = getDatabase(app, firebaseConfig.databaseURL);
//     logger.info('Firebase Realtime Database initialized successfully', {
//       databaseURL: firebaseConfig.databaseURL,
//     });
//   } else {
//     logger.warn('Firebase Realtime Database URL is not configured. Database features will not be available.');
//   }
// } catch (error: any) {
//   logger.error('Failed to initialize Firebase Realtime Database:', {
//     error: error?.message || error,
//     errorCode: error?.code,
//     databaseURL: firebaseConfig.databaseURL,
//     hint: 'Make sure Realtime Database is enabled in Firebase Console. Go to Firebase Console > Realtime Database > Create Database',
//   });
//   // Don't throw - allow app to continue without database
//   // Services using database should check if it's null before using it
//   database = null;
// }

// // Export messaging sender ID for FCM integration
// export const messagingSenderId = firebaseConfig.messagingSenderId;

// export const auth = authInstance;
// export { app, database };


// Firebase configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';

// Safely import getReactNativePersistence (may not exist in all Firebase versions)
let getReactNativePersistence: ((storage: typeof AsyncStorage) => any) | null = null;
try {
  const authModule = require('firebase/auth');
  if (authModule.getReactNativePersistence) {
    getReactNativePersistence = authModule.getReactNativePersistence;
  }
} catch {
  // getReactNativePersistence not available
}


// For React Native, we need to use ReactNativeAsyncStorage adapter"
// Firebase v12+ uses a different persistence mechanism
// let ReactNativeAsyncStorage: any;
// try {
//   ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
// } catch {
//   ReactNativeAsyncStorage = AsyncStorage;
// }

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: Constants.expoConfig?.extra?.firebaseDatabaseUrl || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};


logger.info('\n\n\n [Firebase] firebaseConfig', firebaseConfig);

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
    // Try to use React Native persistence if available
    if (getReactNativePersistence) {
      try {
        return initializeAuth(firebaseApp, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (persistenceError: any) {
        logger.warn('Failed to initialize with React Native persistence, using default', persistenceError);
        return initializeAuth(firebaseApp);
      }
    } else {
      // Fallback to default persistence when React Native persistence isn't available
      return initializeAuth(firebaseApp);
    }
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
let database: ReturnType<typeof getDatabase> | null = null;
let databaseInitializationAttempted = false;

// Initialize Firebase app and auth
// Ensure databaseURL is included in config for proper database service registration
const appConfig = {
  ...firebaseConfig,
  // Explicitly include databaseURL in app config to ensure database service is registered
  databaseURL: firebaseConfig.databaseURL,
};

if (!getApps().length) {
  app = initializeApp(appConfig);
  authInstance = ensureAuth(app);
} else {
  app = getApps()[0];
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = ensureAuth(app);
  }
}

// Lazy database initialization function with retry logic
// Firebase v11 should work better with React Native than v12
const initializeDatabase = (retry = false): ReturnType<typeof getDatabase> | null => {
  // If already initialized, return it
  if (database) {
    return database;
  }

  // If initialization was attempted and failed, only retry if explicitly requested
  if (databaseInitializationAttempted && !retry) {
    return null;
  }

  databaseInitializationAttempted = true;

  try {
    if (!firebaseConfig.databaseURL) {
      logger.warn('Firebase Realtime Database URL is not configured. Database features will not be available.');
      databaseInitializationAttempted = false; // Allow retry if URL is added later
      return null;
    }

    // Try to initialize database
    // In Firebase v12 with React Native, "Service database is not available" error
    // can occur due to module loading timing. We'll handle this gracefully.
    try {
      // First try with explicit URL - this is the recommended approach
      database = getDatabase(app, firebaseConfig.databaseURL);

      // Verify the database instance is valid by checking if it has the expected properties
      if (database && typeof database === 'object') {
        logger.info('Firebase Realtime Database initialized successfully', {
          databaseURL: firebaseConfig.databaseURL,
        });
        return database;
      } else {
        throw new Error('Database instance is invalid');
      }
    } catch (immediateError: any) {
      const errorMessage = immediateError?.message || String(immediateError);
      const errorCode = immediateError?.code;

      // If "Service database is not available", try to work around it
      // This can happen if the database service isn't registered yet
      if (errorMessage.includes('Service database is not available') ||
        errorMessage.includes('service-unavailable') ||
        errorCode === 'database/service-unavailable') {
        logger.warn('Database service reported unavailable. Will retry with delay...', {
          databaseURL: firebaseConfig.databaseURL,
        });
        // Reset flag to allow retry
        databaseInitializationAttempted = false;
        return null;
      }

      // Try fallback: without explicit URL (let Firebase use default from app config)
      try {
        logger.warn('Trying fallback database initialization without explicit URL...');
        database = getDatabase(app);

        if (database && typeof database === 'object') {
          logger.info('\n\n\n [Firebase]  ✅ Realtime Database initialized successfully (fallback method)', {
            databaseURL: firebaseConfig.databaseURL,
          });
          return database;
        } else {
          throw new Error('Fallback database instance is invalid');
        }
      } catch (fallbackError: any) {
        const fallbackMessage = fallbackError?.message || String(fallbackError);
        logger.error('All database initialization methods failed', {
          primaryError: errorMessage,
          fallbackError: fallbackMessage,
          databaseURL: firebaseConfig.databaseURL,
          hint: 'Database may not be properly configured or Firebase v12 has compatibility issues with React Native',
        });
        databaseInitializationAttempted = false; // Allow retry
        return null;
      }
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('Unexpected error during database initialization:', {
      error: errorMessage,
      errorCode: error?.code,
      databaseURL: firebaseConfig.databaseURL,
      hint: 'Make sure Realtime Database is enabled in Firebase Console and databaseURL is correct',
    });
    databaseInitializationAttempted = false; // Allow retry
    return null;
  }
};

// Try to initialize database immediately, but don't fail if it doesn't work
// Services can call getDatabaseInstance() which will retry if needed
initializeDatabase();

// Export messaging sender ID for FCM integration
export const messagingSenderId = firebaseConfig.messagingSenderId;

// Export function to get database instance with retry logic
// This is the main entry point for services that need the database
export const getDatabaseInstance = (): ReturnType<typeof getDatabase> | null => {
  // If already initialized, return it
  if (database) {
    return database;
  }

  // Retry initialization if it failed before
  // The initializeDatabase function already handles retries internally
  const retriedDb = initializeDatabase(true);

  if (retriedDb) {
    logger.info('Firebase Realtime Database initialized successfully on retry');
    return retriedDb;
  }

  // If all retries failed, log a final warning
  logger.warn('Database instance is not available after all retry attempts. Chat and presence features will not work.');
  return null;
};

export const auth = authInstance;
export { app, database };

/**
 * Google OAuth 2.0 Authentication Utility
 * Handles Google Sign-In using Expo AuthSession for web/mobile
 */

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase/config';
import { logger } from '../utils/logger';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// This is required for Expo AuthSession to work properly
WebBrowser.maybeCompleteAuthSession();

interface GoogleAuthConfig {
  webClientId: string;
  iosClientId: string;
  androidClientId: string;
}

interface GoogleAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  idToken?: string;
  accessToken?: string;
}

/**
 * Get Google OAuth configuration from app config
 */
const getGoogleAuthConfig = (): GoogleAuthConfig => {
  const extra = Constants.expoConfig?.extra;

  return {
    webClientId: extra?.googleWebClientId || '',
    iosClientId: extra?.googleIosClientId || '',
    androidClientId: extra?.googleAndroidClientId || '',
  };
};

/**
 * Get client ID based on platform
 */
const getClientId = (): string => {
  const config = getGoogleAuthConfig();

  switch (Platform.OS) {
    case 'ios':
      return config.iosClientId;
    case 'android':
      return config.androidClientId;
    default:
      return config.webClientId;
  }
};

/**
 * Initialize Google Auth using Expo AuthSession
 */
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: getClientId(),
    iosClientId: getGoogleAuthConfig().iosClientId,
    androidClientId: getGoogleAuthConfig().androidClientId,
    webClientId: getGoogleAuthConfig().webClientId,
    scopes: ['profile', 'email'],
  });

  return { request, response, promptAsync };
};

/**
 * Sign in with Google using Firebase
 */
export const signInWithGoogle = async (
  idToken: string,
  accessToken?: string
): Promise<GoogleAuthResult> => {
  try {
    logger.info('Starting Google Sign-In with Firebase');

    // Create Firebase credential from Google tokens
    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    // Sign in to Firebase with the credential
    const result = await signInWithCredential(auth, credential);

    logger.info('Google Sign-In successful', {
      userId: result.user.uid,
      email: result.user.email,
    });

    return {
      success: true,
      user: result.user,
      idToken,
      accessToken,
    };
  } catch (error: any) {
    logger.error('Google Sign-In failed', error);
    return {
      success: false,
      error: error.message || 'Google Sign-In failed',
    };
  }
};

/**
 * Handle Google Auth response from Expo AuthSession
 */
export const handleGoogleAuthResponse = async (
  response: any
): Promise<GoogleAuthResult> => {
  if (response?.type === 'success') {
    const { authentication } = response;

    if (authentication?.idToken) {
      return await signInWithGoogle(
        authentication.idToken,
        authentication.accessToken
      );
    } else {
      logger.error('Google authentication response missing idToken');
      return {
        success: false,
        error: 'Authentication response invalid',
      };
    }
  } else if (response?.type === 'cancel') {
    logger.info('Google Sign-In cancelled by user');
    return {
      success: false,
      error: 'Sign-in cancelled',
    };
  } else {
    logger.error('Google Sign-In error', response?.error);
    return {
      success: false,
      error: response?.error?.message || 'Authentication failed',
    };
  }
};

/**
 * Get user info from Google ID token
 */
export const getUserInfoFromIdToken = (idToken: string): any => {
  try {
    // Decode JWT token (basic implementation)
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    logger.error('Failed to decode ID token', error);
    return null;
  }
};

/**
 * Validate Google OAuth configuration
 */
export const validateGoogleAuthConfig = (): {
  isValid: boolean;
  missingFields: string[];
} => {
  const config = getGoogleAuthConfig();
  const missingFields: string[] = [];

  if (!config.webClientId) missingFields.push('webClientId');
  if (!config.iosClientId && Platform.OS === 'ios')
    missingFields.push('iosClientId');
  if (!config.androidClientId && Platform.OS === 'android')
    missingFields.push('androidClientId');

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    await auth.signOut();
    logger.info('Signed out from Google successfully');
  } catch (error) {
    logger.error('Error signing out from Google', error);
    throw error;
  }
};


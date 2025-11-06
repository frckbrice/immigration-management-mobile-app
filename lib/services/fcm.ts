/**
 * Firebase Cloud Messaging (FCM) Service
 * 
 * This service provides FCM integration for Expo apps.
 * Note: Expo Push Notifications automatically uses FCM for Android
 * and APNs for iOS when configured via EAS credentials.
 * 
 * This service enhances the integration with:
 * - Token refresh handling
 * - Background message processing
 * - FCM-specific utilities
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { messagingSenderId } from '../firebase/config';

/**
 * Check if FCM is properly configured
 */
export const isFCMConfigured = (): boolean => {
    const hasMessagingSenderId = !!messagingSenderId;
    const hasProjectId = !!Constants.expoConfig?.extra?.eas?.projectId;
    const isPhysicalDevice = Device.isDevice;

    if (!hasMessagingSenderId) {
        logger.warn('FCM not configured: Missing messagingSenderId');
        return false;
    }

    if (!hasProjectId) {
        logger.warn('FCM not configured: Missing EAS projectId');
        return false;
    }

    if (!isPhysicalDevice) {
        logger.info('FCM: Not a physical device, push notifications disabled');
        return false;
    }

    return true;
};

/**
 * Get FCM configuration status
 */
export const getFCMStatus = () => {
    return {
        configured: isFCMConfigured(),
        messagingSenderId: messagingSenderId || null,
        projectId: Constants.expoConfig?.extra?.eas?.projectId || null,
        isDevice: Device.isDevice,
        platform: Platform.OS,
    };
};

/**
 * Request FCM permissions explicitly
 * This is handled automatically by expo-notifications, but useful for checking
 */
export const requestFCMPermissions = async (): Promise<boolean> => {
    try {
        if (!Device.isDevice) {
            logger.info('FCM: Skipping permissions - not a physical device');
            return false;
        }

        const { status } = await Notifications.getPermissionsAsync();

        if (status === 'granted') {
            logger.info('FCM: Permissions already granted');
            return true;
        }

        logger.info('FCM: Requesting permissions...');
        const { status: newStatus } = await Notifications.requestPermissionsAsync();

        if (newStatus === 'granted') {
            logger.info('FCM: Permissions granted');
            return true;
        }

        logger.warn('FCM: Permissions denied', { status: newStatus });
        return false;
    } catch (error: any) {
        logger.error('FCM: Error requesting permissions', error);
        return false;
    }
};

/**
 * Get current Expo push token (which uses FCM on Android)
 * This token is what gets sent to your backend for FCM push notifications
 * 
 * Note: This requires FCM credentials to be configured via EAS credentials.
 * See: https://docs.expo.dev/push-notifications/fcm-credentials/
 */
export const getFCMToken = async (): Promise<string | null> => {
    try {
        if (!isFCMConfigured()) {
            return null;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            logger.warn('FCM: No EAS project ID found');
            return null;
        }

        // Check permissions first
        const hasPermission = await requestFCMPermissions();
        if (!hasPermission) {
            logger.warn('FCM: No permissions granted');
            return null;
        }

        logger.info('FCM: Getting push token...', { projectId });

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        logger.info('FCM: Token obtained successfully', {
            token: tokenData.data.substring(0, 30) + '...',
            platform: Platform.OS,
        });

        return tokenData.data;
    } catch (error: any) {
        const errorMessage = error?.message || '';
        const errorCode = error?.code || '';

        // Handle Firebase initialization errors gracefully
        // This happens when FCM credentials aren't configured via EAS
        if (
            errorMessage.includes('FirebaseApp is not initialized') ||
            errorMessage.includes('FirebaseApp.initializeApp') ||
            errorCode === 'E_REGISTRATION_FAILED' ||
            errorMessage.includes('fcm-credentials')
        ) {
            logger.warn('FCM: Push notifications require EAS credentials setup', {
                code: errorCode,
                message: 'FCM credentials must be configured via: eas credentials',
                guide: 'https://docs.expo.dev/push-notifications/fcm-credentials/',
                note: 'This is expected in development. Build with EAS to enable FCM.',
            });
            return null;
        }

        // Handle other errors
        logger.error('FCM: Error getting token', {
            error: errorMessage,
            code: errorCode,
        });
        return null;
    }
};

/**
 * Validate if a push token is a valid Expo push token format
 */
export const isValidExpoPushToken = (token: string): boolean => {
    // Expo push tokens start with "ExponentPushToken[" or "ExpoPushToken["
    return /^Expo(nent)?PushToken\[.+\]$/.test(token);
};

/**
 * Extract token ID from Expo push token
 * Format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */
export const extractTokenId = (token: string): string | null => {
    const match = token.match(/\[(.+)\]/);
    return match ? match[1] : null;
};

/**
 * Setup FCM token refresh listener
 * Expo push tokens can change, so we should refresh and update backend
 */
export const setupTokenRefreshListener = (
    onTokenRefresh: (newToken: string) => void | Promise<void>
): (() => void) => {
    // Note: expo-notifications doesn't have a built-in token refresh listener
    // We'll poll periodically or check on app state changes
    // This is a placeholder - actual refresh should be handled by checking
    // token periodically or on app foreground
    logger.info('FCM: Token refresh listener setup (manual refresh required)');

    // Return cleanup function
    return () => {
        logger.info('FCM: Token refresh listener removed');
    };
};

/**
 * Process background notification data
 * Called when app receives notification while in background
 */
export const processBackgroundNotification = async (
    notification: Notifications.Notification
): Promise<void> => {
    try {
        const data = notification.request.content.data;
        logger.info('FCM: Processing background notification', {
            title: notification.request.content.title,
            data: data,
        });

        // Update badge count if needed
        const badgeCount = await Notifications.getBadgeCountAsync();
        await Notifications.setBadgeCountAsync(badgeCount + 1);
    } catch (error) {
        logger.error('FCM: Error processing background notification', error);
    }
};

/**
 * Initialize FCM service
 * Should be called early in app lifecycle
 * 
 * Note: This will fail gracefully if FCM credentials aren't configured via EAS.
 * This is expected in development/Expo Go - push notifications require an EAS build.
 */
export const initializeFCM = async (): Promise<{
    token: string | null;
    configured: boolean;
    requiresEASBuild?: boolean;
}> => {
    try {
        logger.info('FCM: Initializing...');

        const configured = isFCMConfigured();

        if (!configured) {
            logger.warn('FCM: Not fully configured, returning null token');
            return { token: null, configured: false };
        }

        // Request permissions
        const hasPermission = await requestFCMPermissions();
        if (!hasPermission) {
            logger.warn('FCM: Permissions not granted');
            return { token: null, configured: true };
        }

        // Get token (may fail if EAS credentials aren't set up)
        const token = await getFCMToken();

        // Check if the failure was due to missing EAS credentials
        if (!token && Device.isDevice) {
            // Token is null but we have permissions and config
            // This likely means EAS credentials aren't configured
            logger.info('FCM: Token unavailable - may need EAS credentials', {
                hint: 'Run: eas credentials (Android → Push Notifications)',
                note: 'Push notifications require an EAS build, not Expo Go',
            });
            return { token: null, configured: true, requiresEASBuild: true };
        }

        if (token) {
            logger.info('FCM: Initialized successfully', {
                tokenLength: token.length,
                platform: Platform.OS,
            });
        } else {
            logger.warn('FCM: Initialized but token is null (check EAS credentials)');
        }

        return { token, configured: true, requiresEASBuild: !token && Device.isDevice };
    } catch (error: any) {
        // Gracefully handle initialization errors
        const errorMessage = error?.message || '';

        if (
            errorMessage.includes('FirebaseApp is not initialized') ||
            errorMessage.includes('fcm-credentials')
        ) {
            logger.warn('FCM: Initialization skipped - EAS credentials required', {
                note: 'This is normal in development. Build with EAS to enable FCM.',
            });
            return { token: null, configured: true, requiresEASBuild: true };
        }

        logger.error('FCM: Initialization error', error);
        return { token: null, configured: false };
    }
};

/**
 * Cleanup FCM resources (if needed)
 */
export const cleanupFCM = (): void => {
    logger.info('FCM: Cleanup called');
    // No explicit cleanup needed for Expo notifications
};


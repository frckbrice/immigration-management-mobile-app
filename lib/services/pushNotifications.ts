/**
 * Push Notifications Service
 * Handles Expo push notifications with FCM integration
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { router } from 'expo-router';
import { apiClient } from '../api/axios';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    logger.info('📬 Notification received in handler', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });

    const data = notification.request.content.data as NotificationData;
    const channelId = data?.type ? getChannelIdForType(data.type) : 'default';

    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export interface NotificationData {
  type?: string;
  caseId?: string;
  documentId?: string;
  messageId?: string;
  url?: string;
  [key: string]: any;
}

export interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
}

/**
 * Register for push notifications and get Expo push token
 */
export const registerForPushNotifications = async (): Promise<PushNotificationToken | null> => {
  try {
    if (!Device.isDevice) {
      logger.info('Push notifications require physical device');
      return null;
    }

    logger.info('Starting push notification registration...');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      logger.info('Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Notification permission denied');
      return null;
    }

    logger.info('Notification permission granted');

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      logger.warn('EAS Project ID not found in app config');
      return null;
    }

    logger.info('Getting Expo push token...', { projectId });

    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    } catch (expoError: any) {
      logger.warn('⚠️ Push token generation failed', {
        error: expoError?.message,
        note: 'This may be expected in development',
      });
      return null;
    }

    logger.info('✅ Push notification token obtained successfully', {
      token: tokenData.data.substring(0, 50) + '...',
      platform: Platform.OS,
    });

    // Configure Android notification channels
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0066CC',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('case-updates', {
          name: 'Case Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });

        await Notifications.setNotificationChannelAsync('documents', {
          name: 'Document Updates',
          importance: Notifications.AndroidImportance.DEFAULT,
        });

        logger.info('Android notification channels created');
      } catch (channelError) {
        logger.warn('Could not create notification channels');
      }
    }

    return {
      token: tokenData.data,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      deviceId: Constants.deviceId || Constants.sessionId,
    };
  } catch (error: any) {
    logger.error('⚠️ Push notification registration failed', {
      error: error?.message,
      status: 'Non-blocking - app continues normally',
    });
    return null;
  }
};

/**
 * Register push token with backend
 */
export const registerPushTokenWithBackend = async (token: string, platform: string, deviceId?: string): Promise<void> => {
  try {
    await apiClient.post('/users/push-token', {
      token,
      platform,
      deviceId,
    });
    logger.info('Push token registered with backend');
  } catch (error: any) {
    logger.error('Failed to register push token with backend', error);
    // Non-blocking - app continues normally
  }
};

export const unregisterPushTokenWithBackend = async (platform?: string, deviceId?: string): Promise<void> => {
  try {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (deviceId) params.append('deviceId', deviceId);
    const query = params.toString();
    await apiClient.delete(`/users/push-token${query ? `?${query}` : ''}`);
    logger.info('Push token removed from backend');
  } catch (error: any) {
    logger.error('Failed to remove push token from backend', error);
  }
};

/**
 * Handle notification received while app is in foreground
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Handle notification tapped by user
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Navigate based on notification data
 */
export const handleNotificationNavigation = async (data: NotificationData) => {
  try {
    logger.info('Handling notification navigation', { data });

    switch (data.type) {
      case 'CASE_STATUS_UPDATE':
      case 'CASE_ASSIGNED':
        if (data.caseId) {
          router.push({ pathname: '/case/[id]', params: { id: data.caseId } });
        }
        break;

      case 'NEW_MESSAGE':
        if (data.caseId) {
          router.push({ pathname: '/chat', params: { id: data.caseId, caseId: data.caseId } });
        } else {
          router.push('/(tabs)/messages');
        }
        break;

      case 'NEW_EMAIL':
        if (data.caseId) {
          router.push({ pathname: '/case/[id]', params: { id: data.caseId } });
        } else {
          router.push('/(tabs)/messages');
        }
        break;

      case 'DOCUMENT_UPLOADED':
      case 'DOCUMENT_VERIFIED':
      case 'DOCUMENT_REJECTED':
        if (data.caseId) {
          router.push({ pathname: '/case/[id]', params: { id: data.caseId } });
        } else {
          router.push('/(tabs)/documents');
        }
        break;

      case 'SYSTEM_ANNOUNCEMENT':
        router.push('/(tabs)/notifications');
        break;

      default:
        router.push('/(tabs)/(home)');
    }
  } catch (error) {
    logger.error('Error handling notification navigation', error);
  }
};

/**
 * Get notification channel ID based on type
 */
const getChannelIdForType = (type: string): string => {
  if (type.includes('MESSAGE')) return 'messages';
  if (type.includes('EMAIL')) return 'messages';
  if (type.includes('CASE')) return 'case-updates';
  if (type.includes('DOCUMENT')) return 'documents';
  return 'default';
};

/**
 * Setup notification listeners
 */
export const setupNotificationListeners = () => {
  // Listen for notifications received while app is open
  const receivedSubscription = addNotificationReceivedListener(
    async (notification) => {
      const data = notification.request.content.data as NotificationData;
      logger.info('📬 Notification received in listener', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        type: data.type,
      });
    }
  );

  // Listen for user tapping on notifications
  const responseSubscription = addNotificationResponseListener(async (response) => {
    const data = response.notification.request.content.data as NotificationData;
    await handleNotificationNavigation(data);
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

/**
 * Get last notification response (useful for cold starts)
 */
export const getLastNotificationResponse = async () => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data as NotificationData;
      return data;
    }
    return null;
  } catch (error) {
    logger.error('Error getting last notification response', error);
    return null;
  }
};

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    logger.error('Error checking notification permissions', error);
    return false;
  }
};


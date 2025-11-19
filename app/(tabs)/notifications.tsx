
import React, { useState, useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { BackButton } from "@/components/BackButton";
import { Stack, useRouter } from "expo-router";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

type NotificationFilter = 'All' | 'Unread' | 'Messages' | 'Case Updates';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('All');
  const { notifications, isLoading, error, fetchNotifications, markAllAsRead, clearError } = useNotificationsStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (error) {
      // Clear error after 5 seconds
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const mockNotifications = [
    {
      id: '1',
      type: 'message',
      title: 'New Message from your Lawyer',
      description: "Hey, I've just reviewed the documents you sent over. Everything looks good ...",
      time: '5m ago',
      unread: true,
      badge: 'Urgent',
      badgeColor: '#FF9800',
    },
    {
      id: '2',
      type: 'action',
      title: 'Action Required: Upload Document',
      description: "Please upload 'Proof of Residence' for your case #A-4582.",
      time: '1h ago',
      unread: true,
    },
    {
      id: '3',
      type: 'case-update',
      title: 'Case Status Updated',
      description: "Your case #I-130 has been updated to 'Under Review'.",
      time: 'Yesterday',
      unread: false,
      badge: 'Case Update',
      badgeColor: '#00BCD4',
    },
    {
      id: '4',
      type: 'appointment',
      title: 'Upcoming Appointment Reminder',
      description: 'You have an appointment scheduled for tomorrow, Oct 28, at 10:00 AM.',
      time: '2 days ago',
      unread: true,
    },
    {
      id: '5',
      type: 'document',
      title: 'Document Approved',
      description: "'Birth Certificate' for case #I-130 has been approved.",
      time: '3 days ago',
      unread: false,
      badge: 'Success',
      badgeColor: '#4CAF50',
    },
  ];

  const filters: NotificationFilter[] = ['All', 'Unread', 'Messages', 'Case Updates'] as NotificationFilter[];

  const getFilteredNotifications = () => {
    switch (activeFilter) {
      case 'Unread':
        return notifications.filter(n => n.unread);
      case 'Messages':
        return notifications.filter(n => n.type === 'message');
      case 'Case Updates':
        return notifications.filter(n => n.type === 'case-update');
      default:
        return notifications;
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return 'message.fill';
      case 'action':
        return 'folder.fill';
      case 'case-update':
        return 'briefcase.fill';
      case 'appointment':
        return 'calendar';
      case 'document':
        return 'checkmark.circle.fill';
      default:
        return 'bell.fill';
    }
  };

  const getNotificationIconColor = (type: string) => {
    switch (type) {
      case 'message':
        return '#2196F3';
      case 'action':
        return '#FF9800';
      case 'case-update':
        return '#00BCD4';
      case 'appointment':
        return '#9C27B0';
      case 'document':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const filteredNotifications = getFilteredNotifications();

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} iconSize={24} />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('notifications.title')}</Text>
          <Pressable onPress={handleMarkAllAsRead}>
            <Text style={styles.markReadText}>{t('notifications.markAllRead')}</Text>
          </Pressable>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {filters.map((filter) => {
              const filterKey = filter === 'All' ? 'filterAll' : 
                               filter === 'Unread' ? 'filterUnread' :
                               filter === 'Messages' ? 'filterMessages' :
                               'filterCaseUpdates';
              return (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterTab,
                    activeFilter === filter && styles.filterTabActive,
                    { 
                      backgroundColor: activeFilter === filter 
                        ? '#2196F3' 
                        : theme.dark ? '#1C1C1E' : '#F5F5F5' 
                    }
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: activeFilter === filter ? '#fff' : theme.colors.text }
                    ]}
                  >
                    {t(`notifications.${filterKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Notifications List */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchNotifications} />
          }
        >
          {isLoading && notifications.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
            </View>
          )}

          {filteredNotifications.map((notification) => (
            <Pressable
              key={notification.id}
              style={[
                styles.notificationCard,
                { 
                  backgroundColor: theme.dark ? '#111827' : '#fff',
                  borderLeftWidth: notification.unread ? 3 : 0,
                  borderLeftColor: notification.unread ? '#2196F3' : 'transparent',
                }
              ]}
              onPress={() => {
                // Navigate based on notification type
                if (notification.type === 'message' && notification.relatedId) {
                  router.push({
                    pathname: '/chat',
                    params: { id: notification.relatedId, caseId: notification.relatedId }
                  });
                } else if (notification.type === 'case-update' && notification.relatedId) {
                  router.push({
                    pathname: '/chat',
                    params: { id: notification.relatedId, caseId: notification.relatedId }
                  });
                } else if (notification.type === 'document' && notification.relatedId) {
                  router.push('/(tabs)/documents');
                } else if (notification.type === 'action' && notification.relatedId) {
                  router.push({
                    pathname: '/chat',
                    params: { id: notification.relatedId, caseId: notification.relatedId }
                  });
                } else {
                  // Default: go to cases or home
                  router.push('/(tabs)/cases');
                }
              }}
            >
              <View style={styles.notificationContent}>
                <View style={[
                  styles.notificationIcon,
                  { backgroundColor: getNotificationIconColor(notification.type) + '20' }
                ]}>
                  <IconSymbol 
                    name={getNotificationIcon(notification.type)} 
                    size={24} 
                    color={getNotificationIconColor(notification.type)} 
                  />
                  {notification.unread && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
                <View style={styles.notificationTextContainer}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
                      {notification.title}
                    </Text>
                    <Text style={[styles.notificationTime, { color: theme.dark ? '#98989D' : '#666' }]}>
                      {notification.time}
                    </Text>
                  </View>
                  <Text 
                    style={[styles.notificationDescription, { color: theme.dark ? '#98989D' : '#666' }]}
                    numberOfLines={2}
                  >
                    {notification.description}
                  </Text>
                  {notification.badge && (
                    <View style={[styles.badge, { backgroundColor: notification.badgeColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: notification.badgeColor }]}>
                        {notification.badge}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}

          {filteredNotifications.length === 0 && (
            <View style={styles.emptyState}>
              <IconSymbol name="bell.slash.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
              <Text style={[styles.emptyStateText, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('notifications.noNotifications')}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  markReadText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filterTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  notificationContent: {
    flexDirection: 'row',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  notificationDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

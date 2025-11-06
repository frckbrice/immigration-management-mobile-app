
import React, { useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function MessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { messages, isLoading, error, fetchMessages, clearError } = useMessagesStore();

  useEffect(() => {
    fetchMessages();
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

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('messages.title')}</Text>
          <Pressable onPress={() => console.log('New message pressed')}>
            <IconSymbol name="square.and.pencil" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchMessages} />
          }
        >
          {isLoading && messages.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
            </View>
          )}

          {messages.length === 0 && !isLoading && (
            <View style={styles.emptyContainer}>
              <IconSymbol name="message.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('messages.noMessages')}
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <Pressable
              key={message.id}
              style={[styles.messageCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => {
                // If message has a conversationId or caseId, navigate to chat
                if (message.conversationId) {
                  router.push({
                    pathname: '/chat',
                    params: { id: message.conversationId, caseId: message.conversationId }
                  });
                } else {
                  // Otherwise, just show a message or navigate to cases
                  router.push('/(tabs)/cases');
                }
              }}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: message.role === 'System' ? '#9E9E9E' : '#2196F3' }]}>
                  <IconSymbol 
                    name={message.role === 'System' ? 'gear.circle.fill' : 'person.fill'} 
                    size={24} 
                    color="#fff" 
                  />
                </View>
                {message.online && <View style={styles.onlineIndicator} />}
              </View>
              
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={[styles.messageName, { color: theme.colors.text }]}>
                    {message.name}
                  </Text>
                  <Text style={[styles.messageTime, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {message.time}
                  </Text>
                </View>
                <Text style={[styles.messageRole, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {message.role}
                </Text>
                <Text
                  style={[
                    styles.messageText,
                    { color: theme.dark ? '#98989D' : '#666' },
                    message.unread && { fontWeight: '600', color: theme.colors.text },
                  ]}
                  numberOfLines={2}
                >
                  {message.message}
                </Text>
              </View>

              {message.unread && (
                <View style={styles.unreadBadge}>
                  <View style={styles.unreadDot} />
                </View>
              )}
            </Pressable>
          ))}
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
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
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
  messageCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  messageName: {
    fontSize: 16,
    fontWeight: '700',
  },
  messageTime: {
    fontSize: 12,
  },
  messageRole: {
    fontSize: 12,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
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
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});

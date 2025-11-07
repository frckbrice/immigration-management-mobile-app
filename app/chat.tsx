
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, FlatList } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import { chatService, ChatMessage } from "@/lib/services/chat";
import { auth } from "@/lib/firebase/config";
import { casesService } from "@/lib/services/casesService";
import { logger } from "@/lib/utils/logger";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";

const formatServiceTypeLabel = (serviceType?: string) =>
  serviceType
    ? serviceType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/(^|\s)\w/g, (char) => char.toUpperCase())
    : '';

const normalizeStatus = (status?: string | null) => (status ?? '').toLowerCase();

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const params = useLocalSearchParams();
  const caseId = (params.id || params.caseId) as string;
  const [message, setMessage] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<ChatMessage['attachments']>([]);
  const flatListRef = useRef<FlatList>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<{ id?: string; name?: string; profilePicture?: string; isOnline?: boolean } | null>(null);
  const lastMessageTimestampRef = useRef<number>(0);
  const chatInitializedRef = useRef(false);

  const { chatMessages, isLoading, error: chatError, clearError: clearChatError, sendChatMessage, loadChatMessages, loadOlderChatMessages, subscribeToChatMessages, markChatAsRead, setCurrentConversation, currentRoomId } = useMessagesStore();
  const { user } = useAuthStore();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Resolve chat room ID and set up Firebase subscription
  useEffect(() => {
    if (!caseId) {
      setCurrentConversation(null, null);
      setResolvedRoomId(null);
      return;
    }

    logger.info('Chat screen mounted - initializing Firebase subscription', { caseId });

    setCurrentConversation(null, caseId);
    setIsLoadingMessages(true);

    let unsubscribe: (() => void) | null = null;

    const initializeChat = async () => {
      try {
        const clientFirebaseId = auth.currentUser?.uid || user?.uid;
        let agentFirebaseId: string | undefined = agentInfo?.id;

        if (!clientFirebaseId) {
          showAlert({
            title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: t('chat.unavailableMessage', { defaultValue: 'You need an active session to continue the conversation.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
          setIsLoadingMessages(false);
          return;
        }

        let caseData: any = null;
        try {
          caseData = await casesService.getCaseById(caseId);
        } catch (error) {
          logger.error('Unable to load case details for chat', error);
        }

        if (!caseData) {
          showAlert({
            title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: t('chat.caseNotFound', { defaultValue: 'We could not locate this case. Please try again later.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
          setIsLoadingMessages(false);
          return;
        }

        const statusKey = normalizeStatus(caseData.status);
        if (statusKey !== 'under_review') {
          showAlert({
            title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: t('chat.pendingReview', { defaultValue: 'Your advisor will reach out once the case is under review.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
          setIsLoadingMessages(false);
          return;
        }

        if (!agentFirebaseId && caseData.assignedAgent) {
          agentFirebaseId = caseData.assignedAgent.id || undefined;
          setAgentInfo({
            id: agentFirebaseId,
            name: `${caseData.assignedAgent.firstName || ''} ${caseData.assignedAgent.lastName || ''}`.trim() || 'Agent',
            profilePicture: (caseData.assignedAgent as any)?.profilePicture,
            isOnline: false,
          });
        }

        if (!agentFirebaseId) {
          showAlert({
            title: t('chat.noAgentTitle', { defaultValue: 'Advisor Pending' }),
            message: t('chat.noAgentMessage', { defaultValue: 'An advisor will contact you shortly. Chat becomes available after the assignment.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
          setIsLoadingMessages(false);
          return;
        }

        const result = await loadChatMessages(caseId, clientFirebaseId, agentFirebaseId);

        if (!result.roomId) {
          showAlert({
            title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: t('chat.awaitAgentInitiation', { defaultValue: 'Your advisor will open the conversation soon. You can reply once it is available.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
          setResolvedRoomId(null);
          setHasMore(false);
          setIsLoadingMessages(false);
          return;
        }

        setResolvedRoomId(result.roomId);
        setHasMore(result.hasMore);
        setIsLoadingMessages(false);
        setCurrentConversation(result.roomId, caseId);

        const store = useMessagesStore.getState();
        if (store.chatMessages.length > 0) {
          lastMessageTimestampRef.current = Math.max(...store.chatMessages.map((m: ChatMessage) => m.timestamp));
        } else {
          lastMessageTimestampRef.current = 0;
        }

        unsubscribe = subscribeToChatMessages(
          result.roomId,
          (newMessage) => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          },
          lastMessageTimestampRef.current
        );

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 300);

        if (user) {
          const userId = (user as any).uid || (user as any).id || '';
          if (userId) {
            markChatAsRead(caseId, userId).catch((error) => {
              logger.warn('Failed to mark messages as read', error);
            });
          }
        }
      } catch (error) {
        logger.error('Failed to initialize chat', error);
        setIsLoadingMessages(false);
        showAlert({
          title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
          message: t('chat.genericError', { defaultValue: 'We were unable to open this conversation. Please try again later.' }),
          actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
        });
      }
    };

    initializeChat();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [caseId, user, agentInfo?.id]);

  useEffect(() => {
    if (chatError) {
      logger.error('Chat error state', chatError);
      showAlert({
        title: t('common.error'),
        message: chatError,
        actions: [{ text: t('common.close'), variant: 'primary', onPress: () => clearChatError() }],
      });
    }
  }, [chatError, clearChatError, showAlert, t]);

  // Load more messages when scrolling up
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !caseId || chatMessages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestTimestamp = Math.min(...chatMessages.map(m => m.timestamp));
      const clientFirebaseId = auth.currentUser?.uid || user?.uid;
      const agentFirebaseId = agentInfo?.id;

      await loadOlderChatMessages(caseId, oldestTimestamp, clientFirebaseId, agentFirebaseId);

      // Check if there are more (simplified - you can improve this)
      setHasMore(chatMessages.length >= 20);
    } catch (error) {
      logger.error('Failed to load older messages', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [caseId, chatMessages, isLoadingMore, hasMore, user, agentInfo?.id]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    if (!chatMessages || chatMessages.length === 0) return [];
    return [...chatMessages].sort((a, b) => a.timestamp - b.timestamp);
  }, [chatMessages]);

  const handleSend = async () => {
    if ((!message.trim() && (!selectedAttachments || selectedAttachments.length === 0)) || !user || !caseId) return;

    const activeRoomId = currentRoomId || resolvedRoomId;
    if (!activeRoomId) {
      showAlert({
        title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
        message: t('chat.awaitAgentInitiation', { defaultValue: 'Your advisor will open the conversation soon. You can reply once it is available.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
      return;
    }

    const messageText = message.trim();
    const attachments = selectedAttachments || [];
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    // OPTIMISTIC UPDATE: Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      caseId,
      senderId: auth.currentUser?.uid || user.uid || '',
      senderName: user.displayName || user.email || 'User',
      senderRole: 'CLIENT',
      message: messageText || '📎 Attachment',
      timestamp: Date.now(),
      isRead: false,
      attachments: attachments.length > 0 ? attachments : undefined,
      status: 'pending',
    };

    // Add message to UI immediately
    setCurrentConversation(activeRoomId, caseId);
    // The store will handle adding the message via the subscription

    // Clear input immediately
    setMessage('');
    setSelectedAttachments([]);

    try {
      // Send to Firebase
      const clientFirebaseId = auth.currentUser?.uid || user.uid;
      const agentFirebaseId = agentInfo?.id;

      const success = await sendChatMessage(
        caseId,
        clientFirebaseId || '',
        user.displayName || user.email || 'User',
        'CLIENT',
        messageText || '📎 Attachment',
        attachments.length > 0 ? attachments : undefined,
        clientFirebaseId,
        agentFirebaseId
      );

      if (!success) {
        // Mark optimistic message as failed
        logger.error('Failed to send message');
      }
    } catch (error: any) {
      logger.error('Failed to send message', error);
    }
  };

  // Format message timestamp
  const formatMessageTime = useCallback((timestamp: number) => {
    if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
      return 'Invalid date';
    }

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

      if (messageDate.getTime() === today.getTime()) {
        return timeStr;
      } else if (messageDate.getTime() === yesterday.getTime()) {
        return `${t('chat.yesterday')} ${timeStr}`;
      } else {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
      }
    } catch (error) {
      logger.error('Error formatting timestamp', { timestamp, error });
      return 'Invalid date';
    }
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.agentAvatar}>
              <IconSymbol name="person.fill" size={20} color="#fff" />
              <View style={styles.onlineIndicator} />
            </View>
            <View>
              <Text style={[styles.agentName, { color: theme.colors.text }]}>
                {agentInfo?.name || 'Agent'}
              </Text>
              <Text style={[styles.agentStatus, { color: agentInfo?.isOnline ? '#4CAF50' : '#999' }]}>
                {agentInfo?.isOnline ? t('chat.online') : t('chat.offline')}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.callButton}
            onPress={() => {
              // Open phone dialer with agent contact if available
              // For now, show an alert - can be enhanced with actual phone number from agentInfo
              showAlert({
                title: 'Call Agent',
                message: 'This feature will initiate a call to your assigned agent. Please contact support for the agent\'s direct number.',
                actions: [{ text: t('common.close'), variant: 'primary' }]
              });
            }}
          >
            <IconSymbol name="phone.fill" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item) => item.id || item.tempId || `msg-${item.timestamp}`}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onScroll={({ nativeEvent }) => {
              if (nativeEvent.contentOffset.y <= 80 && !isLoadingMore && hasMore) {
                handleLoadMore();
              }
            }}
            scrollEventThrottle={16}
            ListHeaderComponent={isLoadingMore ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2196F3" />
              </View>
            ) : null}
            inverted={false}
            ListEmptyComponent={isLoadingMessages ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
              </View>
            ) : null}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            renderItem={({ item: msg }) => {
              const isUser = msg.senderId === (auth.currentUser?.uid || (user as any)?.uid || '');
              return (
                <View
                  key={msg.id || msg.tempId}
                  style={[
                    styles.messageRow,
                    isUser && styles.messageRowUser,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.messageAvatar}>
                      <IconSymbol name="person.fill" size={16} color="#fff" />
                    </View>
                  )}

                  <View style={styles.messageContainer}>
                    {!isUser && (
                      <Text style={[styles.messageSender, { color: theme.colors.text }]}>
                        {msg.senderName || 'Agent'}
                      </Text>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        isUser
                          ? styles.messageBubbleUser
                          : [styles.messageBubbleAgent, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isUser
                            ? styles.messageTextUser
                            : { color: theme.colors.text },
                        ]}
                      >
                        {msg.message}
                      </Text>
                    </View>

                    <View style={[styles.messageFooter, isUser && styles.messageFooterUser]}>
                      <Text style={[styles.messageTime, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {formatMessageTime(msg.timestamp)}
                      </Text>
                      {isUser && msg.status && (
                        <View style={styles.messageStatus}>
                          <IconSymbol
                            name={msg.status === 'sent' ? 'checkmark.circle.fill' : msg.status === 'pending' ? 'clock' : 'checkmark'}
                            size={14}
                            color={msg.status === 'failed' ? '#FF3B30' : '#2196F3'}
                          />
                          {msg.status === 'sent' && (
                            <Text style={[styles.messageStatusText, { color: theme.dark ? '#98989D' : '#666' }]}>
                              {t('chat.send')}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
            <Pressable
              style={styles.attachButton}
              onPress={() => {
                showAlert({
                  title: 'Attach File',
                  message: 'File attachment feature is coming soon. For now, please describe your document in the message and your agent will help you upload it.',
                  actions: [{ text: t('common.close'), variant: 'primary' }]
                });
              }}
            >
              <IconSymbol name="paperclip" size={24} color={theme.dark ? '#98989D' : '#666'} />
            </Pressable>

            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('chat.typeMessage')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
              />
            </View>

            <Pressable
              style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <IconSymbol name="arrow.up" size={24} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
  },
  agentStatus: {
    fontSize: 12,
  },
  callButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
  },
  dateSeparatorText: {
    marginHorizontal: 16,
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContainer: {
    maxWidth: '75%',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBubbleAgent: {
    borderTopLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: '#2196F3',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 12,
    gap: 6,
  },
  messageFooterUser: {
    justifyContent: 'flex-end',
    marginLeft: 0,
    marginRight: 12,
  },
  messageTime: {
    fontSize: 11,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageStatusText: {
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  attachButton: {
    padding: 8,
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

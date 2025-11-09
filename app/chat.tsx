
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, FlatList } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/BackButton";
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

const CASE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const params = useLocalSearchParams();

  const paramId = useMemo(() => normalizeParamValue(params.id).trim(), [params.id]);
  const caseIdParam = useMemo(() => normalizeParamValue(params.caseId).trim(), [params.caseId]);
  const roomIdParam = useMemo(() => normalizeParamValue(params.roomId).trim(), [params.roomId]);

  const initialCaseId = useMemo(() => {
    if (caseIdParam) {
      return caseIdParam;
    }
    if (paramId && CASE_UUID_REGEX.test(paramId)) {
      return paramId;
    }
    return '';
  }, [caseIdParam, paramId]);

  const initialRoomId = useMemo(() => {
    if (roomIdParam) {
      return roomIdParam;
    }
    if (paramId && !CASE_UUID_REGEX.test(paramId)) {
      return paramId;
    }
    return '';
  }, [roomIdParam, paramId]);

  const [message, setMessage] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<ChatMessage['attachments']>([]);
  const flatListRef = useRef<FlatList>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [resolvedCaseId, setResolvedCaseId] = useState<string | null>(initialCaseId || null);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(initialRoomId || null);
  const [agentInfo, setAgentInfo] = useState<{ id?: string; firebaseId?: string; name?: string; profilePicture?: string; isOnline?: boolean } | null>(null);
  const lastMessageTimestampRef = useRef<number>(0);
  const chatInitializedRef = useRef(false);
  const lastInitializedCaseRef = useRef<string | null>(null);

  const {
    chatMessages,
    conversations,
    isLoading,
    error: chatError,
    clearError: clearChatError,
    sendChatMessage,
    loadChatMessages,
    loadOlderChatMessages,
    subscribeToChatMessages,
    markChatAsRead,
    setCurrentConversation,
    currentRoomId,
    fetchConversations,
    addChatMessage,
  } = useMessagesStore();
  const { user } = useAuthStore();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (initialCaseId && initialCaseId !== resolvedCaseId) {
      setResolvedCaseId(initialCaseId);
    }
  }, [initialCaseId, resolvedCaseId]);

  useEffect(() => {
    if (initialRoomId && initialRoomId !== resolvedRoomId) {
      setResolvedRoomId(initialRoomId);
    }
  }, [initialRoomId, resolvedRoomId]);

  useEffect(() => {
    return () => {
      chatInitializedRef.current = false;
      lastInitializedCaseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid || user?.uid;
    if (!userId) {
      return;
    }
    fetchConversations(userId);
  }, [user, fetchConversations]);

  // Resolve chat room ID and set up Firebase subscription
  useEffect(() => {
    if (!resolvedCaseId) {
      lastInitializedCaseRef.current = null;
      chatInitializedRef.current = false;
      setCurrentConversation(null, null);
      setResolvedRoomId(null);
      return;
    }

    const clientFirebaseId = auth.currentUser?.uid || user?.uid;
    if (!clientFirebaseId) {
      showAlert({
        title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
        message: t('chat.unavailableMessage', { defaultValue: 'You need an active session to continue the conversation.' }),
        actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
      });
      return;
    }

    if (lastInitializedCaseRef.current !== resolvedCaseId) {
      chatInitializedRef.current = false;
    }

    if (chatInitializedRef.current && lastInitializedCaseRef.current === resolvedCaseId) {
      return;
    }

    chatInitializedRef.current = true;
    lastInitializedCaseRef.current = resolvedCaseId;

    logger.info('Chat screen mounted - initializing Firebase subscription', { caseId: resolvedCaseId });

    let matchedConversation = conversationList?.find((conversation) =>
      conversation.id === resolvedCaseId ||
      conversation.caseId === resolvedCaseId ||
      conversation.caseReference === resolvedCaseId
    );

    const initialConversationRoomId = matchedConversation?.id || initialRoomId || null;
    setCurrentConversation(initialConversationRoomId, resolvedCaseId);
    setResolvedRoomId(initialConversationRoomId);
    setIsLoadingMessages(true);

    let unsubscribe: (() => void) | null = null;
    let isActive = true;

    const initializeChat = async () => {
      try {
        let conversationList = conversationsRef.current;
        if (!conversationList || conversationList.length === 0) {
          conversationList = useMessagesStore.getState().conversations;
        }

        let matchedConversation = conversationList?.find((conversation) =>
          conversation.id === resolvedCaseId ||
          conversation.caseId === resolvedCaseId ||
          conversation.caseReference === resolvedCaseId
        );

        let effectiveCaseId = matchedConversation?.caseId || resolvedCaseId;
        let inferredRoomId = matchedConversation?.id || null;
        let agentFirebaseId = matchedConversation?.participants?.agentId || agentInfo?.firebaseId || agentInfo?.id;
        let agentDisplayName = matchedConversation?.participants?.agentName || agentInfo?.name;
        let agentProfilePicture = agentInfo?.profilePicture;
        let agentRawId = matchedConversation?.participants?.agentId || agentInfo?.id;

        let caseData: any = null;
        if (!matchedConversation && CASE_UUID_REGEX.test(effectiveCaseId)) {
          try {
            caseData = await casesService.getCaseById(effectiveCaseId);
          } catch (error) {
            logger.warn('Unable to load case details for chat', { caseId: effectiveCaseId, error });
          }
        }

        if (caseData?.id && caseData.id !== effectiveCaseId) {
          if (isActive) {
            setResolvedCaseId(caseData.id);
          }
          setIsLoadingMessages(false);
          return;
        }

        const hasConversationAgent = Boolean(matchedConversation?.participants?.agentId);

        if (caseData?.assignedAgent && !hasConversationAgent) {
          const resolvedFirebaseId = await chatService.resolveFirebaseUserId(caseData.assignedAgent.id);

          agentFirebaseId = resolvedFirebaseId || caseData.assignedAgent.id || agentFirebaseId;
          agentDisplayName =
            `${caseData.assignedAgent.firstName || ''} ${caseData.assignedAgent.lastName || ''}`.trim() ||
            agentDisplayName ||
            'Agent';
          agentProfilePicture = (caseData.assignedAgent as any)?.profilePicture || agentProfilePicture;
          agentRawId = caseData.assignedAgent.id;
        }

        if (!inferredRoomId && agentFirebaseId && clientFirebaseId) {
          try {
            const resolvedRoomId = await chatService.resolveChatRoomIdFromCase(effectiveCaseId, clientFirebaseId, agentFirebaseId);
            inferredRoomId = resolvedRoomId || chatService.getChatRoomIdFromPair(clientFirebaseId, agentFirebaseId);
          } catch (resolutionError) {
            logger.warn('Unable to resolve chat room from case', {
              caseId: effectiveCaseId,
              error: resolutionError,
            });
          }
        }

        if (isActive) {
          setAgentInfo((prev) => {
            const next = {
              id: agentRawId || prev?.id,
              firebaseId: agentFirebaseId || prev?.firebaseId,
              name: agentDisplayName || prev?.name || 'Agent',
              profilePicture: agentProfilePicture ?? prev?.profilePicture,
              isOnline: prev?.isOnline ?? false,
            };
            if (
              prev &&
              prev.id === next.id &&
              prev.firebaseId === next.firebaseId &&
              prev.name === next.name &&
              prev.profilePicture === next.profilePicture &&
              prev.isOnline === next.isOnline
            ) {
              return prev;
            }
            return next;
          });
        }

        if (caseData) {
          const statusKey = normalizeStatus(caseData.status);
          if (statusKey && statusKey !== 'under_review') {
            showAlert({
              title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
              message: t('chat.pendingReview', { defaultValue: 'Your advisor will reach out once the case is under review.' }),
              actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
            });
            setIsLoadingMessages(false);
            return;
          }
        }

        const loadResult = await loadChatMessages(effectiveCaseId, clientFirebaseId, agentFirebaseId);

        if (!isActive) {
          return;
        }

        if (!loadResult.roomId) {
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

        setResolvedRoomId(loadResult.roomId);
        setHasMore(loadResult.hasMore);
        setIsLoadingMessages(false);
        setCurrentConversation(loadResult.roomId, effectiveCaseId);

        const store = useMessagesStore.getState();
        const lastTimestamp =
          Object.values(store.chatMessages).flat().length > 0
            ? Math.max(
              ...Object.values(store.chatMessages)
                .flat()
                .map((m: ChatMessage) => m.timestamp)
            )
            : 0;
        lastMessageTimestampRef.current = lastTimestamp;

        unsubscribe = subscribeToChatMessages(
          loadResult.roomId,
          () => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          },
          lastTimestamp
        );

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 300);

        if (user) {
          const userId = (user as any).uid || (user as any).id || '';
          if (userId) {
            markChatAsRead(loadResult.roomId, userId).catch((error) => {
              logger.warn('Failed to mark messages as read', error);
            });
          }
        }
      } catch (error) {
        logger.error('Failed to initialize chat', error);
        if (isActive) {
          setIsLoadingMessages(false);
          showAlert({
            title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: t('chat.genericError', { defaultValue: 'We were unable to open this conversation. Please try again later.' }),
            actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
          });
        }
      }
    };

    initializeChat();

    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [resolvedCaseId, user, loadChatMessages, markChatAsRead, router, showAlert, subscribeToChatMessages, t]);

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
    const currentKey = resolvedRoomId ?? resolvedCaseId;
    const currentBucket = (chatMessages && currentKey ? chatMessages[currentKey] : []) ?? [];
    if (isLoadingMore || !hasMore || !resolvedCaseId || currentBucket.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestTimestamp = Math.min(...currentBucket.map((m) => m.timestamp));
      const clientFirebaseId = auth.currentUser?.uid || user?.uid;
      const agentFirebaseId = agentInfo?.firebaseId || agentInfo?.id;

      const key = resolvedRoomId ?? resolvedCaseId;
      if (!key) return;
      await loadOlderChatMessages(key, oldestTimestamp, clientFirebaseId, agentFirebaseId);

      // Check if there are more (simplified - you can improve this)
      setHasMore(currentBucket.length >= 20);
    } catch (error) {
      logger.error('Failed to load older messages', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [resolvedCaseId, resolvedRoomId, chatMessages, isLoadingMore, hasMore, user, agentInfo?.firebaseId, agentInfo?.id]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    const currentKey = resolvedRoomId ?? resolvedCaseId ?? '';
    if (!currentKey) return [];
    const bucket = (chatMessages && chatMessages[currentKey]) ?? [];
    if (bucket.length === 0) return [];
    return [...bucket].sort((a, b) => a.timestamp - b.timestamp);
  }, [chatMessages, resolvedRoomId, resolvedCaseId]);

  const handleSend = async () => {
    if ((!message.trim() && (!selectedAttachments || selectedAttachments.length === 0)) || !user || !resolvedCaseId) return;

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
      caseId: resolvedCaseId,
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
    addChatMessage(optimisticMessage);

    // Clear input immediately
    setMessage('');
    setSelectedAttachments([]);

    try {
      // Send to Firebase
      const clientFirebaseId = auth.currentUser?.uid || user.uid;
      const agentFirebaseId = agentInfo?.firebaseId || agentInfo?.id;

      const success = await sendChatMessage(
        resolvedCaseId,
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <BackButton onPress={() => router.back()} iconSize={24} style={{ marginRight: 16 }} />

          <View style={styles.headerCenter}>
            <View style={styles.agentAvatar}>
              <IconSymbol name="person.fill" size={20} color="#fff" />
              <View
                style={[
                  styles.onlineIndicator,
                  { backgroundColor: agentInfo?.isOnline ? '#4CAF50' : '#FF3B30' },
                ]}
              />
            </View>
            <View>
              <Text style={[styles.agentName, { color: theme.colors.text }]}>
                {agentInfo?.name || 'Agent'}
              </Text>
              <Text style={[styles.agentStatus, { color: agentInfo?.isOnline ? '#4CAF50' : '#FF3B30' }]}>
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              const outgoingBubbleColor = '#0B93F6';
              const incomingBubbleColor = theme.dark ? '#2A2A36' : '#FEE1FF';
              const incomingTextColor = theme.dark ? '#F7F7FA' : '#0F172A';
              const statusIcon =
                msg.status === 'failed'
                  ? 'alert-circle-outline'
                  : msg.status === 'pending'
                    ? 'clock-outline'
                    : msg.status === 'sent'
                      ? 'check-all'
                      : 'check';
              const statusColor = msg.status === 'failed' ? '#FF3B30' : '#D0E8FF';

              return (
                <View
                  key={msg.id || msg.tempId}
                  style={[styles.messageRow, isUser && styles.messageRowUser]}
                >
                  {!isUser && (
                    <View style={styles.messageAvatar}>
                      <MaterialCommunityIcons name="account" size={16} color="#fff" />
                    </View>
                  )}

                  <View style={[styles.messageContainer, isUser && styles.messageContainerUser]}>
                    {/* {!isUser && (
                      <Text style={[styles.messageSender, { color: theme.colors.text }]}>
                        {msg.senderName || 'Agent'}
                      </Text>
                    )} */}

                    <View style={styles.messageBubbleWrapper}>
                      <View
                        style={[
                          styles.messageBubble,
                          isUser
                            ? [styles.messageBubbleUser, { backgroundColor: outgoingBubbleColor }]
                            : [
                              styles.messageBubbleAgent,
                              {
                                backgroundColor: incomingBubbleColor,
                                borderColor: theme.dark ? '#3C3C49' : '#C5DBFF',
                              },
                            ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            isUser
                              ? styles.messageTextUser
                              : { color: incomingTextColor },
                          ]}
                        >
                          {msg.message}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.messageFooter, isUser && styles.messageFooterUser]}>
                      <Text style={[styles.messageTime, { color: theme.dark ? '#9A9AA0' : '#6C6C6F' }]}>
                        {formatMessageTime(msg.timestamp)}
                      </Text>
                      {isUser && msg.status && (
                        <View style={styles.messageStatus}>
                          <MaterialCommunityIcons name={statusIcon} size={16} color={statusColor} />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.dark ? '#161618' : '#FFFFFF',
                borderTopColor: theme.dark ? '#2C2C2E' : '#E0E0E0',
                shadowColor: theme.dark ? '#000000' : '#00000020',
              },
            ]}
          >
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
              <MaterialCommunityIcons
                name="paperclip"
                size={22}
                color={theme.dark ? '#A5A5AA' : '#6C6C6F'}
              />
            </Pressable>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.dark ? '#1F1F23' : '#F1F2F4',
                  borderColor: theme.dark ? '#2D2D32' : '#E0E0E5',
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('chat.typeMessage')}
                placeholderTextColor={theme.dark ? '#8E8E94' : '#9A9AA0'}
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
              <MaterialCommunityIcons
                name="send"
                size={22}
                color="#FFFFFF"
              />
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
    paddingVertical: 12,
    paddingBottom: 110,
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
    marginBottom: 18,
    alignItems: 'flex-end',
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
    maxWidth: '78%',
  },
  messageContainerUser: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubbleWrapper: {
    position: 'relative',
    maxWidth: '100%',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#00000010',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    elevation: 1,
  },
  messageBubbleAgent: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 18,
  },
  messageBubbleUser: {
    borderTopRightRadius: 6,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
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
    gap: 10,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  attachButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    maxHeight: 120,
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 100,
    padding: 0,
  },
  sendButton: {
    borderRadius: 24,
    backgroundColor: '#0B93F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
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

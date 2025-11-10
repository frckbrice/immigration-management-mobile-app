
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View, Text, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, FlatList } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import { chatService, ChatMessage, Conversation } from "@/lib/services/chat";
import { auth } from "@/lib/firebase/config";
import { casesService } from "@/lib/services/casesService";
import { logger } from "@/lib/utils/logger";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { mergeMessageIntoList, mergeMessagesBatch, sortMessagesAsc } from "@/lib/utils/chatMessages";
import SearchField from "@/components/SearchField";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

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

const isValidCaseId = (value?: string | null) => Boolean(value && CASE_UUID_REGEX.test(value));

const findConversationMatch = (
  conversations: Conversation[],
  {
    roomId,
    caseId,
    caseReference,
  }: {
    roomId?: string | null;
    caseId?: string | null;
    caseReference?: string | null;
  }
) => {
  const trimmedRoomId = roomId?.trim();
  if (trimmedRoomId) {
    const byRoom = conversations.find((conversation) => conversation.id === trimmedRoomId);
    if (byRoom) {
      return byRoom;
    }
  }

  const normalizedCaseId = caseId && isValidCaseId(caseId) ? caseId : null;
  if (normalizedCaseId) {
    const byCaseId = conversations.find(
      (conversation) => isValidCaseId(conversation.caseId) && conversation.caseId === normalizedCaseId
    );
    if (byCaseId) {
      return byCaseId;
    }
  }

  const trimmedReference = caseReference?.trim();
  if (trimmedReference) {
    const byReference = conversations.find(
      (conversation) =>
        conversation.caseReference === trimmedReference && isValidCaseId(conversation.caseId)
    );
    if (byReference) {
      return byReference;
    }
  }

  return undefined;
};

export default function ChatScreen() {
  const theme = useAppTheme();
  const colors = useThemeColors();
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
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
  const lastMessageTimestampRef = useRef<number>(0);
  const chatInitializedRef = useRef(false);
  const lastInitializedCaseRef = useRef<string | null>(null);
  const initializationKeyRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(initialRoomId || null);

  const {
    chatMessages,
    conversations,
    isLoading,
    error: chatError,
    clearError: clearChatError,
    sendChatMessage,
    loadChatMessages,
    loadOlderChatMessages,
    markChatAsRead,
    setCurrentConversation,
    currentConversationId,
    currentCaseId,
    currentRoomId,
    fetchConversations,
    addChatMessage,
  } = useMessagesStore();
  const { user } = useAuthStore();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'attachments' | 'agent' | 'mine'>('all');

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadChatMessagesRef = useRef(loadChatMessages);
  useEffect(() => {
    loadChatMessagesRef.current = loadChatMessages;
  }, [loadChatMessages]);

  const markChatAsReadRef = useRef(markChatAsRead);
  useEffect(() => {
    markChatAsReadRef.current = markChatAsRead;
  }, [markChatAsRead]);

  const addChatMessageRef = useRef(addChatMessage);
  useEffect(() => {
    addChatMessageRef.current = addChatMessage;
  }, [addChatMessage]);

  const showAlertRef = useRef(showAlert);
  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const userUid = useMemo(
    () => auth.currentUser?.uid || (user as any)?.uid || '',
    [user]
  );

  const effectKey = useMemo(
    () =>
      [
        resolvedCaseId ?? '',
        initialRoomId ?? '',
        caseIdParam ?? '',
        paramId ?? '',
        userUid ?? '',
      ].join('|'),
    [resolvedCaseId, initialRoomId, caseIdParam, paramId, userUid]
  );

  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) {
      return;
    }

    setDisplayMessages((prev) => {
      if (prev.length === 0) {
        return sortMessagesAsc(chatMessages);
      }

      const existingIds = new Set(
        prev.map((message) => message.id || message.tempId || '')
      );
      const unseen = chatMessages.filter(
        (message) => !existingIds.has(message.id || message.tempId || '')
      );

      if (unseen.length === 0) {
        return prev;
      }

      return mergeMessagesBatch(prev, unseen);
    });
  }, [chatMessages]);

  useEffect(() => {
    if (initialCaseId && !resolvedCaseId) {
      setResolvedCaseId(initialCaseId);
    }
  }, [initialCaseId, resolvedCaseId]);

  useEffect(() => {
    if (initialRoomId && !resolvedRoomId) {
      setResolvedRoomId(initialRoomId);
    }
  }, [initialRoomId, resolvedRoomId]);

  useEffect(() => {
    return () => {
      chatInitializedRef.current = false;
      lastInitializedCaseRef.current = null;
      initializationKeyRef.current = null;
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
      initializationKeyRef.current = null;
      setCurrentConversation(null, null);
      if (resolvedRoomId !== null) {
        setResolvedRoomId(null);
      }
      activeRoomIdRef.current = null;
      setDisplayMessages([]);
      return;
    }

    const clientFirebaseId = auth.currentUser?.uid || user?.uid;
    if (!clientFirebaseId) {
      initializationKeyRef.current = null;
      showAlert({
        title: t('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
        message: t('chat.unavailableMessage', { defaultValue: 'You need an active session to continue the conversation.' }),
        actions: [{ text: t('common.close'), variant: 'primary', onPress: () => router.back() }],
      });
      return;
    }

    if (lastInitializedCaseRef.current !== resolvedCaseId) {
      chatInitializedRef.current = false;
      const pendingKey = initializationKeyRef.current;
      if (!pendingKey || !pendingKey.startsWith(`${resolvedCaseId}::`)) {
        initializationKeyRef.current = null;
      }
    }

    if (chatInitializedRef.current && lastInitializedCaseRef.current === resolvedCaseId) {
      return;
    }

    const initKey = `${resolvedCaseId}::${clientFirebaseId}`;
    if (initializationKeyRef.current === initKey) {
      return;
    }

    const conversationListSnapshot = conversationsRef.current ?? [];
    const candidateReference =
      !isValidCaseId(caseIdParam) && caseIdParam ? caseIdParam : !isValidCaseId(paramId) && paramId ? paramId : null;

    const matchedConversation = findConversationMatch(conversationListSnapshot, {
      roomId: resolvedRoomId ?? initialRoomId,
      caseId: resolvedCaseId,
      caseReference: candidateReference,
    });

    const canonicalCaseId = matchedConversation?.caseId && isValidCaseId(matchedConversation.caseId)
      ? matchedConversation.caseId
      : (resolvedCaseId && isValidCaseId(resolvedCaseId) ? resolvedCaseId : null);

    if (canonicalCaseId && canonicalCaseId !== resolvedCaseId) {
      initializationKeyRef.current = null;
      setResolvedCaseId(canonicalCaseId);
      return;
    }

    const desiredCaseId = canonicalCaseId || resolvedCaseId;

    const syncConversationState = (roomId: string | null, caseId: string | null) => {
      const normalizedCase = caseId ?? null;
      if (currentConversationId !== roomId || currentCaseId !== normalizedCase) {
        setCurrentConversation(roomId, normalizedCase);
      }
    };

    const ensureResolvedRoomState = (roomId: string | null) => {
      if (resolvedRoomId !== roomId) {
        setResolvedRoomId(roomId);
      }
    };

    // We'll decide which room to use after resolving participant Firebase IDs

    initializationKeyRef.current = initKey;
    setIsLoadingMessages(true);

    const loadChatMessagesFn = loadChatMessagesRef.current;
    const markChatAsReadFn = markChatAsReadRef.current;
    const addChatMessageFn = addChatMessageRef.current;
    const showAlertFn = showAlertRef.current;
    const routerInstance = routerRef.current;
    const translate = tRef.current;
    const currentUser = userRef.current;

    let unsubscribe: (() => void) | null = null;
    let isActive = true;

    const initializeChat = async () => {
      try {
        let conversationList = conversationsRef.current;
        if (!conversationList || conversationList.length === 0) {
          conversationList = useMessagesStore.getState().conversations;
        }

        const matchedConversation = findConversationMatch(conversationList, {
          roomId: resolvedRoomId ?? initialRoomId,
          caseId: resolvedCaseId,
          caseReference: candidateReference,
        });

        let effectiveCaseId = matchedConversation?.caseId && isValidCaseId(matchedConversation.caseId)
          ? matchedConversation.caseId
          : (resolvedCaseId && isValidCaseId(resolvedCaseId) ? resolvedCaseId : null);

        let inferredRoomId = matchedConversation?.id || resolvedRoomId || initialRoomId || null;
        let agentFirebaseId = matchedConversation?.participants?.agentId || agentInfo?.firebaseId || agentInfo?.id || null;
        let agentDisplayName = matchedConversation?.participants?.agentName || agentInfo?.name;
        let agentProfilePicture = agentInfo?.profilePicture;
        let agentRawId = matchedConversation?.participants?.agentId || agentInfo?.id || null;

        if (agentFirebaseId) {
          try {
            const resolvedAgentFirebaseId = await chatService.resolveFirebaseUserId(agentFirebaseId);
            if (resolvedAgentFirebaseId) {
              agentFirebaseId = resolvedAgentFirebaseId;
            }
          } catch (resolveError) {
            logger.warn('Unable to resolve agent Firebase UID from metadata', {
              agentFirebaseId,
              error: resolveError,
            });
          }
        }

        let caseData: any = null;
        if (!matchedConversation && effectiveCaseId && isValidCaseId(effectiveCaseId)) {
          try {
            caseData = await casesService.getCaseById(effectiveCaseId);
          } catch (error) {
            logger.warn('Unable to load case details for chat', { caseId: effectiveCaseId, error });
          }
        }

        if (!effectiveCaseId) {
          const resolvedFromCaseData = caseData?.id && isValidCaseId(caseData.id) ? caseData.id : null;
          if (resolvedFromCaseData) {
            effectiveCaseId = resolvedFromCaseData;
          }
        }

        if (!effectiveCaseId && inferredRoomId) {
          effectiveCaseId = inferredRoomId;
        }

        if (!effectiveCaseId) {
          logger.error('Unable to determine a valid caseId for chat initialization', {
            resolvedCaseId,
            candidateReference,
            inferredRoomId,
          });
          if (isActive) {
            setIsLoadingMessages(false);
            chatInitializedRef.current = false;
            showAlertFn({
              title: translate('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
              message: translate('chat.genericError', {
                defaultValue: 'We were unable to open this conversation. Please try again later.',
              }),
              actions: [{ text: translate('common.close'), variant: 'primary', onPress: () => routerInstance.back() }],
            });
          }
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
            const resolvedRoom = await chatService.resolveChatRoomIdFromCase(effectiveCaseId, clientFirebaseId, agentFirebaseId);
            inferredRoomId = resolvedRoom || chatService.getChatRoomIdFromPair(clientFirebaseId, agentFirebaseId);
          } catch (resolutionError) {
            logger.warn('Unable to resolve chat room from case', {
              caseId: effectiveCaseId,
              error: resolutionError,
            });
          }
        }

        const pairRoomIdCandidate =
          clientFirebaseId && agentFirebaseId
            ? chatService.getChatRoomIdFromPair(clientFirebaseId, agentFirebaseId)
            : null;

        let initialConversationRoomId =
          matchedConversation?.id || pairRoomIdCandidate || inferredRoomId || resolvedRoomId || initialRoomId || null;

        if (!initialConversationRoomId && clientFirebaseId && effectiveCaseId) {
          try {
            initialConversationRoomId = await chatService.findRoomIdForCase(clientFirebaseId, effectiveCaseId);
          } catch (lookupError) {
            logger.warn('[Chat UI] failed to find room via userChats', lookupError);
          }
        }

        syncConversationState(initialConversationRoomId, effectiveCaseId);
        ensureResolvedRoomState(initialConversationRoomId);

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
            showAlertFn({
              title: translate('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
              message: translate('chat.pendingReview', { defaultValue: 'Your advisor will reach out once the case is under review.' }),
              actions: [{ text: translate('common.close'), variant: 'primary', onPress: () => routerInstance.back() }],
            });
            setIsLoadingMessages(false);
            chatInitializedRef.current = false;
            return;
          }
        }

        const loadResult = await loadChatMessagesFn({
          caseId: effectiveCaseId,
          roomId: initialConversationRoomId,
          clientId: clientFirebaseId || null,
          agentId: agentFirebaseId || null,
        });

        if (!isActive) {
          return;
        }

        const inferredPairRoomId =
          clientFirebaseId && agentFirebaseId
            ? chatService.getChatRoomIdFromPair(clientFirebaseId, agentFirebaseId)
            : null;

        let subscriptionRoomId =
          loadResult.roomId || inferredPairRoomId || inferredRoomId || initialConversationRoomId || null;

        if (!subscriptionRoomId && clientFirebaseId && effectiveCaseId) {
          try {
            const resolvedFromUserChats = await chatService.findRoomIdForCase(clientFirebaseId, effectiveCaseId);
            if (resolvedFromUserChats) {
              subscriptionRoomId = resolvedFromUserChats;
            }
          } catch (lookupError) {
            logger.warn('[Chat UI] failed to resolve subscription room via userChats', lookupError);
          }
        }

        const attachRealtimeSubscription = (roomId: string, activateImmediately: boolean) => {
          if (activateImmediately) {
            activeRoomIdRef.current = roomId;
            ensureResolvedRoomState(roomId);
            syncConversationState(roomId, effectiveCaseId);
          }

          return chatService.subscribeToNewMessagesOptimized(
            roomId,
            (incomingMessage) => {
              setDisplayMessages((prev) => mergeMessageIntoList(prev, incomingMessage));
              addChatMessageFn(incomingMessage);

              if (
                incomingMessage?.timestamp &&
                incomingMessage.timestamp > lastMessageTimestampRef.current
              ) {
                lastMessageTimestampRef.current = incomingMessage.timestamp;
              }

              if (!activeRoomIdRef.current) {
                activeRoomIdRef.current = roomId;
                ensureResolvedRoomState(roomId);
                syncConversationState(roomId, effectiveCaseId);

                if (clientFirebaseId) {
                  markChatAsRead(roomId, clientFirebaseId).catch((error) => {
                    logger.warn('Failed to mark messages as read', error);
                  });
                }
              }

              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            },
            lastMessageTimestampRef.current || undefined
          );
        };

        if (!loadResult.roomId) {
          if (subscriptionRoomId) {
            unsubscribe = attachRealtimeSubscription(subscriptionRoomId, true);
            activeRoomIdRef.current = subscriptionRoomId;
            ensureResolvedRoomState(subscriptionRoomId);
            syncConversationState(subscriptionRoomId, effectiveCaseId);
          }

          if (!subscriptionRoomId) {
            ensureResolvedRoomState(null);
            syncConversationState(null, null);
            activeRoomIdRef.current = null;

            setDisplayMessages([]);
            useMessagesStore.setState({
              chatMessages: [],
              currentRoomId: null,
              currentCaseId: null,
              isLoading: false,
              error: null,
            });

            lastMessageTimestampRef.current = 0;
            setHasMore(false);
            setIsLoadingMessages(false);
            chatInitializedRef.current = true;
            lastInitializedCaseRef.current = resolvedCaseId;

            showAlertFn({
              title: translate('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
              message: translate('chat.awaitAgentInitiation', { defaultValue: 'Your advisor will open the conversation soon. You can reply once it is available.' }),
              actions: [{ text: translate('common.close'), variant: 'primary', onPress: () => routerInstance.back() }],
            });
          }

          return;
        }

        ensureResolvedRoomState(loadResult.roomId);
        syncConversationState(loadResult.roomId, effectiveCaseId);
        setHasMore(loadResult.hasMore);
        setIsLoadingMessages(false);

        chatInitializedRef.current = true;
        lastInitializedCaseRef.current = resolvedCaseId;

        const sortedInitialMessages = sortMessagesAsc(loadResult.messages ?? []);
        setDisplayMessages(sortedInitialMessages);
        activeRoomIdRef.current = loadResult.roomId;

        useMessagesStore.setState({
          chatMessages: sortedInitialMessages,
          currentRoomId: loadResult.roomId,
          currentCaseId: effectiveCaseId,
          isLoading: false,
          error: null,
        });

        const lastTimestamp =
          sortedInitialMessages.length > 0
            ? Math.max(...sortedInitialMessages.map((m: ChatMessage) => m.timestamp))
            : 0;
        lastMessageTimestampRef.current = lastTimestamp;

        if (subscriptionRoomId) {
          unsubscribe = attachRealtimeSubscription(subscriptionRoomId, true);
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 300);

        if (currentUser) {
          const currentUserId = (currentUser as any).uid || (currentUser as any).id || '';
          if (currentUserId) {
            markChatAsReadFn(loadResult.roomId, currentUserId).catch((error) => {
              logger.warn('Failed to mark messages as read', error);
            });
          }
        }
      } catch (error) {
        logger.error('[Chat UI] failed to initialize chat', error);
        if (isActive) {
          setIsLoadingMessages(false);
          chatInitializedRef.current = false;
          showAlertFn({
            title: translate('chat.unavailableTitle', { defaultValue: 'Chat Unavailable' }),
            message: translate('chat.genericError', { defaultValue: 'We were unable to open this conversation. Please try again later.' }),
            actions: [{ text: translate('common.close'), variant: 'primary', onPress: () => routerInstance.back() }],
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
      activeRoomIdRef.current = null;
      setDisplayMessages([]);
    };
  }, [effectKey]);

  useEffect(() => {
    if (chatError) {
      logger.error('[Chat UI] chat error state', chatError);
      showAlert({
        title: t('common.error'),
        message: chatError,
        actions: [{ text: t('common.close'), variant: 'primary', onPress: () => clearChatError() }],
      });
    }
  }, [chatError, clearChatError, showAlert, t]);

  // Load more messages when scrolling up
  const handleLoadMore = useCallback(async () => {
    const currentBucket = displayMessages;
    if (isLoadingMore || !hasMore || currentBucket.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const oldestTimestamp = Math.min(...currentBucket.map((m) => m.timestamp));
      const activeRoomId = activeRoomIdRef.current || resolvedRoomId || currentRoomId || null;
      if (!activeRoomId) return;

      const result = await chatService.loadOlderMessages(activeRoomId, oldestTimestamp, 20);
      if (result?.messages?.length) {
        setDisplayMessages((prev) => mergeMessagesBatch(prev, result.messages));
        useMessagesStore.setState({
          chatMessages: mergeMessagesBatch(useMessagesStore.getState().chatMessages ?? [], result.messages),
        });
      }
      if (typeof result?.hasMore === 'boolean') {
        setHasMore(result.hasMore);
      } else if (!result || !result.messages) {
        setHasMore(false);
      }
    } catch (error) {
      logger.error('[Chat UI] failed to load older messages', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [displayMessages, resolvedRoomId, currentRoomId, isLoadingMore, hasMore]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => sortMessagesAsc(displayMessages), [displayMessages]);
  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const filteredMessages = useMemo(() => {
    let base = sortedMessages;

    if (activeFilter === 'attachments') {
      base = base.filter((message) => (message.attachments?.length ?? 0) > 0);
    } else if (activeFilter === 'agent') {
      base = base.filter((message) => message.senderId && message.senderId !== userUid);
    } else if (activeFilter === 'mine') {
      base = base.filter((message) => message.senderId === userUid);
    }

    if (hasSearchQuery) {
      base = base.filter((message) => {
        const content = (message.message ?? '').toLowerCase();
        const senderName = (message.senderName ?? '').toLowerCase();
        return content.includes(normalizedSearchQuery) || senderName.includes(normalizedSearchQuery);
      });
    }

    return base;
  }, [sortedMessages, activeFilter, hasSearchQuery, normalizedSearchQuery, userUid]);
  const isFiltered = activeFilter !== 'all' || hasSearchQuery;

  const handleSend = async () => {
    if ((!message.trim() && (!selectedAttachments || selectedAttachments.length === 0)) || !user || !resolvedCaseId) return;

    const activeRoomId = activeRoomIdRef.current || currentRoomId || resolvedRoomId;
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
    setDisplayMessages((prev) => mergeMessageIntoList(prev, optimisticMessage));
    addChatMessage(optimisticMessage);

    // Clear input immediately
    setMessage('');
    setSelectedAttachments([]);

    try {
      // Send to Firebase
      const clientFirebaseId = auth.currentUser?.uid || user.uid;
      const agentFirebaseId = agentInfo?.firebaseId || undefined;

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
        logger.error('[Chat UI] failed to send message');
        setDisplayMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? { ...msg, status: 'failed', error: 'Failed to send' }
              : msg
          )
        );
        useMessagesStore.setState((state) => ({
          chatMessages: state.chatMessages.map((msg) =>
            msg.id === tempId
              ? { ...msg, status: 'failed', error: 'Failed to send' }
              : msg
          ),
        }));
      } else {
        setDisplayMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'sent' } : msg))
        );
        useMessagesStore.setState((state) => ({
          chatMessages: state.chatMessages.map((msg) =>
            msg.id === tempId ? { ...msg, status: 'sent' } : msg
          ),
        }));
      }
    } catch (error: any) {
      logger.error('[Chat UI] failed to send message', error);
      setDisplayMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
              ...msg,
              status: 'failed',
              error: error?.message || 'Failed to send',
            }
            : msg
        )
      );
      useMessagesStore.setState((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === tempId
            ? {
              ...msg,
              status: 'failed',
              error: error?.message || 'Failed to send',
            }
            : msg
        ),
      }));
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
      logger.error('[Chat UI] error formatting timestamp', { timestamp, error });
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
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.dark ? colors.background : withOpacity(colors.primary, 0.04),
          },
        ]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.dark
                ? withOpacity(colors.surfaceElevated, 0.85)
                : withOpacity(colors.surfaceAlt, 0.95),
              borderBottomColor: withOpacity(colors.borderStrong, theme.dark ? 0.75 : 0.35),
              shadowColor: theme.dark ? '#000000' : withOpacity(colors.primary, 0.45),
            },
          ]}
        >
          <BackButton onPress={() => router.back()} iconSize={24} style={{ marginRight: 16 }} />

          <View style={styles.headerCenter}>
            <View
              style={[
                styles.agentAvatar,
                {
                  backgroundColor: theme.dark ? colors.secondary : colors.primary,
                  shadowColor: withOpacity(theme.dark ? colors.secondary : colors.primary, 0.35),
                },
              ]}
            >
              <IconSymbol name="person.fill" size={20} color="#fff" />
              <View
                style={[
                  styles.onlineIndicator,
                  {
                    backgroundColor: agentInfo?.isOnline ? colors.success : colors.warning,
                    borderColor: theme.dark ? colors.surface : '#fff',
                  },
                ]}
              />
            </View>
            <View>
              <Text style={[styles.agentName, { color: theme.colors.text }]}>
                {agentInfo?.name || 'Agent'}
              </Text>
              <Text
                style={[
                  styles.agentStatus,
                  { color: agentInfo?.isOnline ? colors.success : colors.warning },
                ]}
              >
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
          style={[
            styles.chatContainer,
            {
              backgroundColor: theme.dark ? colors.surface : colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.7 : 0.25),
              borderWidth: StyleSheet.hairlineWidth,
              shadowColor: theme.dark ? '#000000' : withOpacity(colors.secondary, 0.18),
            },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View
            style={[
              styles.messagesToolbar,
              {
                backgroundColor: theme.dark
                  ? withOpacity(colors.surfaceElevated, 0.9)
                  : withOpacity(colors.surfaceAlt, 0.95),
                borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.55 : 0.25),
                shadowColor: theme.dark ? '#000000' : withOpacity(colors.warning, 0.45),
              },
            ]}
          >
            <SearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder={t('chat.searchPlaceholder', { defaultValue: 'Find past messages or updates' })}
              containerStyle={[
                styles.searchField,
                {
                  backgroundColor: theme.dark ? colors.surface : colors.surface,
                  borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.6 : 0.28),
                },
              ]}
              returnKeyType="search"
            />

            <View style={styles.filterChipsRow}>
              {[
                { id: 'all', label: t('chat.filters.all', { defaultValue: 'All' }) },
                { id: 'attachments', label: t('chat.filters.attachments', { defaultValue: 'Files' }) },
                { id: 'agent', label: t('chat.filters.agent', { defaultValue: 'Agent' }) },
                { id: 'mine', label: t('chat.filters.mine', { defaultValue: 'Me' }) },
              ].map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <Pressable
                    key={filter.id}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: isActive
                          ? withOpacity(colors.warning, theme.dark ? 0.9 : 0.75)
                          : withOpacity(colors.borderStrong, theme.dark ? 0.55 : 0.25),
                        backgroundColor: isActive
                          ? withOpacity(colors.warning, theme.dark ? 0.22 : 0.14)
                          : withOpacity(colors.surface, theme.dark ? 0.8 : 0.9),
                        shadowColor: isActive
                          ? withOpacity(colors.success, theme.dark ? 0.6 : 0.35)
                          : 'transparent',
                      },
                    ]}
                    onPress={() => setActiveFilter(filter.id as typeof activeFilter)}
                  >
                    <MaterialCommunityIcons
                      name={
                        filter.id === 'attachments'
                          ? 'paperclip'
                          : filter.id === 'agent'
                            ? 'account-tie'
                            : filter.id === 'mine'
                              ? 'account-circle'
                              : 'filter'
                      }
                      size={15}
                      color={isActive ? colors.warning : colors.muted}
                    />
                    <Text
                      style={[
                        styles.filterChipLabel,
                        {
                          color: isActive ? colors.warning : colors.text,
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isFiltered && (
              <View
                style={[
                  styles.filterSummary,
                  {
                    backgroundColor: withOpacity(colors.success, theme.dark ? 0.18 : 0.12),
                    borderColor: withOpacity(colors.success, theme.dark ? 0.6 : 0.4),
                  },
                ]}
              >
                <MaterialCommunityIcons name="check-decagram" size={16} color={colors.success} />
                <Text style={[styles.filterSummaryText, { color: colors.success }]}>
                  {t('chat.filters.activeSummary', { defaultValue: 'Filters applied' })}
                </Text>
              </View>
            )}
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={(item) => item.id || item.tempId || `msg-${item.timestamp}`}
            style={styles.messagesContainer}
            contentContainerStyle={[
              styles.messagesContent,
              {
                backgroundColor: theme.dark
                  ? withOpacity(colors.surfaceElevated, 0.6)
                  : withOpacity('#FFF9C4', 0.25),
              },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={({ nativeEvent }) => {
              if (nativeEvent.contentOffset.y <= 80 && !isLoadingMore && hasMore) {
                handleLoadMore();
              }
            }}
            scrollEventThrottle={16}
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            inverted={false}
            ListEmptyComponent={
              isLoadingMessages ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name={isFiltered ? 'text-search' : 'chat-processing-outline'}
                    size={32}
                    color={isFiltered ? colors.warning : colors.muted}
                  />
                  <Text style={[styles.emptyStateText, { color: colors.mutedAlt }]}>
                    {isFiltered
                      ? t('chat.filters.emptyResults', { defaultValue: 'No messages match your filters yet.' })
                      : t('chat.emptyState', { defaultValue: 'Start the conversation with your agent.' })}
                  </Text>
                </View>
              )
            }
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            renderItem={({ item: msg }) => {
              const isUser = msg.senderId === (auth.currentUser?.uid || (user as any)?.uid || '');
              const outgoingBubbleColor = theme.dark ? colors.secondary : colors.primary;
              const incomingBubbleColor = theme.dark ? '#2A2A36' : withOpacity(colors.surfaceAlt, 0.95);
              const incomingTextColor = theme.dark ? '#F7F7FA' : '#0F172A';
              const matchesSearch =
                hasSearchQuery &&
                ((msg.message ?? '').toLowerCase().includes(normalizedSearchQuery) ||
                  (msg.senderName ?? '').toLowerCase().includes(normalizedSearchQuery));
              const statusIcon =
                msg.status === 'failed'
                  ? 'alert-circle-outline'
                  : msg.status === 'pending'
                    ? 'clock-outline'
                    : msg.status === 'sent'
                      ? 'check-all'
                      : 'check';
              const statusColor = msg.status === 'failed' ? colors.danger : withOpacity(colors.success, 0.85);

              return (
                <View
                  key={msg.id || msg.tempId}
                  style={[styles.messageRow, isUser && styles.messageRowUser]}
                >
                  {!isUser && (
                    <View
                      style={[
                        styles.messageAvatar,
                        {
                          backgroundColor: withOpacity(colors.success, theme.dark ? 0.45 : 0.2),
                          borderColor: withOpacity(colors.success, theme.dark ? 0.7 : 0.45),
                        },
                      ]}
                    >
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
                          matchesSearch &&
                          (isUser
                            ? {
                              borderWidth: 1,
                              borderColor: withOpacity(colors.warning, 0.8),
                              shadowColor: withOpacity(colors.warning, 0.6),
                              shadowOpacity: 0.45,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 4 },
                            }
                            : {
                              borderWidth: 1,
                              borderColor: withOpacity(colors.success, 0.8),
                              backgroundColor: withOpacity(colors.warning, theme.dark ? 0.25 : 0.2),
                              shadowColor: withOpacity(colors.success, 0.35),
                              shadowOpacity: 0.4,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 3 },
                            }),
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            isUser
                              ? styles.messageTextUser
                              : { color: incomingTextColor },
                            matchesSearch && {
                              color: isUser ? colors.onPrimary : colors.text,
                              fontWeight: '600',
                            },
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
                backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
                borderTopColor: withOpacity(colors.borderStrong, theme.dark ? 0.7 : 0.2),
                shadowColor: theme.dark ? '#000000' : withOpacity(colors.primary, 0.25),
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
                color={colors.muted}
              />
            </Pressable>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.dark ? withOpacity(colors.surfaceAlt, 0.8) : withOpacity(colors.surfaceAlt, 0.9),
                  borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.6 : 0.28),
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('chat.typeMessage')}
                placeholderTextColor={withOpacity(colors.text, 0.4)}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
              />
            </View>

            <Pressable
              style={[
                styles.sendButton,
                {
                  backgroundColor: colors.primary,
                  shadowColor: withOpacity(theme.dark ? colors.secondary : colors.primary, 0.45),
                },
                !message.trim() && styles.sendButtonDisabled,
              ]}
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
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
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
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
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 110,
  },
  messagesToolbar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.2,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  searchField: {
    borderRadius: 18,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    shadowOpacity: 0.25,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterSummaryText: {
    fontSize: 13,
    fontWeight: '600',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  messageBubbleUser: {
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
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
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
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


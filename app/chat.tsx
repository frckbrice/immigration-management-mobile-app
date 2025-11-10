
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
import { chatService, ChatMessage, Conversation } from "@/lib/services/chat";
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

const isValidCaseId = (value?: string | null) => Boolean(value && CASE_UUID_REGEX.test(value));

const sortMessagesAsc = (messages: ChatMessage[]) =>
  [...messages].sort((a, b) => a.timestamp - b.timestamp);

const mergeMessageIntoList = (messages: ChatMessage[], newMessage: ChatMessage) => {
  const byIdIndex = messages.findIndex(
    (m) => m.id === newMessage.id || (newMessage.id && m.tempId === newMessage.id)
  );

  if (byIdIndex !== -1) {
    const updated = [...messages];
    updated[byIdIndex] = newMessage;
    return sortMessagesAsc(updated);
  }

  const pendingMatchIndex = messages.findIndex((m) => {
    if (!m.tempId) {
      return false;
    }

    const sameSender = !m.senderId || !newMessage.senderId ? true : m.senderId === newMessage.senderId;

    const sameMessageContent = (m.message || '') === (newMessage.message || '');

    const timestampDelta = Math.abs((m.timestamp || 0) - (newMessage.timestamp || 0));

    const attachmentsComparable =
      (m.attachments?.length || 0) === (newMessage.attachments?.length || 0);

    return sameSender && sameMessageContent && attachmentsComparable && timestampDelta < 60_000;
  });

  if (pendingMatchIndex !== -1) {
    const updated = [...messages];
    updated[pendingMatchIndex] = {
      ...newMessage,
      status: newMessage.status ?? 'sent',
    };
    return sortMessagesAsc(updated);
  }

  const filtered = messages.filter(
    (m) =>
      !(
        m.tempId &&
        m.message === newMessage.message &&
        Math.abs(m.timestamp - newMessage.timestamp) < 60_000
      )
  );

  return sortMessagesAsc([...filtered, newMessage]);
};

const mergeMessagesBatch = (messages: ChatMessage[], incoming: ChatMessage[]) => {
  if (!incoming || incoming.length === 0) {
    return messages;
  }
  return incoming.reduce((acc, message) => mergeMessageIntoList(acc, message), messages);
};

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
    logger.info('[Chat UI] initialize effect', {
      resolvedCaseId,
      initialRoomId,
      resolvedRoomId,
      conversationsCount: conversationListSnapshot.length,
    });

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
        logger.info('[Chat UI] matched conversation', {
          matched: Boolean(matchedConversation),
          matchedConversationId: matchedConversation?.id,
          inferredRoomId,
        });
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
        } else {
          logger.info('[Chat UI] agent firebase id missing after metadata merge', {
            matchedAgentId: matchedConversation?.participants?.agentId,
            agentInfoFirebase: agentInfo?.firebaseId,
            agentInfoId: agentInfo?.id,
          });
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

        logger.info('[Chat UI] resolved identifiers', {
          effectiveCaseId,
          clientFirebaseId,
          agentFirebaseId,
          pairRoomIdCandidate,
          inferredRoomId,
          initialConversationRoomId,
        });

        syncConversationState(initialConversationRoomId, effectiveCaseId);
        ensureResolvedRoomState(initialConversationRoomId);

        if (isActive) {
          logger.debug('\n\n\n [Chat UI] setting agent info', { agentRawId, agentFirebaseId, agentDisplayName, agentProfilePicture });
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
            logger.debug('\n\n\n [Chat UI] showing alert for case status', { statusKey });
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

        logger.info('[Chat UI] loading initial messages', {
          caseId: effectiveCaseId,
          loadRoomId: initialConversationRoomId,
          clientFirebaseId,
          agentFirebaseId,
        });

        const loadResult = await loadChatMessagesFn({
          caseId: effectiveCaseId,
          roomId: initialConversationRoomId,
          clientId: clientFirebaseId || null,
          agentId: agentFirebaseId || null,
        });

        if (!isActive) {
          logger.info('\n\n\n [Chat UI] initialization cancelled - component not active');
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
            logger.debug('\n\n\n [Chat UI] resolved from user chats', { resolvedFromUserChats });
            if (resolvedFromUserChats) {
              subscriptionRoomId = resolvedFromUserChats;
            }
            logger.debug('\n\n\n [Chat UI] subscription room id from user chats', { subscriptionRoomId });
          } catch (lookupError) {
            logger.warn('\n\n\n [Chat UI] failed to resolve subscription room via userChats', lookupError);
          }
        }

        logger.info('\n\n\n [Chat UI] initial load result', {
          loadResultRoomId: loadResult.roomId,
          inferredPairRoomId,
          inferredRoomId,
          initialConversationRoomId,
          subscriptionRoomId,
          loadCount: loadResult.messages?.length ?? 0,
        });

        const attachRealtimeSubscription = (roomId: string, activateImmediately: boolean) => {
          logger.info('\n\n\n [Chat UI] attaching realtime listener', { roomId, activateImmediately });

          if (activateImmediately) {
            activeRoomIdRef.current = roomId;
            ensureResolvedRoomState(roomId);
            syncConversationState(roomId, effectiveCaseId);
          }

          return chatService.subscribeToNewMessagesOptimized(
            roomId,
            (incomingMessage) => {
              logger.info('\n\n\n [Chat UI] incoming realtime message', {
                id: incomingMessage.id,
                timestamp: incomingMessage.timestamp,
                senderId: incomingMessage.senderId,
                roomId,
              });

              setDisplayMessages((prev) => mergeMessageIntoList(prev, incomingMessage));
              logger.info('\n\n\n [Chat UI] merging message into list', {
                displayMessages: displayMessages.length,
              });
              addChatMessageFn(incomingMessage);

              if (
                incomingMessage?.timestamp &&
                incomingMessage.timestamp > lastMessageTimestampRef.current
              ) {
                lastMessageTimestampRef.current = incomingMessage.timestamp;
              }

              if (!activeRoomIdRef.current) {
                logger.info('\n\n\n [Chat UI] promoting pending room to active', { roomId });
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
          logger.info('\n\n\n [Chat UI] no initial room id from load result', {
            subscriptionRoomId,
          });
          if (subscriptionRoomId) {
            logger.info('\n\n\n [Chat UI] attaching realtime listener to subscription room', {
              subscriptionRoomId,
            });
            unsubscribe = attachRealtimeSubscription(subscriptionRoomId, true);
            activeRoomIdRef.current = subscriptionRoomId;
            ensureResolvedRoomState(subscriptionRoomId);
            syncConversationState(subscriptionRoomId, effectiveCaseId);
          }

          if (!subscriptionRoomId) {
            logger.info('\n\n\n [Chat UI] no subscription room id from load result', {
              subscriptionRoomId,
            });
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

        logger.info('\n\n\n [Chat UI] initial messages ready', {
          activeRoomId: activeRoomIdRef.current,
          sortedCount: sortedInitialMessages.length,
        });

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

        logger.debug('\n\n\n sortedInitialMessages', unsubscribe);

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
        logger.error('\n\n\n [Chat UI] Failed to initialize chat', error);
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
      logger.info('\n\n\n [Chat UI] cleanup previous listener');
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
      logger.error('\n\n\n [Chat UI] Chat error state', chatError);
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
      logger.error('\n\n\n [Chat UI] Failed to load older messages', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [displayMessages, resolvedRoomId, currentRoomId, isLoadingMore, hasMore]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => sortMessagesAsc(displayMessages), [displayMessages]);

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

    logger.info('\n\n\n [Chat UI] sending message', {
      activeRoomId,
      resolvedCaseId,
      clientFirebaseId: auth.currentUser?.uid || user.uid,
      agentFirebaseId: agentInfo?.firebaseId || agentInfo?.id,
    });

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
        logger.error('\n\n\n [Chat UI] Failed to send message');
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
      logger.error('\n\n\n [Chat UI] Failed to send message', error);
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
      logger.error('\n\n\n [Chat UI] Error formatting timestamp', { timestamp, error });
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


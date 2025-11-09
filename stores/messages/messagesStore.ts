import { create } from 'zustand';
import { messagesService } from '../../lib/services/messagesService';
import { chatService, ChatMessage, Conversation } from '../../lib/services/chat';
import { logger } from '../../lib/utils/logger';
import type { Message } from '../../lib/types';

const EMAIL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const CONVERSATIONS_CACHE_TTL = 60 * 1000; // 1 minute

interface MessagesState {
  messages: Message[];
  emailInbox: Message[];
  emailSent: Message[];
  chatMessages: ChatMessage[];
  conversations: Conversation[];
  unreadChatTotal: number;
  unreadEmailTotal: number;
  isLoading: boolean;
  error: string | null;
  conversationsError: string | null;
  isConversationsLoading: boolean;
  currentConversationId: string | null;
  currentCaseId: string | null;
  currentRoomId: string | null;
  unsubscribeMessages: (() => void) | null;
  unsubscribeConversations: (() => void) | null;
  lastMessagesFetchedAt: number | null;
  lastConversationsFetchedAt: number | null;
  lastConversationsUserId: string | null;

  fetchMessages: (force?: boolean) => Promise<void>;
  refreshEmailSegments: () => void;
  fetchConversations: (userId: string, force?: boolean) => Promise<void>;
  subscribeToConversations: (userId: string) => () => void;
  loadChatMessages: (
    caseId: string,
    clientId?: string,
    agentId?: string
  ) => Promise<{
    roomId: string | null;
    messages: ChatMessage[];
    hasMore: boolean;
    totalCount: number;
  }>;
  loadOlderChatMessages: (
    caseId: string,
    beforeTimestamp: number,
    clientId?: string,
    agentId?: string
  ) => Promise<void>;
  sendChatMessage: (
    caseId: string,
    senderId: string,
    senderName: string,
    senderRole: 'CLIENT' | 'AGENT' | 'ADMIN',
    message: string,
    attachments?: ChatMessage['attachments'],
    clientId?: string,
    agentId?: string
  ) => Promise<boolean>;
  subscribeToChatMessages: (
    roomId: string,
    onNewMessage: (message: ChatMessage) => void,
    lastKnownTimestamp?: number
  ) => () => void;
  markChatAsRead: (roomId: string, userId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAsUnread: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setCurrentConversation: (conversationId: string | null, caseId?: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setConversationUnread: (roomId: string, unread: number) => void;
  clearError: () => void;
}

const segmentEmails = (messages: Message[]) => {
  const inbox: Message[] = [];
  const sent: Message[] = [];
  let unread = 0;

  messages.forEach((message) => {
    const isUnread = message.unread ?? !message.isRead;
    if (isUnread) {
      unread += 1;
    }
    const direction =
      message.direction ||
      ((message.role || '').toLowerCase() === 'sent' ? 'outgoing' : 'incoming');
    if (direction === 'outgoing') {
      sent.push(message);
      return;
    }
    inbox.push(message);
  });

  const sortBySentAt = (collection: Message[]) =>
    [...collection].sort((a, b) => {
      const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return timeB - timeA;
    });

  return {
    inbox: sortBySentAt(inbox),
    sent: sortBySentAt(sent),
    unread,
  };
};

const computeUnreadChatTotal = (conversations: Conversation[]) =>
  conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0);

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  emailInbox: [],
  emailSent: [],
  chatMessages: [],
  conversations: [],
  unreadChatTotal: 0,
  unreadEmailTotal: 0,
  isLoading: false,
  error: null,
  conversationsError: null,
  isConversationsLoading: false,
  currentConversationId: null,
  currentCaseId: null,
  currentRoomId: null,
  unsubscribeMessages: null,
  unsubscribeConversations: null,
  lastMessagesFetchedAt: null,
  lastConversationsFetchedAt: null,
  lastConversationsUserId: null,

  fetchMessages: async (force = false) => {
    const { lastMessagesFetchedAt, messages } = get();
    const now = Date.now();
    if (
      !force &&
      lastMessagesFetchedAt &&
      messages.length > 0 &&
      now - lastMessagesFetchedAt < EMAIL_CACHE_TTL
    ) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const [inboxMessages, sentMessages] = await Promise.all([
        messagesService.getEmails({ direction: 'incoming', page: 1, limit: 50 }),
        messagesService.getEmails({ direction: 'outgoing', page: 1, limit: 50 }),
      ]);

      const combined = [...inboxMessages, ...sentMessages].sort((a, b) => {
        const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return timeB - timeA;
      });

      const { inbox, sent, unread } = segmentEmails(combined);

      set({
        messages: combined,
        emailInbox: inbox,
        emailSent: sent,
        unreadEmailTotal: unread,
        isLoading: false,
        lastMessagesFetchedAt: Date.now(),
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to fetch messages';
      logger.error('Error fetching messages', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  refreshEmailSegments: () => {
    const { messages } = get();
    const { inbox, sent, unread } = segmentEmails(messages);
    set({
      emailInbox: inbox,
      emailSent: sent,
      unreadEmailTotal: unread,
    });
  },

  fetchConversations: async (userId: string, force = false) => {
    if (!userId) {
      const existing = get().unsubscribeConversations;
      if (existing) {
        existing();
      }
      set({
        conversations: [],
        unreadChatTotal: 0,
        unsubscribeConversations: null,
        lastConversationsFetchedAt: null,
        lastConversationsUserId: null,
      });
      return;
    }

    const {
      lastConversationsFetchedAt,
      lastConversationsUserId,
      conversations: existingConversations,
    } = get();
    const now = Date.now();

    if (
      !force &&
      lastConversationsFetchedAt &&
      lastConversationsUserId === userId &&
      existingConversations.length > 0 &&
      now - lastConversationsFetchedAt < CONVERSATIONS_CACHE_TTL
    ) {
      return;
    }

    set({ isConversationsLoading: true, conversationsError: null });
    try {
      const conversations = await chatService.loadConversations(userId);
      set({
        conversations,
        unreadChatTotal: computeUnreadChatTotal(conversations),
        isConversationsLoading: false,
        lastConversationsFetchedAt: Date.now(),
        lastConversationsUserId: userId,
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to load conversations';
      logger.error('Error loading conversations', error);
      set({
        conversationsError: message,
        isConversationsLoading: false,
      });
    }
  },

  subscribeToConversations: (userId: string) => {
    if (!userId) {
      return () => {};
    }

    const existing = get().unsubscribeConversations;
    if (existing) {
      existing();
    }

    const unsubscribe = chatService.subscribeToConversationSummaries(userId, (conversations) => {
      set({
        conversations,
        unreadChatTotal: computeUnreadChatTotal(conversations),
        conversationsError: null,
        lastConversationsFetchedAt: Date.now(),
        lastConversationsUserId: userId,
      });
    });

    set({ unsubscribeConversations: unsubscribe });
    return unsubscribe;
  },

  loadChatMessages: async (caseId: string, clientId?: string, agentId?: string) => {
    set({ isLoading: true, error: null, currentCaseId: caseId });
    try {
      const result = await chatService.loadInitialMessages(caseId, clientId, agentId);
      if (!result.roomId) {
        set({ chatMessages: [], currentRoomId: null, isLoading: false });
        return { roomId: null, messages: [], hasMore: false, totalCount: 0 };
      }
      set({
        chatMessages: result.messages,
        currentRoomId: result.roomId,
        isLoading: false,
      });
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load chat messages';
      logger.error('Error loading chat messages', error);
      set({ error: errorMessage, isLoading: false });
      return { roomId: null, messages: [], hasMore: false, totalCount: 0 };
    }
  },

  loadOlderChatMessages: async (caseId: string, beforeTimestamp: number, clientId?: string, agentId?: string) => {
    try {
      const roomId = get().currentRoomId || caseId;
      if (!roomId) {
        return;
      }
      const result = await chatService.loadOlderMessages(roomId, beforeTimestamp, 20);
      set((state) => {
        const existingIds = new Set(state.chatMessages.map((m) => m.id));
        const uniqueNew = result.messages.filter((m) => !existingIds.has(m.id));
        const combined = [...uniqueNew, ...state.chatMessages];
        return { chatMessages: combined.sort((a, b) => a.timestamp - b.timestamp) };
      });
    } catch (error: any) {
      logger.error('Error loading older chat messages', error);
    }
  },

  sendChatMessage: async (
    caseId: string,
    senderId: string,
    senderName: string,
    senderRole: 'CLIENT' | 'AGENT' | 'ADMIN',
    message: string,
    attachments?: ChatMessage['attachments'],
    clientId?: string,
    agentId?: string
  ) => {
    try {
      const roomId = get().currentRoomId || caseId;
      if (!roomId) {
        logger.warn('sendChatMessage aborted - no active chat room', { caseId });
        return false;
      }

      const success = await chatService.sendMessage(
        roomId,
        senderId,
        senderName,
        senderRole,
        message,
        attachments,
        clientId,
        agentId
      );
      return success;
    } catch (error: any) {
      logger.error('Error sending chat message', error);
      return false;
    }
  },

  subscribeToChatMessages: (roomId: string, onNewMessage: (message: ChatMessage) => void, lastKnownTimestamp?: number) => {
    const currentUnsubscribe = get().unsubscribeMessages;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }

    const unsubscribe = chatService.subscribeToNewMessagesOptimized(
      roomId,
      (newMessage) => {
        set((state) => {
          const exists = state.chatMessages.some(
            (m) => m.id === newMessage.id || m.tempId === newMessage.id
          );
          if (exists) {
            const tempIndex = state.chatMessages.findIndex(
              (m) => m.tempId && m.id === newMessage.id
            );
            if (tempIndex !== -1) {
              const updated = [...state.chatMessages];
              updated[tempIndex] = newMessage;
              return { chatMessages: updated.sort((a, b) => a.timestamp - b.timestamp) };
            }
            return state;
          }

          const updated = state.chatMessages
            .filter(
              (m) =>
                !(
                  m.tempId &&
                  m.message === newMessage.message &&
                  Math.abs(m.timestamp - newMessage.timestamp) < 5000
                )
            )
            .concat([newMessage])
            .sort((a, b) => a.timestamp - b.timestamp);

          return { chatMessages: updated };
        });

        onNewMessage(newMessage);
      },
      lastKnownTimestamp
    );

    set({ unsubscribeMessages: unsubscribe });
    return unsubscribe;
  },

  markChatAsRead: async (roomId: string, userId: string) => {
    try {
      const activeRoomId = roomId || get().currentRoomId;
      if (!activeRoomId) {
        return;
      }
      await chatService.markChatRoomAsRead(activeRoomId, userId);
      set((state) => {
        const updated = state.conversations.map((conversation) =>
          conversation.id === activeRoomId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        );
        return {
          conversations: updated,
          unreadChatTotal: computeUnreadChatTotal(updated),
        };
      });
    } catch (error: any) {
      logger.error('Error marking chat as read', error);
    }
  },

  markAsRead: async (messageId: string) => {
    try {
      await messagesService.markAsRead(messageId);
      set((state) => {
        const updateMessage = (message: Message) =>
          message.id === messageId
            ? {
                ...message,
                unread: false,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : message;
        const wasUnread =
          state.messages.some((m) => m.id === messageId && m.unread) ||
          state.emailInbox.some((m) => m.id === messageId && m.unread) ||
          state.emailSent.some((m) => m.id === messageId && m.unread);
        return {
          messages: state.messages.map(updateMessage),
          emailInbox: state.emailInbox.map(updateMessage),
          emailSent: state.emailSent.map(updateMessage),
          unreadEmailTotal: Math.max(0, state.unreadEmailTotal - (wasUnread ? 1 : 0)),
        };
      });
    } catch (error: any) {
      logger.error('Error marking message as read', error);
    }
  },

  markAsUnread: async (messageId: string) => {
    let backendError: any = null;
    try {
      await messagesService.markAsUnread(messageId);
    } catch (error) {
      backendError = error;
    }

    if (backendError) {
      logger.warn('Falling back to optimistic unread state', {
        messageId,
        error: backendError?.message,
      });
    }

    set((state) => {
      const updateMessage = (message: Message) =>
        message.id === messageId
          ? {
              ...message,
              unread: true,
              isRead: false,
              readAt: undefined,
            }
          : message;
      const wasUnread =
        state.messages.some((m) => m.id === messageId && m.unread) ||
        state.emailInbox.some((m) => m.id === messageId && m.unread) ||
        state.emailSent.some((m) => m.id === messageId && m.unread);
      return {
        messages: state.messages.map(updateMessage),
        emailInbox: state.emailInbox.map(updateMessage),
        emailSent: state.emailSent.map(updateMessage),
        unreadEmailTotal: wasUnread ? state.unreadEmailTotal : state.unreadEmailTotal + 1,
      };
    });
  },

  markAllAsRead: async () => {
    try {
      await messagesService.markAllAsRead();
      set((state) => ({
        messages: state.messages.map((m) => ({ ...m, unread: false })),
        emailInbox: state.emailInbox.map((m) => ({ ...m, unread: false })),
        emailSent: state.emailSent.map((m) => ({ ...m, unread: false })),
        unreadEmailTotal: 0,
      }));
    } catch (error: any) {
      logger.error('Error marking all messages as read', error);
    }
  },

  setCurrentConversation: (conversationId: string | null, caseId?: string | null) => {
    const currentUnsubscribe = get().unsubscribeMessages;
    if (!conversationId && currentUnsubscribe) {
      currentUnsubscribe();
    }

    set({
      currentConversationId: conversationId,
      currentCaseId: caseId || null,
      currentRoomId: conversationId,
    });
  },

  addChatMessage: (message: ChatMessage) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message].sort(
        (a, b) => a.timestamp - b.timestamp
      ),
    }));
  },

  setConversationUnread: (roomId: string, unread: number) => {
    set((state) => {
      const updated = state.conversations.map((conversation) =>
        conversation.id === roomId
          ? { ...conversation, unreadCount: unread }
          : conversation
      );
      return {
        conversations: updated,
        unreadChatTotal: computeUnreadChatTotal(updated),
      };
    });
  },

  clearError: () => {
    set({ error: null, conversationsError: null });
  },
}));


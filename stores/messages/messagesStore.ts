import { create } from 'zustand';
import { messagesService } from '../../lib/services/messagesService';
import { chatService, ChatMessage } from '../../lib/services/chat';
import { logger } from '../../lib/utils/logger';
import type { Message, CreateMessageRequest } from '../../lib/types';

interface MessagesState {
  messages: Message[]; // Email messages from API
  chatMessages: ChatMessage[]; // Chat messages from Firebase
  isLoading: boolean;
  error: string | null;
  currentConversationId: string | null;
  currentCaseId: string | null;
  currentRoomId: string | null;
  unsubscribeMessages: (() => void) | null;

  // Actions
  fetchMessages: () => Promise<void>;
  loadChatMessages: (caseId: string, clientId?: string, agentId?: string) => Promise<{ roomId: string | null; messages: ChatMessage[]; hasMore: boolean; totalCount: number }>;
  loadOlderChatMessages: (caseId: string, beforeTimestamp: number, clientId?: string, agentId?: string) => Promise<void>;
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
  subscribeToChatMessages: (roomId: string, onNewMessage: (message: ChatMessage) => void, lastKnownTimestamp?: number) => () => void;
  markChatAsRead: (caseId: string, userId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setCurrentConversation: (conversationId: string | null, caseId?: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearError: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  chatMessages: [],
  isLoading: false,
  error: null,
  currentConversationId: null,
  currentCaseId: null,
  currentRoomId: null,
  unsubscribeMessages: null,

  fetchMessages: async () => {
    set({ isLoading: true, error: null });
    try {
      const messages = await messagesService.getMessages();
      set({ messages, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch messages';
      logger.error('Error fetching messages', error);
      set({ error: errorMessage, isLoading: false });
    }
  },

  loadChatMessages: async (caseId: string, clientId?: string, agentId?: string) => {
    set({ isLoading: true, error: null, currentCaseId: caseId });
    try {
      const result = await chatService.loadInitialMessages(caseId, clientId, agentId);
      if (!result.roomId) {
        set({ chatMessages: [], currentRoomId: null, isLoading: false });
        return { roomId: null, messages: [], hasMore: false, totalCount: 0 };
      }
      set({ chatMessages: result.messages, currentRoomId: result.roomId, isLoading: false });
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
        const existingIds = new Set(state.chatMessages.map(m => m.id));
        const uniqueNew = result.messages.filter(m => !existingIds.has(m.id));
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
    // Unsubscribe from previous subscription if exists
    const currentUnsubscribe = get().unsubscribeMessages;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }

    const unsubscribe = chatService.subscribeToNewMessagesOptimized(roomId, (newMessage) => {
      set((state) => {
        // Check if message already exists (prevent duplicates)
        const exists = state.chatMessages.some(m => m.id === newMessage.id || m.tempId === newMessage.id);
        if (exists) {
          // If it's a temp message being replaced, remove the temp one
          const tempIndex = state.chatMessages.findIndex(m => m.tempId && m.id === newMessage.id);
          if (tempIndex !== -1) {
            const updated = [...state.chatMessages];
            updated[tempIndex] = newMessage;
            return { chatMessages: updated.sort((a, b) => a.timestamp - b.timestamp) };
          }
          return state;
        }

        // Remove any optimistic message with matching content
        const updated = state.chatMessages
          .filter(m => !(m.tempId && m.message === newMessage.message && Math.abs(m.timestamp - newMessage.timestamp) < 5000))
          .concat([newMessage])
          .sort((a, b) => a.timestamp - b.timestamp);

        return { chatMessages: updated };
      });

      onNewMessage(newMessage);
    }, lastKnownTimestamp);

    set({ unsubscribeMessages: unsubscribe });
    return unsubscribe;
  },

  markChatAsRead: async (caseId: string, userId: string) => {
    try {
      const roomId = get().currentRoomId || caseId;
      if (!roomId) {
        return;
      }
      await chatService.markChatRoomAsRead(roomId, userId);
    } catch (error: any) {
      logger.error('Error marking chat as read', error);
    }
  },

  markAsRead: async (messageId: string) => {
    try {
      await messagesService.markAsRead(messageId);
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, unread: false } : m
        ),
      }));
    } catch (error: any) {
      logger.error('Error marking message as read', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await messagesService.markAllAsRead();
      set((state) => ({
        messages: state.messages.map((m) => ({ ...m, unread: false })),
      }));
    } catch (error: any) {
      logger.error('Error marking all messages as read', error);
    }
  },

  setCurrentConversation: (conversationId: string | null, caseId?: string | null) => {
    // Unsubscribe from previous subscription
    const currentUnsubscribe = get().unsubscribeMessages;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }
    set({
      currentConversationId: conversationId,
      currentCaseId: caseId || null,
      currentRoomId: null,
      chatMessages: [],
      unsubscribeMessages: null
    });
  },

  addChatMessage: (message: ChatMessage) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));


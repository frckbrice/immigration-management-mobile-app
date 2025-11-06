import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import type { Message, ChatMessage, CreateMessageRequest } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const messagesService = {
  /**
   * Get all emails/messages list
   */
  async getMessages(page = 1, pageSize = 20, filters?: { caseId?: string; isRead?: boolean }): Promise<Message[]> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (filters?.caseId) params.append('caseId', filters.caseId);
      if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());

      const response = await apiClient.get<ApiResponse<{ emails: Message[] }>>(
        `/emails?${params.toString()}`
      );

      const messages = response.data.data?.emails || [];
      logger.info('Messages fetched successfully', { count: messages.length });
      return messages;
    } catch (error: any) {
      logger.error('Error fetching messages', error);
      throw error;
    }
  },

  /**
   * Get a single email/message by ID
   */
  async getMessageById(messageId: string): Promise<Message> {
    try {
      const response = await apiClient.get<ApiResponse<{ email: Message }>>(`/emails/${messageId}`);

      const message = response.data.data?.email;
      if (!message) {
        throw new Error(response.data.error || 'Message not found');
      }

      logger.info('Message fetched successfully', { messageId });
      return message;
    } catch (error: any) {
      logger.error('Error fetching message', error);
      throw error;
    }
  },

  /**
   * Get messages for a specific conversation (chat messages)
   * Note: Chat messages are handled by Firebase, not REST API
   * This method is kept for compatibility but should use chatService directly
   */
  async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      // Chat messages are handled by Firebase chatService
      // This method is kept for compatibility
      logger.info('Chat messages should use chatService.loadInitialMessages', { conversationId });
      return [];
    } catch (error: any) {
      logger.error('Error fetching conversation messages', error);
      throw error;
    }
  },

  /**
   * Send a new message
   * Note: Chat messages are handled by Firebase, not REST API
   * This method is kept for compatibility but should use chatService directly
   */
  async sendMessage(data: CreateMessageRequest): Promise<ChatMessage> {
    try {
      // Chat messages are handled by Firebase chatService
      // This method is kept for compatibility
      logger.info('Chat messages should use chatService.sendMessage', data);
      throw new Error('Use chatService.sendMessage for chat messages');
    } catch (error: any) {
      logger.error('Error sending message', error);
      throw error;
    }
  },

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>(`/emails/${encodeURIComponent(messageId)}`);
      logger.info('Message marked as read', { messageId });
    } catch (error: any) {
      logger.error('Error marking message as read', error);
      throw error;
    }
  },

  /**
   * Mark all messages as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>('/emails/mark-read', {
        emailIds: [], // Empty array marks all as read
      });
      logger.info('All messages marked as read');
    } catch (error: any) {
      logger.error('Error marking all messages as read', error);
      throw error;
    }
  },

  /**
   * Get unread messages count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.getMessages(1, 100, { isRead: false });
      return response.length;
    } catch (error: any) {
      logger.error('Error getting unread count', error);
      return 0;
    }
  },
};


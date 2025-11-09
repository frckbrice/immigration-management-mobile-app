import { apiClient } from '../api/axios';
import { logger } from '../utils/logger';
import { auth } from '../firebase/config';
import type {
  Message,
  ChatMessage,
  CreateMessageRequest,
  EmailAttachment,
  MessageDirection,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface EmailListResponse {
  emails: RawEmail[];
}

interface RawParticipant {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface RawCaseSummary {
  id?: string | null;
  referenceNumber?: string | null;
  serviceType?: string | null;
}

interface RawEmail {
  id: string;
  subject?: string | null;
  content?: string | null;
  preview?: string | null;
  isRead?: boolean;
  readAt?: string | null;
  sentAt?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  sender?: RawParticipant | null;
  recipient?: RawParticipant | null;
  caseId?: string | null;
  case?: RawCaseSummary | null;
  messageType?: string | null;
  emailThreadId?: string | null;
  threadId?: string | null;
  attachments?: EmailAttachment[] | null;
}

interface EmailListParams {
  page?: number;
  limit?: number;
  direction?: MessageDirection;
  isRead?: boolean;
  caseId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SendEmailPayload {
  caseId: string;
  subject: string;
  content: string;
  attachments?: EmailAttachment[];
  recipientId?: string;
}

interface EmailReplyPayload {
  threadId: string;
  senderId: string;
  content: string;
  subject?: string;
}

const formatDisplayName = (participant?: RawParticipant | null, fallback?: string) => {
  if (!participant) {
    return fallback || 'Unknown';
  }
  const parts = [participant.firstName, participant.lastName].filter(Boolean).join(' ').trim();
  if (parts.length > 0) {
    return parts;
  }
  if (participant.email) {
    return participant.email;
  }
  if (participant.id) {
    return participant.id;
  }
  return fallback || 'Unknown';
};

const stripHtml = (value?: string | null) => {
  if (!value) {
    return '';
  }
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const truncate = (value: string, max = 140) => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max).trim()}…`;
};

const formatListTime = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const resolveDirection = (email: RawEmail, explicit?: MessageDirection): MessageDirection => {
  if (explicit) {
    return explicit;
  }
  const currentUserId = auth.currentUser?.uid;
  if (currentUserId && email.recipientId === currentUserId) {
    return 'incoming';
  }
  return 'outgoing';
};

const normalizeAttachments = (attachments?: EmailAttachment[] | null): EmailAttachment[] => {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }
  return attachments
    .filter((item) => item && item.name && item.url)
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      type: item.type,
      size: item.size,
    }));
};

const mapEmailToMessage = (email: RawEmail, direction?: MessageDirection): Message => {
  const derivedDirection = resolveDirection(email, direction);
  const attachments = normalizeAttachments(email.attachments);
  const content = stripHtml(email.content || '');
  const preview = truncate(content || email.subject || '', 160);
  const subject = email.subject || '(No subject)';
  const displayName =
    derivedDirection === 'incoming'
      ? formatDisplayName(email.sender, 'Advisor')
      : formatDisplayName(email.recipient, 'Recipient');

  return {
    id: email.id,
    name: displayName,
    role: derivedDirection === 'incoming' ? 'Inbox' : 'Sent',
    message: preview || subject,
    time: formatListTime(email.sentAt),
    unread: !(email.isRead ?? true),
    online: false,
    userId: email.senderId || undefined,
    conversationId: email.caseId || undefined,
    subject,
    preview,
    content,
    direction: derivedDirection,
    senderId: email.senderId || undefined,
    recipientId: email.recipientId || undefined,
    caseId: email.caseId || undefined,
    caseReference: email.case?.referenceNumber || undefined,
    caseServiceType: email.case?.serviceType || undefined,
    threadId: email.threadId || email.emailThreadId || undefined,
    sentAt: email.sentAt || undefined,
    readAt: email.readAt || undefined,
    isRead: email.isRead,
    attachments,
  };
};

export const messagesService = {
  async getEmails(params: EmailListParams = {}): Promise<Message[]> {
    const searchParams = new URLSearchParams();
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    searchParams.set('page', page.toString());
    searchParams.set('limit', Math.min(limit, 100).toString());

    if (params.direction) {
      searchParams.set('direction', params.direction);
    }
    if (params.isRead !== undefined) {
      searchParams.set('isRead', params.isRead ? 'true' : 'false');
    }
    if (params.caseId) {
      searchParams.set('caseId', params.caseId);
    }
    if (params.search) {
      searchParams.set('search', params.search);
    }
    if (params.sortBy) {
      searchParams.set('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      searchParams.set('sortOrder', params.sortOrder);
    }

    try {
      const response = await apiClient.get<ApiResponse<EmailListResponse>>(
        `/emails?${searchParams.toString()}`
      );
      const rawEmails = response.data.data?.emails ?? [];
      logger.info('Emails fetched', {
        count: rawEmails.length,
        direction: params.direction,
        page,
      });
      return rawEmails.map((email) => mapEmailToMessage(email, params.direction));
    } catch (error: any) {
      logger.error('Error fetching emails', error);
      throw error;
    }
  },

  async getMessages(page = 1, pageSize = 20, filters?: { caseId?: string; isRead?: boolean }) {
    return this.getEmails({
      page,
      limit: pageSize,
      caseId: filters?.caseId,
      isRead: filters?.isRead,
    });
  },

  async getMessageById(messageId: string): Promise<Message> {
    try {
      const response = await apiClient.get<ApiResponse<{ email: RawEmail }>>(`/emails/${messageId}`);
      const email = response.data.data?.email;
      if (!email) {
        throw new Error(response.data.error || 'Message not found');
      }
      logger.info('Email fetched', { messageId });
      return mapEmailToMessage(email);
    } catch (error: any) {
      logger.error('Error fetching message', error);
      throw error;
    }
  },

  async sendEmail(payload: SendEmailPayload) {
    try {
      await apiClient.post('/emails/send', {
        caseId: payload.caseId,
        subject: payload.subject,
        content: payload.content,
        attachments: payload.attachments,
        ...(payload.recipientId ? { recipientId: payload.recipientId } : {}),
      });
      logger.info('Email sent', { caseId: payload.caseId });
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error?.response?.data || error.message,
      });
      throw error;
    }
  },

  async replyToEmail(payload: EmailReplyPayload) {
    try {
      await apiClient.post('/emails/incoming', {
        threadId: payload.threadId,
        senderId: payload.senderId,
        content: payload.content,
        ...(payload.subject ? { subject: payload.subject } : {}),
      });
      logger.info('Email reply sent', { threadId: payload.threadId });
    } catch (error: any) {
      logger.error('Failed to reply to email', {
        error: error?.response?.data || error.message,
      });
      throw error;
    }
  },

  async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      logger.info('Chat messages should use chatService.loadInitialMessages', { conversationId });
      return [];
    } catch (error: any) {
      logger.error('Error fetching conversation messages', error);
      throw error;
    }
  },

  async sendMessage(data: CreateMessageRequest): Promise<ChatMessage> {
    try {
      logger.info('Chat messages should use chatService.sendMessage', data);
      throw new Error('Use chatService.sendMessage for chat messages');
    } catch (error: any) {
      logger.error('Error sending message', error);
      throw error;
    }
  },

  async markAsRead(messageId: string): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>(`/emails/${encodeURIComponent(messageId)}`);
      logger.info('Message marked as read', { messageId });
    } catch (error: any) {
      logger.error('Error marking message as read', error);
      throw error;
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>('/emails/mark-read', {
        emailIds: [],
      });
      logger.info('All messages marked as read');
    } catch (error: any) {
      logger.error('Error marking all messages as read', error);
      throw error;
    }
  },

  async markAsUnread(messageId: string): Promise<void> {
    try {
      await apiClient.put<ApiResponse<void>>(`/emails/${encodeURIComponent(messageId)}`, {
        unread: true,
      });
      logger.info('Message marked as unread', { messageId });
    } catch (error: any) {
      logger.warn('Backend does not support mark-as-unread; falling back to local state', {
        messageId,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const unread = await this.getEmails({
        page: 1,
        limit: 100,
        direction: 'incoming',
        isRead: false,
      });
      return unread.length;
    } catch (error: any) {
      logger.error('Error getting unread count', error);
      return 0;
    }
  },
};


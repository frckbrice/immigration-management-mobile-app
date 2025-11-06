// Type definitions for the application

export interface Case {
  id: string;
  title: string;
  caseNumber: string;
  status: 'action-required' | 'approved' | 'pending' | 'in-review' | 'complete';
  progress: number;
  lastUpdated: string;
  createdAt: string;
  description?: string;
  type?: string;
  userId: string;
}

export interface Message {
  id: string;
  name: string;
  role: string;
  message: string;
  time: string;
  unread: boolean;
  online: boolean;
  userId?: string;
  conversationId?: string;
}

// ChatMessage is now defined in lib/services/chat.ts to match Firebase structure
// This interface is kept for backward compatibility but should use ChatMessage from chat service
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  conversationId?: string;
  userId?: string;
}

export interface Document {
  id: string;
  name: string;
  size: string;
  date: string;
  type: 'pdf' | 'doc' | 'image';
  url?: string;
  caseId?: string;
  userId?: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'action' | 'case-update' | 'appointment' | 'document';
  title: string;
  description: string;
  time: string;
  unread: boolean;
  badge?: string;
  badgeColor?: string;
  userId?: string;
  relatedId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  address?: string;
}

export interface CreateCaseRequest {
  title: string;
  type: string;
  description: string;
}

export interface CreateMessageRequest {
  text: string;
  conversationId?: string;
  recipientId?: string;
}

export interface UploadDocumentRequest {
  file: any;
  name: string;
  caseId?: string;
}


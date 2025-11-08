// Type definitions aligned with Patrick Travel backend APIs

export type CaseStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'DOCUMENTS_REQUIRED'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CaseClient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface CaseAssignedAgent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Case {
  id: string;
  referenceNumber: string;
  serviceType: string;
  status: CaseStatus;
  priority: Priority;
  submissionDate: string;
  lastUpdated: string;
  estimatedCompletion?: string | null;
  completedAt?: string | null;
  approvedAt?: string | null;
  destinationId?: string | null;
  client?: CaseClient;
  assignedAgent?: CaseAssignedAgent | null;
  /**
   * UI helpers (derived fields)
   */
  displayName: string;
  progress: number;
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

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Document {
  id: string;
  originalName: string;
  fileName: string;
  documentType: string;
  status: DocumentStatus;
  uploadDate: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  caseId: string;
  case?: {
    id: string;
    referenceNumber: string;
    serviceType: string;
  };
  uploadedById?: string;
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
  firstName?: string;
  lastName?: string;
  email: string;
  avatar?: string;
  phone?: string;
  address?: string;
}

export interface DashboardStats {
  totalCases?: number;
  activeCases?: number;
  completedCases?: number;
  pendingDocuments?: number;
  assignedCases?: number;
  unassignedCases?: number;
  totalDocuments?: number;
}

export interface CreateCaseRequest {
  serviceType: string;
  priority?: Priority;
}

export interface CreateMessageRequest {
  text: string;
  conversationId?: string;
  recipientId?: string;
}

export interface UploadDocumentRequest {
  caseId: string;
  documentType: string;
  fileName: string;
  originalName?: string;
  filePath: string;
  fileSize?: number;
  mimeType: string;
}

// Payments
export interface PaymentIntent {
  id: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled' | string;
  amount: number; // major units
  currency: string;
  description?: string;
  createdAt?: string;
  clientSecret?: string; // if you expose it for client confirmation flows
  metadata?: Record<string, any>;
}

export interface PaymentRecord {
  id: string;
  amount: number; // major units
  currency?: string;
  description: string;
  caseNumber?: string;
  date: string; // ISO or formatted by backend
  status: 'completed' | 'pending' | 'failed' | 'refunded' | string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | string;
  amount: number; // major units
  currency?: string;
  paymentIntentId: string;
  createdAt?: string;
}


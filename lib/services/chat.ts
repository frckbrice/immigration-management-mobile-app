import { database } from '../firebase/config';
import {
    ref,
    push,
    onValue,
    onChildAdded,
    off,
    query,
    orderByChild,
    set,
    update,
    get,
    limitToLast,
    endAt,
} from 'firebase/database';
import { logger } from '../utils/logger';

export interface ChatMessage {
    id: string;
    caseId: string;
    senderId: string;
    senderName: string;
    senderRole: 'CLIENT' | 'AGENT' | 'ADMIN';
    message: string;
    timestamp: number;
    isRead: boolean;
    attachments?: {
        name: string;
        url: string;
        type: string;
        size: number;
    }[];
    // Optimistic update states
    status?: 'pending' | 'sent' | 'failed';
    tempId?: string; // Temporary ID for optimistic messages
    error?: string; // Error message if failed
}

export interface ChatParticipants {
    clientId: string;
    clientName: string;
    agentId: string;
    agentName: string;
}

export interface CaseReference {
    caseId: string;
    caseReference: string;
    assignedAt: number;
}

export interface ChatMetadata {
    participants: ChatParticipants;
    caseReferences?: CaseReference[];
    createdAt: number;
    lastMessage: string | null;
    lastMessageTime: number | null;
    updatedAt?: number;
}

export interface Conversation {
    id: string;
    caseId: string;
    caseReference: string;
    lastMessage: string | null;
    lastMessageTime: number | null;
    unreadCount: number;
    participants: ChatParticipants;
}

/**
 * Generate deterministic chat room ID from client-agent pair
 * Always sorts IDs alphabetically to ensure consistency
 */
function getChatRoomId(clientId: string, agentId: string): string {
    const sorted = [clientId, agentId].sort();
    return `${sorted[0]}-${sorted[1]}`;
}

class ChatService {
    // Fetch chat metadata
    async getChatMetadata(roomId: string): Promise<ChatMetadata | null> {
        try {
            const metadataRef = ref(database, `chats/${roomId}/metadata`);
            const snap = await get(metadataRef);
            if (!snap.exists()) return null;
            const raw = snap.val();
            const metadata: ChatMetadata = {
                participants: raw.participants || {
                    clientId: '',
                    clientName: '',
                    agentId: '',
                    agentName: '',
                },
                caseReferences: raw.caseReferences || [],
                createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
                lastMessage: raw.lastMessage ?? null,
                lastMessageTime: raw.lastMessageTime ?? null,
                updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
            };
            return metadata;
        } catch (error) {
            logger.error('Failed to get chat metadata', error);
            return null;
        }
    }

    // Helper method to get chat room ID from client-agent pair
    getChatRoomIdFromPair(clientId: string, agentId: string): string {
        return getChatRoomId(clientId, agentId);
    }

    // Helper method to resolve chat room ID from caseId
    async resolveChatRoomIdFromCase(caseId: string, clientId?: string, agentId?: string): Promise<string | null> {
        try {
            // If we have both clientId and agentId, try new format first
            if (clientId && agentId) {
                const newRoomId = getChatRoomId(clientId, agentId);
                const newMetadataRef = ref(database, `chats/${newRoomId}/metadata`);
                const newMetadataSnap = await get(newMetadataRef);

                if (newMetadataSnap.exists()) {
                    const metadata = newMetadataSnap.val();
                    const caseRefs = metadata.caseReferences || [];
                    if (caseRefs.some((ref: CaseReference) => ref.caseId === caseId)) {
                        return newRoomId;
                    }
                }
            }

            // Fallback to old format (caseId as room ID)
            const oldMetadataRef = ref(database, `chats/${caseId}/metadata`);
            const oldMetadataSnap = await get(oldMetadataRef);
            if (oldMetadataSnap.exists()) {
                return caseId;
            }

            return null;
        } catch (error) {
            logger.error('Failed to resolve chat room ID from case', error);
            return null;
        }
    }

    // Send a message
    async sendMessage(
        caseIdOrRoomId: string,
        senderId: string,
        senderName: string,
        senderRole: 'CLIENT' | 'AGENT' | 'ADMIN',
        message: string,
        attachments?: ChatMessage['attachments'],
        clientId?: string,
        agentId?: string
    ): Promise<boolean> {
        try {
            // Determine the chat room ID
            let chatRoomId: string | null = null;

            // Try to resolve as new format (client-agent pair room ID) if clientId and agentId provided
            if (clientId && agentId) {
                const resolvedRoomId = await this.resolveChatRoomIdFromCase(caseIdOrRoomId, clientId, agentId);
                if (resolvedRoomId) {
                    chatRoomId = resolvedRoomId;
                } else {
                    // Room doesn't exist yet, create it using new format
                    chatRoomId = getChatRoomId(clientId, agentId);
                }
            } else {
                // Fallback: try old format (caseId as room ID)
                const caseMetadataRef = ref(database, `chats/${caseIdOrRoomId}/metadata`);
                const caseMetadataSnap = await get(caseMetadataRef);

                if (caseMetadataSnap.exists()) {
                    chatRoomId = caseIdOrRoomId;
                } else {
                    logger.warn('Cannot resolve chat room ID', { caseIdOrRoomId });
                    return false;
                }
            }

            const messagesRef = ref(database, `chats/${chatRoomId}/messages`);
            const newMessageRef = push(messagesRef);
            const messageId = newMessageRef.key!;

            const timestamp = Date.now();

            // Ensure metadata exists before writing message
            const metadataRef = ref(database, `chats/${chatRoomId}/metadata`);
            const existingMetadata = await get(metadataRef);

            // Get caseId from metadata if available, otherwise use the parameter
            let messageCaseId = caseIdOrRoomId;
            if (existingMetadata.exists()) {
                const metadata = existingMetadata.val();
                if (metadata.caseReferences && metadata.caseReferences.length > 0) {
                    messageCaseId = metadata.caseReferences[0].caseId;
                }
            }

            const messageData = {
                id: messageId,
                senderId,
                senderName,
                content: message,
                sentAt: timestamp,
                isRead: false,
                caseId: messageCaseId,
                attachments: attachments || [],
            };

            if (existingMetadata.exists()) {
                // Update metadata with new last message
                await update(metadataRef, {
                    lastMessage: message.substring(0, 100),
                    lastMessageTime: timestamp,
                });

                // Update userChats index for both participants
                const { agentId: metadataAgentId, clientId: metadataClientId } = existingMetadata.val().participants;
                if (metadataAgentId && metadataClientId) {
                    await Promise.all([
                        update(ref(database, `userChats/${metadataAgentId}/${chatRoomId}`), {
                            lastMessage: message.substring(0, 100),
                            lastMessageTime: timestamp,
                        }),
                        update(ref(database, `userChats/${metadataClientId}/${chatRoomId}`), {
                            lastMessage: message.substring(0, 100),
                            lastMessageTime: timestamp,
                        }),
                    ]);
                }
            }

            // Write the message
            await set(newMessageRef, messageData);

            logger.info('Message sent successfully', { caseIdOrRoomId, chatRoomId, messageId });
            return true;
        } catch (error) {
            logger.error('Failed to send message', error);
            return false;
        }
    }

    /**
     * Optimized Firebase subscription for NEW messages only
     * Listens only to new messages using child_added
     */
    subscribeToNewMessagesOptimized(
        chatRoomId: string,
        onNewMessage: (message: ChatMessage) => void,
        lastKnownTimestamp?: number
    ): () => void {
        const messagesRef = ref(database, `chats/${chatRoomId}/messages`);

        const unsubscribe = onChildAdded(
            messagesRef,
            (snapshot) => {
                const firebaseData = snapshot.val();
                if (!firebaseData || typeof firebaseData !== 'object') return;

                const timestamp = firebaseData.sentAt || firebaseData.timestamp || Date.now();

                // Only process messages newer than last known timestamp (if provided)
                if (lastKnownTimestamp && timestamp <= lastKnownTimestamp) {
                    return;
                }

                const mapped: ChatMessage = {
                    id: snapshot.key!,
                    caseId: firebaseData.caseId || '',
                    senderId: firebaseData.senderId || '',
                    senderName: firebaseData.senderName || 'Unknown',
                    senderRole: firebaseData.senderRole || 'CLIENT',
                    message: firebaseData.content || firebaseData.message || '',
                    timestamp,
                    isRead: firebaseData.isRead || false,
                    attachments: firebaseData.attachments || [],
                };

                logger.debug(
                    `[Firebase New Message] Received new message ${snapshot.key?.substring(0, 8)}... for room ${chatRoomId.substring(0, 8)}...`
                );

                onNewMessage(mapped);
            },
            (error) => {
                logger.error(
                    `[Firebase New Message] Error listening to new messages for room ${chatRoomId.substring(0, 8)}...`,
                    error
                );
            }
        );

        return () => off(messagesRef, 'child_added', unsubscribe);
    }

    // Load initial messages directly from Firebase
    async loadInitialMessages(caseIdOrRoomId: string, clientId?: string, agentId?: string): Promise<{
        messages: ChatMessage[];
        hasMore: boolean;
        totalCount: number;
    }> {
        try {
            logger.info('loadInitialMessages from Firebase', { caseIdOrRoomId, clientId, agentId });

            // Resolve the actual chat room ID
            let resolvedRoomId = caseIdOrRoomId;

            const parts = caseIdOrRoomId.split('-');
            const isAlreadyRoomId = parts.length === 2 && parts[0].length > 10 && parts[1].length > 10;

            if (isAlreadyRoomId) {
                resolvedRoomId = caseIdOrRoomId;
            } else if (clientId && agentId) {
                try {
                    const resolvedId = await this.resolveChatRoomIdFromCase(caseIdOrRoomId, clientId, agentId);
                    if (resolvedId) {
                        resolvedRoomId = resolvedId;
                    } else {
                        resolvedRoomId = getChatRoomId(clientId, agentId);
                    }
                } catch (error) {
                    logger.warn('Failed to resolve room ID, using caseId', { error, caseIdOrRoomId });
                    resolvedRoomId = caseIdOrRoomId;
                }
            }

            // Load from Firebase using optimized query
            const messagesRef = ref(database, `chats/${resolvedRoomId}/messages`);

            let messagesQuery;
            try {
                messagesQuery = query(
                    messagesRef,
                    orderByChild('sentAt'),
                    limitToLast(50) // Load ONLY last 50 messages for initial display
                );
            } catch (error: any) {
                logger.warn('Ordered query failed, using basic query with limit', { error: error.message });
                messagesQuery = query(messagesRef, limitToLast(50));
            }

            const snapshot = await get(messagesQuery);

            const messages: ChatMessage[] = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const firebaseData = childSnapshot.val();
                    if (!firebaseData || typeof firebaseData !== 'object') return;

                    const mappedMessage: ChatMessage = {
                        id: childSnapshot.key!,
                        caseId: firebaseData.caseId || '',
                        senderId: firebaseData.senderId || '',
                        senderName: firebaseData.senderName || 'Unknown',
                        senderRole: firebaseData.senderRole || 'CLIENT',
                        message: firebaseData.content || firebaseData.message || '',
                        timestamp: firebaseData.sentAt || firebaseData.timestamp || Date.now(),
                        isRead: firebaseData.isRead || false,
                        attachments: firebaseData.attachments || [],
                    };

                    messages.push(mappedMessage);
                });
            }

            // Sort chronologically (oldest → newest)
            messages.sort((a, b) => a.timestamp - b.timestamp);

            // Check if there are more messages
            let totalCount = messages.length;
            let hasMore = false;

            if (messages.length === 50) {
                try {
                    const oldestTimestamp = Math.min(...messages.map(m => m.timestamp));
                    const olderQuery = query(
                        messagesRef,
                        orderByChild('sentAt'),
                        endAt(oldestTimestamp - 1),
                        limitToLast(1)
                    );
                    const olderSnapshot = await get(olderQuery);
                    hasMore = olderSnapshot.exists();
                } catch (error) {
                    hasMore = true;
                }
            }

            logger.info('Initial messages loaded from Firebase', {
                caseIdOrRoomId,
                resolvedRoomId,
                count: messages.length,
                hasMore,
                totalCount
            });

            return {
                messages,
                hasMore,
                totalCount,
            };
        } catch (error) {
            logger.error('Error loading initial messages', error);
            return { messages: [], hasMore: false, totalCount: 0 };
        }
    }

    // Load older messages (pagination)
    async loadOlderMessages(
        caseId: string,
        beforeTimestamp: number,
        limit: number = 20,
        clientId?: string,
        agentId?: string
    ): Promise<{
        messages: ChatMessage[];
        hasMore: boolean;
    }> {
        try {
            // Resolve the actual chat room ID
            let resolvedRoomId = caseId;

            const parts = caseId.split('-');
            const isAlreadyRoomId = parts.length === 2 && parts[0].length > 10 && parts[1].length > 10;

            if (!isAlreadyRoomId && clientId && agentId) {
                try {
                    const resolvedId = await this.resolveChatRoomIdFromCase(caseId, clientId, agentId);
                    if (resolvedId) {
                        resolvedRoomId = resolvedId;
                    } else {
                        resolvedRoomId = getChatRoomId(clientId, agentId);
                    }
                } catch (error) {
                    logger.warn('Failed to resolve room ID, using caseId', { error, caseId });
                    resolvedRoomId = caseId;
                }
            }

            const messagesRef = ref(database, `chats/${resolvedRoomId}/messages`);

            let snapshot;
            try {
                const messagesQuery = query(
                    messagesRef,
                    orderByChild('sentAt'),
                    endAt(beforeTimestamp - 1),
                    limitToLast(limit)
                );
                snapshot = await get(messagesQuery);
            } catch (queryError: any) {
                logger.warn('Ordered query failed, falling back to full load', { caseId, resolvedRoomId, error: queryError.message });
                snapshot = await get(messagesRef);
            }

            const messages: ChatMessage[] = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const firebaseData = childSnapshot.val();
                    if (!firebaseData || typeof firebaseData !== 'object') return;

                    const mappedMessage: ChatMessage = {
                        id: childSnapshot.key!,
                        caseId: firebaseData.caseId || '',
                        senderId: firebaseData.senderId || '',
                        senderName: firebaseData.senderName || 'Unknown',
                        senderRole: firebaseData.senderRole || 'CLIENT',
                        message: firebaseData.content || firebaseData.message || '',
                        timestamp: firebaseData.sentAt || firebaseData.timestamp || Date.now(),
                        isRead: firebaseData.isRead || false,
                        attachments: firebaseData.attachments || [],
                    };

                    messages.push(mappedMessage);
                });
            }

            // Filter to strictly older than boundary and sort chronologically
            const filtered = messages
                .filter(m => m.timestamp < beforeTimestamp)
                .sort((a, b) => a.timestamp - b.timestamp);

            const resultMessages = filtered.slice(-limit);
            const hasMore = filtered.length >= limit;

            logger.info('Older messages loaded from Firebase', {
                caseId,
                resolvedRoomId,
                count: resultMessages.length,
                hasMore
            });

            return {
                messages: resultMessages,
                hasMore,
            };
        } catch (error) {
            logger.error('Error loading older messages', error);
            return { messages: [], hasMore: false };
        }
    }

    // Mark messages as read
    async markMessagesAsRead(caseId: string, userId: string): Promise<void> {
        try {
            const messagesRef = ref(database, `chats/${caseId}/messages`);
            const snapshot = await get(messagesRef);

            if (!snapshot.exists()) {
                logger.info('No messages found to mark as read', { caseId });
                return;
            }

            const updatePromises: Promise<void>[] = [];

            snapshot.forEach((msgSnap) => {
                const msg = msgSnap.val();
                if (msg.senderId !== userId && !msg.isRead) {
                    const messageRef = ref(database, `chats/${caseId}/messages/${msgSnap.key}`);
                    updatePromises.push(
                        update(messageRef, { isRead: true }).catch((err: any) => {
                            if (err.code !== 'PERMISSION_DENIED') {
                                logger.error(
                                    `Failed to mark message as read (caseId=${caseId}, messageId=${msgSnap.key}, userId=${userId})`,
                                    err
                                );
                            }
                        })
                    );
                }
            });

            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                logger.info('Messages marked as read', {
                    caseId,
                    userId,
                    count: updatePromises.length,
                });
            }
        } catch (error) {
            logger.error(`Failed to mark messages as read (caseId=${caseId}, userId=${userId})`, error);
        }
    }

    // Mark chat room as read
    async markChatRoomAsRead(caseId: string, userId: string): Promise<boolean> {
        try {
            logger.info('Marking chat room as read', { caseId, userId });
            await this.markMessagesAsRead(caseId, userId);
            logger.info('Chat room marked as read successfully', { caseId, userId });
            return true;
        } catch (error) {
            logger.error('Error marking chat room as read', error);
            return false;
        }
    }

    // Initialize a conversation for a case
    async initializeConversation(
        caseId: string,
        caseReference: string,
        clientId: string,
        clientName: string,
        agentId: string,
        agentName: string
    ): Promise<void> {
        try {
            // Use client-agent pair for room ID
            const chatRoomId = getChatRoomId(clientId, agentId);
            const conversationRef = ref(database, `chats/${chatRoomId}/metadata`);

            // Check if conversation already exists
            const snapshot = await get(conversationRef);

            if (snapshot.exists()) {
                // Chat room exists - add this case to the caseReferences array if not already present
                const existingData = snapshot.val();
                const caseRefs = existingData.caseReferences || [];

                const caseExists = caseRefs.some((ref: CaseReference) => ref.caseId === caseId);

                if (!caseExists) {
                    const updatedCaseRefs = [
                        ...caseRefs,
                        {
                            caseId,
                            caseReference,
                            assignedAt: Date.now(),
                        },
                    ];

                    await update(conversationRef, {
                        caseReferences: updatedCaseRefs,
                        updatedAt: Date.now(),
                    });

                    logger.info('Added case to existing chat room', {
                        caseId,
                        caseReference,
                        chatRoomId,
                        totalCases: updatedCaseRefs.length,
                    });
                }
            } else {
                // Create new conversation
                const chatMetadata: ChatMetadata = {
                    participants: {
                        clientId,
                        clientName,
                        agentId,
                        agentName,
                    },
                    caseReferences: [
                        {
                            caseId,
                            caseReference,
                            assignedAt: Date.now(),
                        },
                    ],
                    createdAt: Date.now(),
                    lastMessage: null,
                    lastMessageTime: null,
                };

                await set(conversationRef, chatMetadata);

                // Create userChats index entries
                await Promise.all([
                    set(ref(database, `userChats/${agentId}/${chatRoomId}`), {
                        chatId: chatRoomId,
                        participantName: clientName,
                        lastMessage: null,
                        lastMessageTime: null,
                    }),
                    set(ref(database, `userChats/${clientId}/${chatRoomId}`), {
                        chatId: chatRoomId,
                        participantName: agentName,
                        lastMessage: null,
                        lastMessageTime: null,
                    }),
                ]);

                logger.info('Firebase chat initialized', {
                    caseId,
                    caseReference,
                    chatRoomId,
                });
            }
        } catch (error) {
            logger.error('Failed to initialize conversation', error);
        }
    }
}

export const chatService = new ChatService();


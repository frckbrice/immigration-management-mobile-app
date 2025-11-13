import { database, getDatabaseInstance as getDbInstance } from '../firebase/config';
import { apiClient } from '../api/axios';
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

/**
 * Helper function to get database instance or return null if unavailable
 * This ensures type safety when database might be null
 * Uses getDbInstance from config which has retry logic
 * Returns null instead of throwing to allow graceful degradation
 */
function getDatabaseInstance(): ReturnType<typeof getDbInstance> {
    return getDbInstance();
}

class ChatService {

    private async fetchMessagesForRoom(
        roomId: string,
        limit: number = 50
    ): Promise<{
        roomId: string;
        messages: ChatMessage[];
        hasMore: boolean;
        totalCount: number;
    }> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database is not available, returning empty messages', { roomId });
                return { roomId, messages: [], hasMore: false, totalCount: 0 };
            }
            const messagesRef = ref(db, `chats/${roomId}/messages`);

            let messagesQuery;
            try {
                messagesQuery = query(messagesRef, orderByChild('sentAt'), limitToLast(limit));
            } catch (error: any) {
                logger.warn('Ordered query failed, using basic query with limit', { roomId, error: error.message });
                messagesQuery = query(messagesRef, limitToLast(limit));
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

            messages.sort((a, b) => a.timestamp - b.timestamp);

            const totalCount = messages.length;
            let hasMore = false;

            if (messages.length === limit) {
                try {
                    const oldestTimestamp = Math.min(...messages.map((m) => m.timestamp));
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

            return {
                roomId,
                messages,
                hasMore,
                totalCount,
            };
        } catch (error) {
            logger.error('Error fetching messages for room', { roomId, error });
            return { roomId, messages: [], hasMore: false, totalCount: 0 };
        }
    }

    async loadMessagesForRoom(
        roomId: string,
        limit: number = 50
    ): Promise<{
        roomId: string;
        messages: ChatMessage[];
        hasMore: boolean;
        totalCount: number;
    }> {
        if (!roomId) {
            return { roomId, messages: [], hasMore: false, totalCount: 0 };
        }
        return this.fetchMessagesForRoom(roomId, limit);
    }

    /**
     * Resolve the Firebase UID associated with a backend (PostgreSQL) user ID.
     * If the identifier already looks like a Firebase UID, it is returned as-is.
     */
    async resolveFirebaseUserId(userId: string): Promise<string | null> {
        try {
            if (!userId) {
                return null;
            }

            const looksLikeFirebaseUid = userId.length > 0 && userId.length < 40 && !userId.includes('-');
            if (looksLikeFirebaseUid) {
                return userId;
            }

            const response = await apiClient.get<{ data?: { firebaseId?: string } }>(`/users/${userId}/firebase-uid`);
            const firebaseId = response.data?.data?.firebaseId;
            if (firebaseId) {
                return firebaseId;
            }

            logger.warn('Unable to resolve Firebase UID from backend identifier', { userId });
            return null;
        } catch (error: any) {
            logger.error('Failed to resolve Firebase UID', { userId, error: error?.message });
            return null;
        }
    }

    private mapConversationFromMetadata(
        roomId: string,
        metadata: ChatMetadata | null,
        unreadCount: number
    ): Conversation | null {
        if (!metadata) {
            return null;
        }

        const primaryCase = metadata.caseReferences && metadata.caseReferences.length > 0
            ? metadata.caseReferences[0]
            : undefined;

        const caseId = primaryCase?.caseId ?? roomId;
        const caseReference = primaryCase?.caseReference ?? primaryCase?.caseId ?? roomId;

        return {
            id: roomId,
            caseId,
            caseReference,
            lastMessage: metadata.lastMessage,
            lastMessageTime: metadata.lastMessageTime,
            unreadCount,
            participants: metadata.participants,
        };
    }

    private async computeUnreadCount(roomId: string, userId: string): Promise<number> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                return 0;
            }
            const messagesRef = ref(db, `chats/${roomId}/messages`);
            const snapshot = await get(messagesRef);

            if (!snapshot.exists()) {
                return 0;
            }

            let count = 0;
            snapshot.forEach((childSnap) => {
                const message = childSnap.val();
                if (message && !message.isRead && message.senderId !== userId) {
                    count += 1;
                }
            });
            return count;
        } catch (error) {
            logger.error('Failed to compute unread count for conversation', { roomId, error });
            return 0;
        }
    }

    // Fetch chat metadata
    async getChatMetadata(roomId: string): Promise<ChatMetadata | null> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                return null;
            }
            const metadataRef = ref(db, `chats/${roomId}/metadata`);
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

    async loadConversations(userId: string): Promise<Conversation[]> {
        try {
            if (!userId) {
                return [];
            }

            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, returning empty conversations list', { userId });
                return [];
            }

            const userChatsRef = ref(db, `userChats/${userId}`);
            const snapshot = await get(userChatsRef);

            if (!snapshot.exists()) {
                return [];
            }

            const chatIds = Object.keys(snapshot.val() || {});
            if (chatIds.length === 0) {
                return [];
            }

            const conversations = await Promise.all(
                chatIds.map(async (chatId) => {
                    const [metadata, unreadCount] = await Promise.all([
                        this.getChatMetadata(chatId),
                        this.computeUnreadCount(chatId, userId),
                    ]);
                    return this.mapConversationFromMetadata(chatId, metadata, unreadCount);
                })
            );

            const filtered = conversations.filter((conv): conv is Conversation => conv !== null);
            filtered.sort((a, b) => {
                const timeA = a.lastMessageTime ?? 0;
                const timeB = b.lastMessageTime ?? 0;
                return timeB - timeA;
            });

            return filtered;
        } catch (error) {
            logger.error('Failed to load conversations for user', { userId, error });
            return [];
        }
    }

    subscribeToConversationSummaries(
        userId: string,
        callback: (conversations: Conversation[]) => void
    ): () => void {
        if (!userId) {
            callback([]);
            return () => { };
        }

        const db = getDatabaseInstance();
        if (!db) {
            logger.warn('Database not available, returning empty conversations subscription', { userId });
            callback([]);
            return () => { };
        }

        const userChatsRef = ref(db, `userChats/${userId}`);

        const listener = onValue(
            userChatsRef,
            async () => {
                const conversations = await this.loadConversations(userId);
                callback(conversations);
            },
            (error) => {
                logger.error('Conversation subscription error', { userId, error });
            }
        );

        return () => {
            off(userChatsRef, 'value', listener);
        };
    }

    // Helper method to resolve chat room ID from caseId
    async resolveChatRoomIdFromCase(caseId: string, clientId?: string, agentId?: string): Promise<string | null> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                return null;
            }

            // If we have both clientId and agentId, try new format first
            if (clientId && agentId) {
                const newRoomId = getChatRoomId(clientId, agentId);
                const newMetadataRef = ref(db, `chats/${newRoomId}/metadata`);
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
            const oldMetadataRef = ref(db, `chats/${caseId}/metadata`);
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

    async findRoomIdForCase(clientId: string, caseId: string): Promise<string | null> {
        try {
            if (!clientId || !caseId) {
                return null;
            }

            const db = getDatabaseInstance();
            if (!db) {
                return null;
            }
            const userChatsRef = ref(db, `userChats/${clientId}`);
            const snapshot = await get(userChatsRef);
            if (!snapshot.exists()) {
                return null;
            }

            const roomIds = Object.keys(snapshot.val() ?? {});
            for (const roomId of roomIds) {
                const metadata = await this.getChatMetadata(roomId);
                if (!metadata) {
                    continue;
                }

                if (metadata.caseReferences && metadata.caseReferences.length > 0) {
                    const match = metadata.caseReferences.some((ref) => ref.caseId === caseId);
                    if (match) {
                        return roomId;
                    }
                }
            }

            return null;
        } catch (error) {
            logger.warn('Failed to locate room id from userChats', { clientId, caseId, error });
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
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, cannot send message', { caseIdOrRoomId, senderId });
                return false;
            }

            // Determine the chat room ID
            let chatRoomId: string | null = null;

            if (clientId && agentId) {
                chatRoomId = await this.resolveChatRoomIdFromCase(caseIdOrRoomId, clientId, agentId);
            } else {
                const caseMetadataRef = ref(db, `chats/${caseIdOrRoomId}/metadata`);
                const caseMetadataSnap = await get(caseMetadataRef);
                if (caseMetadataSnap.exists()) {
                    chatRoomId = caseIdOrRoomId;
                }
            }

            if (!chatRoomId) {
                logger.warn('sendMessage aborted - chat room does not exist', {
                    caseIdOrRoomId,
                    senderId,
                });
                return false;
            }

            const messagesRef = ref(db, `chats/${chatRoomId}/messages`);
            const newMessageRef = push(messagesRef);
            const messageId = newMessageRef.key!;

            const timestamp = Date.now();

            // Ensure metadata exists before writing message
            const metadataRef = ref(db, `chats/${chatRoomId}/metadata`);
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
                        update(ref(db, `userChats/${metadataAgentId}/${chatRoomId}`), {
                            lastMessage: message.substring(0, 100),
                            lastMessageTime: timestamp,
                        }),
                        update(ref(db, `userChats/${metadataClientId}/${chatRoomId}`), {
                            lastMessage: message.substring(0, 100),
                            lastMessageTime: timestamp,
                        }),
                    ]);
                }
            }

            // Write the message
            await set(newMessageRef, messageData);

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
        const db = getDatabaseInstance();
        if (!db) {
            logger.warn('Database not available, returning no-op subscription', { chatRoomId });
            return () => { };
        }
        const messagesRef = ref(db, `chats/${chatRoomId}/messages`);

        const unsubscribe = onChildAdded(
            messagesRef,
            (snapshot) => {
                const firebaseData = snapshot.val();
                if (!firebaseData || typeof firebaseData !== 'object') {
                    return;
                }

                const timestamp = firebaseData.sentAt || firebaseData.timestamp || Date.now();

                // Only process messages newer than last known timestamp (if provided)
                if (lastKnownTimestamp && timestamp < lastKnownTimestamp) {
                    logger.debug('\n\n\n [Chat Service] Skipping message - timestamp is older than last known timestamp', { timestamp, lastKnownTimestamp });
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


                onNewMessage(mapped);
            },
            (error) => {
                logger.error(
                    `[Firebase New Message] Error listening to new messages for room ${chatRoomId.substring(0, 8)}...`,
                    error
                );
            }
        );

        return unsubscribe;
    }

    // Load initial messages directly from Firebase
    async loadInitialMessages(caseId: string, clientId?: string, agentId?: string): Promise<{
        roomId: string | null;
        messages: ChatMessage[];
        hasMore: boolean;
        totalCount: number;
    }> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, returning empty messages', { caseId });
                return { roomId: null, messages: [], hasMore: false, totalCount: 0 };
            }

            logger.info('loadInitialMessages from Firebase', { caseId, clientId, agentId });

            // Determine existing room ID (prefer client-agent pair, then derived, fallback to caseId)
            let resolvedRoomId: string | null = null;

            // Prefer explicit client-agent pair
            if (clientId && agentId) {
                const pairRoomId = getChatRoomId(clientId, agentId);

                const pairMetadataRef = ref(db, `chats/${pairRoomId}/metadata`);
                const pairMetadataSnap = await get(pairMetadataRef);
                if (pairMetadataSnap.exists()) {
                    resolvedRoomId = pairRoomId;
                } else {
                    const pairMessagesRef = ref(db, `chats/${pairRoomId}/messages`);
                    const pairMessagesSnap = await get(pairMessagesRef);
                    if (pairMessagesSnap.exists()) {
                        resolvedRoomId = pairRoomId;
                    }
                }

                if (!resolvedRoomId) {
                    const resolvedFromCase = await this.resolveChatRoomIdFromCase(caseId, clientId, agentId);
                    logger.debug('\n\n\n [Chat Service] resolvedFromCase', { resolvedFromCase });
                    if (resolvedFromCase) {
                        const derivedMetadataRef = ref(db, `chats/${resolvedFromCase}/metadata`);
                        const derivedMetadataSnap = await get(derivedMetadataRef);
                        logger.debug('\n\n\n [Chat Service] derivedMetadataSnap', { derivedMetadataSnap });
                        if (derivedMetadataSnap.exists()) {
                            resolvedRoomId = resolvedFromCase;
                        } else {
                            const derivedMessagesRef = ref(db, `chats/${resolvedFromCase}/messages`);
                            const derivedMessagesSnap = await get(derivedMessagesRef);
                            logger.debug('\n\n\n [Chat Service] derivedMessagesSnap', { derivedMessagesSnap });
                            if (derivedMessagesSnap.exists()) {
                                resolvedRoomId = resolvedFromCase;
                            }
                        }
                    }
                }
            }

            if (!resolvedRoomId) {
                const legacyMetadataRef = ref(db, `chats/${caseId}/metadata`);
                const legacyMetadataSnap = await get(legacyMetadataRef);
                if (legacyMetadataSnap.exists()) {
                    logger.debug('\n\n\n [Chat Service] legacyMetadataSnap exists', { legacyMetadataSnap });
                    resolvedRoomId = caseId;
                } else {
                    const legacyMessagesRef = ref(db, `chats/${caseId}/messages`);
                    const legacyMessagesSnap = await get(legacyMessagesRef);
                    logger.debug('\n\n\n [Chat Service] legacyMessagesSnap', { legacyMessagesSnap });
                    if (legacyMessagesSnap.exists()) {
                        logger.debug('\n\n\n [Chat Service] legacyMessagesSnap exists', { legacyMessagesSnap });
                        resolvedRoomId = caseId;
                    }
                }
            }

            if (!resolvedRoomId) {
                logger.info('\n\n\n [Chat Service] No existing chat room found for case', { caseId });
                return {
                    roomId: null,
                    messages: [],
                    hasMore: false,
                    totalCount: 0,
                };
            }

            const result = await this.fetchMessagesForRoom(resolvedRoomId, 50);

            logger.info('\n\n\n [Chat Service] Initial messages loaded from Firebase', {
                caseId,
                resolvedRoomId,
                count: result.messages.length,
                hasMore: result.hasMore,
                totalCount: result.totalCount
            });

            return result;
        } catch (error) {
            logger.error('\n\n\n [Chat Service] Error loading initial messages', error);
            return { roomId: null, messages: [], hasMore: false, totalCount: 0 };
        }
    }

    // Load older messages (pagination)
    async loadOlderMessages(
        roomId: string,
        beforeTimestamp: number,
        limit: number = 20
    ): Promise<{
        messages: ChatMessage[];
        hasMore: boolean;
    }> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, returning empty messages', { roomId });
                return { messages: [], hasMore: false };
            }
            const messagesRef = ref(db, `chats/${roomId}/messages`);

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
                logger.warn('\n\n\n [Chat Service] Ordered query failed, falling back to full load', { caseId: roomId, resolvedRoomId: roomId, error: queryError.message });
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

            logger.info('\n\n\n [Chat Service] Older messages loaded from Firebase', {
                roomId,
                count: resultMessages.length,
                hasMore
            });

            return {
                messages: resultMessages,
                hasMore,
            };
        } catch (error) {
            logger.error('\n\n\n [Chat Service] Error loading older messages', error);
            return { messages: [], hasMore: false };
        }
    }

    // Mark messages as read
    async markMessagesAsRead(roomId: string, userId: string): Promise<void> {
        try {
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, cannot mark messages as read', { roomId, userId });
                return;
            }
            const messagesRef = ref(db, `chats/${roomId}/messages`);
            const snapshot = await get(messagesRef);

            if (!snapshot.exists()) {
                logger.info('\n\n\n [Chat Service] No messages found to mark as read', { roomId });
                return;
            }

            const updatePromises: Promise<void>[] = [];

            snapshot.forEach((msgSnap) => {
                const msg = msgSnap.val();
                if (msg.senderId !== userId && !msg.isRead) {
                    const messageRef = ref(db, `chats/${roomId}/messages/${msgSnap.key}`);
                    updatePromises.push(
                        update(messageRef, { isRead: true }).catch((err: any) => {
                            if (err.code !== 'PERMISSION_DENIED') {
                                logger.error(
                                    `Failed to mark message as read (roomId=${roomId}, messageId=${msgSnap.key}, userId=${userId})`,
                                    err
                                );
                            }
                        })
                    );
                }
            });

            await Promise.all(updatePromises);

            const userChatRef = ref(db, `userChats/${userId}/${roomId}`);
            try {
                await update(userChatRef, { unreadCount: 0 });
            } catch (updateError: any) {
                if (updateError?.code !== 'PERMISSION_DENIED') {
                    logger.warn('\n\n\n [Chat Service] Failed to reset unread count in userChats', {
                        roomId,
                        userId,
                        error: updateError?.message,
                    });
                }
            }

            logger.info('\n\n\n [Chat Service] Messages marked as read', {
                roomId,
                userId,
                count: updatePromises.length,
            });
        } catch (error) {
            logger.error(`\n\n\n [Chat Service] Failed to mark messages as read (roomId=${roomId}, userId=${userId})`, error);
        }
    }

    // Mark chat room as read
    async markChatRoomAsRead(roomId: string, userId: string): Promise<boolean> {
        try {
            logger.info('\n\n\n [Chat Service] Marking chat room as read', { roomId, userId });
            await this.markMessagesAsRead(roomId, userId);
            logger.info('Chat room marked as read successfully', { roomId, userId });
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
            const db = getDatabaseInstance();
            if (!db) {
                logger.warn('Database not available, cannot initialize conversation', { caseId, clientId, agentId });
                return;
            }
            // Use client-agent pair for room ID
            const chatRoomId = getChatRoomId(clientId, agentId);
            const conversationRef = ref(db, `chats/${chatRoomId}/metadata`);

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
                    set(ref(db, `userChats/${agentId}/${chatRoomId}`), {
                        chatId: chatRoomId,
                        participantName: clientName,
                        lastMessage: null,
                        lastMessageTime: null,
                    }),
                    set(ref(db, `userChats/${clientId}/${chatRoomId}`), {
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


import { ChatMessage } from '@/lib/services/chat';

const sortAsc = (messages: ChatMessage[]) =>
    [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

const shouldMatchPending = (
    optimistic: ChatMessage,
    incoming: ChatMessage,
    dedupeWindowMs: number
) => {
    if (!optimistic.tempId) {
        return false;
    }

    const sameSender =
        !optimistic.senderId ||
        !incoming.senderId ||
        optimistic.senderId === incoming.senderId;

    if (!sameSender) {
        return false;
    }

    const sameMessage = (optimistic.message || '') === (incoming.message || '');
    if (!sameMessage) {
        return false;
    }

    const sameAttachmentCount =
        (optimistic.attachments?.length || 0) === (incoming.attachments?.length || 0);

    if (!sameAttachmentCount) {
        return false;
    }

    const timestampDiff = Math.abs((optimistic.timestamp || 0) - (incoming.timestamp || 0));
    return timestampDiff < dedupeWindowMs;
};

export const mergeMessageIntoList = (
    messages: ChatMessage[],
    newMessage: ChatMessage,
    dedupeWindowMs = 60_000
): ChatMessage[] => {
    if (!messages || messages.length === 0) {
        return sortAsc([newMessage]);
    }

    const existingIndex = messages.findIndex(
        (m) =>
            m.id === newMessage.id ||
            (newMessage.id && m.tempId === newMessage.id) ||
            (m.tempId && newMessage.tempId && m.tempId === newMessage.tempId) ||
            (newMessage.tempId && m.id === newMessage.tempId)
    );

    if (existingIndex !== -1) {
        const updated = [...messages];
        updated[existingIndex] = newMessage;
        return sortAsc(updated);
    }

    const pendingMatchIndex = messages.findIndex((m) =>
        shouldMatchPending(m, newMessage, dedupeWindowMs)
    );

    if (pendingMatchIndex !== -1) {
        const updated = [...messages];
        updated[pendingMatchIndex] = {
            ...newMessage,
            status: newMessage.status ?? 'sent',
        };
        return sortAsc(updated);
    }

    const filtered = messages.filter(
        (m) =>
            !(
                m.tempId &&
                newMessage.tempId &&
                m.tempId === newMessage.tempId &&
                Math.abs((m.timestamp || 0) - (newMessage.timestamp || 0)) < dedupeWindowMs
            )
    );

    return sortAsc([...filtered, newMessage]);
};

export const mergeMessagesBatch = (
    messages: ChatMessage[],
    incoming: ChatMessage[],
    dedupeWindowMs = 60_000
) => {
    if (!incoming || incoming.length === 0) {
        return messages;
    }

    return incoming.reduce(
        (acc, message) => mergeMessageIntoList(acc, message, dedupeWindowMs),
        messages
    );
};

export const sortMessagesAsc = sortAsc;


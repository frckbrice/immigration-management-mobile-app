import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { auth } from '@/lib/firebase/config';
import { presenceService } from '@/lib/services/presenceService';
import { logger } from '@/lib/utils/logger';

const DEFAULT_TYPING_IDLE_MS = 4500;

type ParticipantOptions = {
    roomId: string | null | undefined;
    peerId: string | null | undefined;
    currentUserId?: string | null;
    enabled?: boolean;
    typingIdleMs?: number;
};

type ParticipantPresence = {
    isPeerOnline: boolean;
    isPeerTyping: boolean;
    typingUsers: string[];
    announceTyping: (isTyping: boolean) => void;
    forceResetTyping: () => void;
};

const normalizeId = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const useRealtimeChatParticipant = ({
    roomId,
    peerId,
    currentUserId,
    enabled = true,
    typingIdleMs = DEFAULT_TYPING_IDLE_MS,
}: ParticipantOptions): ParticipantPresence => {
    const activeRoomId = normalizeId(roomId);
    const activePeerId = normalizeId(peerId);
    const selfId = normalizeId(currentUserId) ?? normalizeId(auth.currentUser?.uid) ?? null;

    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const latestRoomRef = useRef<string | null>(activeRoomId);

    useEffect(() => {
        if (!enabled) {
            latestRoomRef.current = activeRoomId;
            return;
        }

        if (latestRoomRef.current && latestRoomRef.current !== activeRoomId && isTypingRef.current) {
            try {
                presenceService.setTyping(latestRoomRef.current, false);
            } catch (error) {
                logger.warn('Failed to reset typing state for previous room', { error });
            } finally {
                isTypingRef.current = false;
            }
        }

        latestRoomRef.current = activeRoomId;
    }, [activeRoomId, enabled]);

    useEffect(() => {
        if (!enabled || !activePeerId) {
            setIsPeerOnline(false);
            return () => undefined;
        }

        return presenceService.subscribeToUserPresence(activePeerId, (state) => {
            setIsPeerOnline(state === 'online');
        });
    }, [activePeerId, enabled]);

    useEffect(() => {
        if (!enabled || !activeRoomId) {
            setTypingUsers([]);
            return () => undefined;
        }

        presenceService.registerTypingOnDisconnect(activeRoomId);

        return presenceService.subscribeToTyping(activeRoomId, (typingMap) => {
            try {
                const keys = Object.keys(typingMap || {});
                setTypingUsers(keys.filter((key) => Boolean(typingMap[key])));
            } catch (error) {
                logger.warn('Failed to parse typing map', { error });
            }
        });
    }, [activeRoomId, enabled]);

    const stopTyping = useCallback(() => {
        if (!enabled || !latestRoomRef.current) {
            return;
        }

        if (typingIdleRef.current) {
            clearTimeout(typingIdleRef.current);
            typingIdleRef.current = null;
        }

        if (isTypingRef.current) {
            presenceService.setTyping(latestRoomRef.current, false);
            isTypingRef.current = false;
        }
    }, [enabled]);

    const announceTyping = useCallback(
        (isTyping: boolean) => {
            if (!enabled || !latestRoomRef.current) {
                return;
            }

            if (!isTyping) {
                stopTyping();
                return;
            }

            if (typingIdleRef.current) {
                clearTimeout(typingIdleRef.current);
            }

            if (!isTypingRef.current) {
                presenceService.setTyping(latestRoomRef.current, true);
                isTypingRef.current = true;
            }

            typingIdleRef.current = setTimeout(() => {
                presenceService.setTyping(latestRoomRef.current!, false);
                isTypingRef.current = false;
                typingIdleRef.current = null;
            }, typingIdleMs);
        },
        [enabled, stopTyping, typingIdleMs],
    );

    useEffect(() => () => stopTyping(), [stopTyping]);

    const isPeerTyping = useMemo(() => {
        if (typingUsers.length === 0) {
            return false;
        }
        return typingUsers.some((id) => id && id !== selfId);
    }, [selfId, typingUsers]);

    return {
        isPeerOnline,
        isPeerTyping,
        typingUsers,
        announceTyping,
        forceResetTyping: stopTyping,
    };
};



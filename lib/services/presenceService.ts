import { onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from 'firebase/auth';
import {
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp,
  remove,
  DatabaseReference,
  Unsubscribe,
} from 'firebase/database';

import { auth, database } from '@/lib/firebase/config';
import { logger } from '@/lib/utils/logger';

type PresenceState = 'online' | 'offline';

const OFFLINE_STATUS = {
  state: 'offline' as PresenceState,
  last_changed: serverTimestamp(),
};

const ONLINE_STATUS = {
  state: 'online' as PresenceState,
  last_changed: serverTimestamp(),
};

let initialized = false;
let authUnsubscribe: AuthUnsubscribe | null = null;
let connectionUnsubscribe: Unsubscribe | null = null;
let activeStatusRef: DatabaseReference | null = null;

const cleanupConnectionListener = () => {
  if (connectionUnsubscribe) {
    try {
      connectionUnsubscribe();
    } catch (error) {
      logger.warn('Failed to detach Firebase connection listener', error);
    } finally {
      connectionUnsubscribe = null;
    }
  }
};

const markCurrentUserOffline = () => {
  if (!activeStatusRef) {
    return;
  }

  set(activeStatusRef, {
    state: 'offline',
    last_changed: serverTimestamp(),
  }).catch((error) => {
    logger.warn('Failed to mark user offline during cleanup', error);
  });
};

export const presenceService = {
  initializePresenceTracking(): () => void {
    if (initialized) {
      return () => {
        // noop for repeated initializations
      };
    }

    initialized = true;

    authUnsubscribe = onAuthStateChanged(auth, (user) => {
      cleanupConnectionListener();

      if (!user) {
        markCurrentUserOffline();
        activeStatusRef = null;
        return;
      }

      const userStatusRef = ref(database, `status/${user.uid}`);
      const connectedRef = ref(database, '.info/connected');

      connectionUnsubscribe = onValue(connectedRef, (snapshot) => {
        if (!snapshot.val()) {
          return;
        }

        onDisconnect(userStatusRef)
          .set(OFFLINE_STATUS)
          .catch((error) => {
            logger.warn('Failed to register onDisconnect handler for presence', error);
          })
          .then(() =>
            set(userStatusRef, ONLINE_STATUS).catch((error) => {
              logger.warn('Failed to mark user online', error);
            })
          );
      });

      activeStatusRef = userStatusRef;
    });

    return () => {
      cleanupConnectionListener();
      if (authUnsubscribe) {
        authUnsubscribe();
        authUnsubscribe = null;
      }
      markCurrentUserOffline();
      activeStatusRef = null;
      initialized = false;
    };
  },

  subscribeToUserPresence(userId: string | null | undefined, callback: (state: PresenceState) => void): () => void {
    if (!userId) {
      callback('offline');
      return () => {};
    }

    const statusRef = ref(database, `status/${userId}`);

    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status?.state === 'online') {
        callback('online');
        return;
      }
      callback('offline');
    });

    return unsubscribe;
  },

  setTyping(roomId: string | null | undefined, isTyping: boolean) {
    const user = auth.currentUser;
    if (!user || !roomId) {
      return;
    }

    const typingRef = ref(database, `typing/${roomId}/${user.uid}`);
    if (isTyping) {
      set(typingRef, true).catch((error) => {
        logger.warn('Failed to update typing status', { error, roomId });
      });
      return;
    }

    remove(typingRef).catch((error) => {
      logger.warn('Failed to remove typing status', { error, roomId });
    });
  },

  subscribeToTyping(
    roomId: string | null | undefined,
    callback: (typingMap: Record<string, boolean>) => void
  ): () => void {
    if (!roomId) {
      callback({});
      return () => {};
    }

    const typingRef = ref(database, `typing/${roomId}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const normalized: Record<string, boolean> = {};
      Object.keys(data).forEach((key) => {
        const entry = data[key];
        const isActive = typeof entry === 'boolean' ? entry : Boolean(entry?.value);
        if (isActive) {
          normalized[key] = true;
        }
      });
      callback(normalized);
    });

    return unsubscribe;
  },

  registerTypingOnDisconnect(roomId: string | null | undefined) {
    const user = auth.currentUser;
    if (!user || !roomId) {
      return;
    }

    const typingRef = ref(database, `typing/${roomId}/${user.uid}`);
    onDisconnect(typingRef)
      .remove()
      .catch((error) => {
        logger.warn('Failed to register typing onDisconnect handler', { error, roomId });
      });
  },
};



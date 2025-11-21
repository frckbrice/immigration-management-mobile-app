import {
  onAuthStateChanged,
  Unsubscribe as AuthUnsubscribe,
} from "firebase/auth";
import {
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp,
  remove,
  DatabaseReference,
  Unsubscribe,
} from "firebase/database";

import { auth, getDatabaseInstance } from "@/lib/firebase/config";
import { logger } from "@/lib/utils/logger";

type PresenceState = "online" | "offline";

const OFFLINE_STATUS = {
  state: "offline" as PresenceState,
  last_changed: serverTimestamp(),
};

const ONLINE_STATUS = {
  state: "online" as PresenceState,
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
      logger.warn("Failed to detach Firebase connection listener", error);
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
    state: "offline",
    last_changed: serverTimestamp(),
  }).catch((error) => {
    logger.warn("Failed to mark user offline during cleanup", error);
  });
};

// Feature flag to disable presence tracking
const PRESENCE_ENABLED = false;

export const presenceService = {
  initializePresenceTracking(): () => void {
    // Temporarily disabled - return noop cleanup
    if (!PRESENCE_ENABLED) {
      return () => {
        // noop - presence disabled
      };
    }

    if (initialized) {
      return () => {
        // noop for repeated initializations
      };
    }

    initialized = true;

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      cleanupConnectionListener();

      if (!user) {
        markCurrentUserOffline();
        activeStatusRef = null;
        return;
      }

      // Try to get database instance with retry logic
      // This handles cases where database initialization failed due to timing issues
      let db = getDatabaseInstance();

      // If database is still not available, wait a bit and retry once
      // This gives Firebase time to fully initialize
      if (!db) {
        logger.warn(
          "[PresenceService] Database not available, waiting 500ms before retry...",
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        db = getDatabaseInstance();
        if (db) {
          logger.info(
            "[PresenceService] Database initialized successfully on retry!",
          );
        }
      } else {
        logger.info(
          "[PresenceService] Database available, initializing presence tracking",
        );
      }

      if (!db) {
        logger.error(
          "[PresenceService] Firebase database is not available after retry. Presence tracking will not work.",
        );
        return;
      }

      const userStatusRef = ref(db, `status/${user.uid}`);
      const connectedRef = ref(db, ".info/connected");

      connectionUnsubscribe = onValue(connectedRef, (snapshot) => {
        if (!snapshot.val()) {
          return;
        }

        onDisconnect(userStatusRef)
          .set(OFFLINE_STATUS)
          .catch((error) => {
            logger.warn(
              "Failed to register onDisconnect handler for presence",
              error,
            );
          })
          .then(() =>
            set(userStatusRef, ONLINE_STATUS).catch((error) => {
              logger.warn("Failed to mark user online", error);
            }),
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

  subscribeToUserPresence(
    userId: string | null | undefined,
    callback: (state: PresenceState) => void,
  ): () => void {
    // Temporarily disabled - always return offline
    if (!PRESENCE_ENABLED) {
      callback("offline");
      return () => {};
    }

    if (!userId) {
      callback("offline");
      return () => {};
    }

    const db = getDatabaseInstance();
    if (!db) {
      callback("offline");
      return () => {};
    }

    const statusRef = ref(db, `status/${userId}`);

    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status?.state === "online") {
        callback("online");
        return;
      }
      callback("offline");
    });

    return unsubscribe;
  },

  setTyping(roomId: string | null | undefined, isTyping: boolean) {
    // Temporarily disabled
    if (!PRESENCE_ENABLED) {
      return;
    }

    const user = auth.currentUser;
    if (!user || !roomId) {
      return;
    }

    const db = getDatabaseInstance();
    if (!db) {
      return;
    }

    const typingRef = ref(db, `typing/${roomId}/${user.uid}`);
    if (isTyping) {
      set(typingRef, true).catch((error) => {
        logger.warn("Failed to update typing status", { error, roomId });
      });
      return;
    }

    remove(typingRef).catch((error) => {
      logger.warn("Failed to remove typing status", { error, roomId });
    });
  },

  subscribeToTyping(
    roomId: string | null | undefined,
    callback: (typingMap: Record<string, boolean>) => void,
  ): () => void {
    // Temporarily disabled - always return empty typing map
    if (!PRESENCE_ENABLED) {
      callback({});
      return () => {};
    }

    if (!roomId) {
      callback({});
      return () => {};
    }

    const db = getDatabaseInstance();
    if (!db) {
      callback({});
      return () => {};
    }

    const typingRef = ref(db, `typing/${roomId}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const normalized: Record<string, boolean> = {};
      Object.keys(data).forEach((key) => {
        const entry = data[key];
        const isActive =
          typeof entry === "boolean" ? entry : Boolean(entry?.value);
        if (isActive) {
          normalized[key] = true;
        }
      });
      callback(normalized);
    });

    return unsubscribe;
  },

  registerTypingOnDisconnect(roomId: string | null | undefined) {
    // Temporarily disabled
    if (!PRESENCE_ENABLED) {
      return;
    }

    const user = auth.currentUser;
    if (!user || !roomId) {
      return;
    }

    const db = getDatabaseInstance();
    if (!db) {
      return;
    }

    const typingRef = ref(db, `typing/${roomId}/${user.uid}`);
    onDisconnect(typingRef)
      .remove()
      .catch((error) => {
        logger.warn("Failed to register typing onDisconnect handler", {
          error,
          roomId,
        });
      });
  },
};

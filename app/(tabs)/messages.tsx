import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { IconSymbol } from "@/components/IconSymbol";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import type { Message } from "@/lib/types";
import { BackButton } from "@/components/BackButton";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { useShallow } from "zustand/react/shallow";
import type { ListRenderItem, ListRenderItemInfo } from "react-native";
import type { Conversation } from "@/lib/services/chat";
import { useScrollContext } from "@/contexts/ScrollContext";
import SearchField from "@/components/SearchField";
import { logger } from "@/lib/utils/logger";

type SegmentKey = "chat" | "email";
type EmailFolderKey = "inbox" | "sent";

const formatRelativeTime = (
  timestamp?: number | null,
  fallback = "",
  t?: (key: string) => string,
) => {
  if (!timestamp) {
    return fallback;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1)
    return t ? (t as any)("common.now", { defaultValue: "Now" }) : "Now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString();
};

export default function MessagesScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, isAuthenticated } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    })),
  );
  const { setScrollDirection, setAtBottom } = useScrollContext();
  const lastScrollOffsetRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    messages,
    emailInbox,
    emailSent,
    conversations,
    unreadChatTotal,
    unreadEmailTotal,
    isLoading,
    error,
    conversationsError,
    isConversationsLoading,
    fetchMessages,
    fetchConversations,
    subscribeToConversations,
    markAsRead,
    markAsUnread,
    refreshEmailSegments,
    clearError,
  } = useMessagesStore(
    useShallow((state) => ({
      messages: state.messages,
      emailInbox: state.emailInbox,
      emailSent: state.emailSent,
      conversations: state.conversations,
      unreadChatTotal: state.unreadChatTotal,
      unreadEmailTotal: state.unreadEmailTotal,
      isLoading: state.isLoading,
      error: state.error,
      conversationsError: state.conversationsError,
      isConversationsLoading: state.isConversationsLoading,
      fetchMessages: state.fetchMessages,
      fetchConversations: state.fetchConversations,
      subscribeToConversations: state.subscribeToConversations,
      markAsRead: state.markAsRead,
      markAsUnread: state.markAsUnread,
      refreshEmailSegments: state.refreshEmailSegments,
      clearError: state.clearError,
    })),
  );

  // Initialize segment from URL params if provided, otherwise default to "chat"
  const initialSegment = useMemo(() => {
    const segmentParam = params.segment as string | undefined;
    if (segmentParam === "email" || segmentParam === "chat") {
      return segmentParam as SegmentKey;
    }
    return "chat" as SegmentKey;
  }, [params.segment]);

  const [activeSegment, setActiveSegment] =
    useState<SegmentKey>(initialSegment);
  const [activeEmailFolder, setActiveEmailFolder] =
    useState<EmailFolderKey>("inbox");
  const [searchQuery, setSearchQuery] = useState("");

  // Update segment when params change (e.g., when navigating from home page bell icon)
  useEffect(() => {
    const segmentParam = params.segment as string | undefined;
    if (segmentParam === "email" || segmentParam === "chat") {
      setActiveSegment(segmentParam as SegmentKey);
    }
  }, [params.segment]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    // Only subscribe when user is authenticated and has a valid uid
    if (user?.uid && isAuthenticated) {
      logger.info("Setting up conversation subscription", { userId: user.uid });
      fetchConversations(user.uid);
      const unsubscribe = subscribeToConversations(user.uid);
      return unsubscribe;
    } else {
      logger.debug("Skipping conversation subscription", {
        hasUser: !!user,
        hasUid: !!user?.uid,
        isAuthenticated,
      });
    }
  }, [
    user?.uid,
    isAuthenticated,
    fetchConversations,
    subscribeToConversations,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      refreshEmailSegments();
    }
  }, [messages, refreshEmailSegments]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = setTimeout(() => {
      clearError();
    }, 5000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  const sortedConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }
    return [...conversations].sort((a, b) => {
      const timeA = a.lastMessageTime ?? 0;
      const timeB = b.lastMessageTime ?? 0;
      return timeB - timeA;
    });
  }, [conversations]);

  const emailData = useMemo(
    () => (activeEmailFolder === "inbox" ? emailInbox : emailSent),
    [activeEmailFolder, emailInbox, emailSent],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) {
      return sortedConversations;
    }
    return sortedConversations.filter((conversation) => {
      const haystacks = [
        conversation.participants?.agentName,
        conversation.participants?.clientName,
        conversation.caseReference,
        conversation.lastMessage,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return haystacks.some((value) => value.includes(normalizedSearch));
    });
  }, [normalizedSearch, sortedConversations]);

  const filteredEmailData = useMemo(() => {
    if (!normalizedSearch) {
      return emailData;
    }
    return emailData.filter((item) => {
      const haystacks = [
        item.subject,
        item.preview,
        item.message,
        item.name,
        item.caseReference,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return haystacks.some((value) => value.includes(normalizedSearch));
    });
  }, [normalizedSearch, emailData]);

  const handleEmailPress = useCallback(
    (message: Message) => {
      if (message.unread) {
        markAsRead(message.id).catch(() => {});
      }
      router.push({
        pathname: "/email/[id]",
        params: { id: message.id },
      });
    },
    [markAsRead, router],
  );

  const handleToggleEmailReadStatus = useCallback(
    (message: Message) => {
      if (message.unread) {
        markAsRead(message.id).catch(() => {});
      } else {
        markAsUnread(message.id).catch(() => {});
      }
    },
    [markAsRead, markAsUnread],
  );

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      const roomId = conversation.id;
      const caseId = conversation.caseId;
      router.push({
        pathname: "/chat",
        params: {
          id: roomId || caseId,
          roomId: roomId || undefined,
          caseId: caseId || undefined,
          caseReference: conversation.caseReference || undefined,
        },
      });
    },
    [router],
  );

  const renderConversationItem: ListRenderItem<
    (typeof sortedConversations)[number]
  > = useCallback(
    ({ item }) => {
      const participantName =
        item.participants?.agentName ||
        item.participants?.clientName ||
        t("messages.agent", { defaultValue: "Advisor" });
      const isUnread = item.unreadCount > 0;
      const accentColor = isUnread ? colors.success : colors.primary;
      const neutralBorderColor = withOpacity(
        colors.borderStrong,
        theme.dark ? 0.55 : 0.24,
      );
      const cardBorderColor = isUnread
        ? withOpacity(accentColor, theme.dark ? 0.6 : 0.4)
        : neutralBorderColor;
      const cardBackgroundColor = theme.dark
        ? withOpacity(colors.surfaceElevated, isUnread ? 0.98 : 0.9)
        : withOpacity(colors.surfaceAlt, isUnread ? 0.97 : 0.92);
      const avatarBorderColor = isUnread
        ? withOpacity(accentColor, theme.dark ? 0.65 : 0.45)
        : neutralBorderColor;
      const avatarBackground = withOpacity(
        accentColor,
        theme.dark ? 0.32 : 0.18,
      );

      return (
        <Pressable
          style={[
            styles.conversationCard,
            {
              backgroundColor: cardBackgroundColor,
              borderColor: cardBorderColor,
              shadowColor: "green",
            },
          ]}
          onPress={() => handleConversationPress(item)}
        >
          <View
            style={[
              styles.avatarContainer,
              {
                backgroundColor: avatarBackground,
                borderColor: avatarBorderColor,
                shadowColor: "green",
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                {
                  // backgroundColor: withOpacity(accentColor, theme.dark ? 0.3 : 0.22),
                  backgroundColor: withOpacity(
                    colors.primary,
                    theme.dark ? 0.3 : 0.6,
                  ),
                  borderColor: avatarBorderColor,
                },
              ]}
            >
              <IconSymbol name="person.fill" size={22} color={"white"} />
            </View>
            {isUnread && (
              <View
                style={[
                  styles.onlineIndicator,
                  {
                    backgroundColor: colors.success,
                    borderColor: theme.dark ? colors.surface : "#fff",
                  },
                ]}
              />
            )}
          </View>
          <View style={styles.conversationContent}>
            <View style={styles.messageHeader}>
              <Text
                style={[styles.messageName, { color: colors.text }]}
                numberOfLines={1}
              >
                {participantName}
              </Text>
              <Text style={[styles.messageTime, { color: colors.muted }]}>
                {formatRelativeTime(
                  item.lastMessageTime,
                  t("messages.justNow", { defaultValue: "Just now" }),
                  t,
                )}
              </Text>
            </View>
            <Text
              style={[
                styles.conversationCase,
                {
                  color: withOpacity(accentColor, theme.dark ? 0.85 : 0.72),
                },
              ]}
              numberOfLines={1}
            >
              {item.caseReference}
            </Text>
            <Text
              numberOfLines={2}
              style={[
                styles.messageText,
                { color: colors.muted },
                isUnread && { fontWeight: "600", color: colors.text },
              ]}
            >
              {item.lastMessage || t("messages.noMessages")}
            </Text>
          </View>
          <View
            style={[
              styles.unreadBadge,
              {
                backgroundColor: isUnread
                  ? withOpacity(accentColor, 0.9)
                  : withOpacity(colors.surfaceAlt, theme.dark ? 0.6 : 0.4),
                borderColor: isUnread
                  ? withOpacity(accentColor, theme.dark ? 0.6 : 0.32)
                  : neutralBorderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.unreadBadgeText,
                {
                  color: isUnread
                    ? colors.onPrimary
                    : withOpacity(colors.text, 0.82),
                  // create a card shadow
                  shadowColor: "green",
                },
              ]}
            >
              {isUnread
                ? item.unreadCount > 99
                  ? "99+"
                  : item.unreadCount
                : t("messages.view", { defaultValue: "View" })}
            </Text>
          </View>
        </Pressable>
      );
    },
    [colors, handleConversationPress, t, theme.dark],
  );

  const renderEmailItem: ListRenderItem<(typeof emailData)[number]> =
    useCallback(
      ({ item }) => {
        const isUnread = Boolean(item.unread);
        const baseAccent =
          item.role === "System" ? colors.accent : colors.primary;
        const neutralBorderColor = withOpacity(
          colors.borderStrong,
          theme.dark ? 0.55 : 0.24,
        );
        const cardBorderColor = isUnread
          ? withOpacity(colors.warning, theme.dark ? 0.6 : 0.4)
          : neutralBorderColor;
        const cardBackgroundColor = theme.dark
          ? withOpacity(colors.surfaceElevated, isUnread ? 0.96 : 0.9)
          : withOpacity(colors.surfaceAlt, isUnread ? 0.96 : 0.92);
        const avatarBackground = withOpacity(
          baseAccent,
          theme.dark ? 0.3 : 0.18,
        );
        const avatarBorder = isUnread
          ? withOpacity(colors.warning, theme.dark ? 0.6 : 0.45)
          : neutralBorderColor;

        return (
          <Pressable
            style={[
              styles.messageCard,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                shadowColor: withOpacity(
                  isUnread ? colors.warning : baseAccent,
                  theme.dark ? 0.45 : 0.2,
                ),
              },
            ]}
            onPress={() => handleEmailPress(item)}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  backgroundColor: avatarBackground,
                  borderColor: avatarBorder,
                  shadowColor: withOpacity(
                    isUnread ? colors.warning : baseAccent,
                    theme.dark ? 0.45 : 0.22,
                  ),
                },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: withOpacity(
                      baseAccent,
                      theme.dark ? 0.26 : 0.16,
                    ),
                    borderColor: avatarBorder,
                  },
                ]}
              >
                {item.role === "System" ? (
                  <IconSymbol name="gear" size={20} color={baseAccent} />
                ) : (
                  <IconSymbol
                    name="envelope.fill"
                    size={20}
                    color={baseAccent}
                  />
                )}
              </View>
              {isUnread && (
                <View
                  style={[
                    styles.onlineIndicator,
                    {
                      backgroundColor: colors.warning,
                      borderColor: theme.dark ? colors.surface : "#fff",
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.messageContent}>
              <View style={styles.messageHeader}>
                <Text
                  style={[styles.messageSubject, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.subject ||
                    t("messages.noSubject", { defaultValue: "(No subject)" })}
                </Text>
                <Text
                  style={[styles.messageTime, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {item.time}
                </Text>
              </View>
              <Text
                style={[
                  styles.messageMeta,
                  { color: withOpacity(baseAccent, theme.dark ? 0.85 : 0.6) },
                ]}
                numberOfLines={1}
              >
                {item.direction === "outgoing"
                  ? t("messages.toLabel", {
                      defaultValue: "To {{name}}",
                      name: item.name,
                    })
                  : t("messages.fromLabel", {
                      defaultValue: "From {{name}}",
                      name: item.name,
                    })}
                {item.caseReference
                  ? ` • ${t("messages.caseLabel", {
                      defaultValue: "Case {{reference}}",
                      reference: item.caseReference,
                    })}`
                  : ""}
              </Text>
              <Text
                style={[
                  styles.messageText,
                  { color: colors.muted },
                  isUnread && { fontWeight: "600", color: colors.text },
                ]}
                numberOfLines={2}
              >
                {item.preview || item.message}
              </Text>
            </View>
            <View style={styles.messageActions}>
              {item.attachments && item.attachments.length > 0 && (
                <View
                  style={[
                    styles.attachmentBadge,
                    {
                      backgroundColor: withOpacity(
                        colors.success,
                        theme.dark ? 0.28 : 0.16,
                      ),
                      borderColor: withOpacity(
                        colors.success,
                        theme.dark ? 0.55 : 0.32,
                      ),
                    },
                  ]}
                >
                  <IconSymbol
                    name="doc.text.fill"
                    size={16}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.attachmentText, { color: colors.success }]}
                  >
                    {item.attachments.length}
                  </Text>
                </View>
              )}
              <Pressable
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor: withOpacity(
                      isUnread ? colors.warning : colors.success,
                      0.12,
                    ),
                    borderColor: withOpacity(
                      isUnread ? colors.warning : colors.success,
                      0.32,
                    ),
                  },
                ]}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation?.();
                  handleToggleEmailReadStatus(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  item.unread
                    ? t("messages.markAsRead", { defaultValue: "Mark as read" })
                    : t("messages.markAsUnread", {
                        defaultValue: "Mark as unread",
                      })
                }
              >
                <IconSymbol
                  name={item.unread ? "envelope.fill" : "checkmark.circle.fill"}
                  size={20}
                  color={isUnread ? colors.warning : colors.success}
                />
              </Pressable>
            </View>
          </Pressable>
        );
      },
      [colors, handleEmailPress, handleToggleEmailReadStatus, t, theme.dark],
    );

  const renderEmptyState = useCallback(
    (title: string) => (
      <View style={styles.emptyContainer}>
        <IconSymbol name="message.fill" size={64} color={colors.muted} />
        <Text style={[styles.emptyText, { color: colors.muted }]}>{title}</Text>
      </View>
    ),
    [colors.muted],
  );

  const chatRefreshing = isConversationsLoading;
  const emailRefreshing = isLoading;

  const handleChatRefresh = useCallback(() => {
    if (user?.uid) {
      return fetchConversations(user.uid, true);
    }
    return Promise.resolve();
  }, [fetchConversations, user?.uid]);

  const handleEmailRefresh = useCallback(() => {
    return fetchMessages(true);
  }, [fetchMessages]);

  const contentPaddingBottom = useMemo(() => {
    // Provide ample space so the last items stay above the floating tab bar.
    // We factor in the actual tab bar height plus extra breathing room.
    return insets.bottom + Math.max(tabBarHeight, 120) + 160;
  }, [insets.bottom, tabBarHeight]);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(home)");
    }
  }, [router]);

  const handleConversationsRetry = useCallback(() => {
    void handleChatRefresh();
  }, [handleChatRefresh]);

  const handleEmailsRetry = useCallback(() => {
    void handleEmailRefresh();
  }, [handleEmailRefresh]);

  const chatEmptyTitle = useMemo(
    () =>
      t("messages.noConversations", { defaultValue: "No conversations yet" }),
    [t],
  );

  const emailEmptyTitle = useMemo(
    () =>
      activeEmailFolder === "inbox"
        ? t("messages.noInboxMessages", { defaultValue: "Inbox is empty" })
        : t("messages.noSentMessages", { defaultValue: "No sent messages" }),
    [activeEmailFolder, t],
  );

  const showChatLoadingOverlay =
    activeSegment === "chat" &&
    chatRefreshing &&
    filteredConversations.length === 0;
  const showEmailLoadingOverlay =
    activeSegment === "email" &&
    emailRefreshing &&
    filteredEmailData.length === 0;
  const showLoadingOverlay = showChatLoadingOverlay || showEmailLoadingOverlay;

  const listEmptyComponent = useMemo(() => {
    if (activeSegment === "chat") {
      if (showChatLoadingOverlay) {
        return null;
      }
      return renderEmptyState(chatEmptyTitle);
    }

    if (showEmailLoadingOverlay) {
      return null;
    }
    return renderEmptyState(emailEmptyTitle);
  }, [
    activeSegment,
    chatEmptyTitle,
    emailEmptyTitle,
    renderEmptyState,
    showChatLoadingOverlay,
    showEmailLoadingOverlay,
  ]);

  const isChatSegment = activeSegment === "chat";

  const listData = useMemo<(Conversation | Message)[]>(
    () =>
      (isChatSegment ? filteredConversations : filteredEmailData) as (Conversation | Message)[],
    [filteredConversations, filteredEmailData, isChatSegment],
  );

  const keyExtractor = useCallback(
    (item: Conversation | Message, _index: number) =>
      isChatSegment ? (item as Conversation).id : (item as Message).id,
    [isChatSegment],
  );

  const renderListItem = useCallback(
    (info: ListRenderItemInfo<Conversation | Message>) =>
      isChatSegment
        ? renderConversationItem(
            info as ListRenderItemInfo<(typeof filteredConversations)[number]>,
          )
        : renderEmailItem(
            info as ListRenderItemInfo<(typeof filteredEmailData)[number]>,
          ),
    [isChatSegment, renderConversationItem, renderEmailItem],
  );

  const refreshing = isChatSegment
    ? chatRefreshing && filteredConversations.length > 0
    : emailRefreshing && filteredEmailData.length > 0;
  const onRefresh = isChatSegment ? handleChatRefresh : handleEmailRefresh;

  const totalConversationCount = sortedConversations.length;

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.dark
                ? withOpacity(colors.surfaceElevated, 0.92)
                : withOpacity(colors.primary, 0.12),
              borderColor: withOpacity(
                colors.primary,
                theme.dark ? 0.55 : 0.32,
              ),
              shadowColor: withOpacity(
                colors.primary,
                theme.dark ? 0.45 : 0.25,
              ),
            },
          ]}
        >
          <View style={styles.summaryItem}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: withOpacity(
                    colors.primary,
                    theme.dark ? 0.35 : 0.18,
                  ),
                  borderColor: withOpacity(
                    colors.primary,
                    theme.dark ? 0.55 : 0.38,
                  ),
                },
              ]}
            >
              <IconSymbol
                name="message.fill"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {totalConversationCount}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: withOpacity(colors.text, 0.7) },
              ]}
            >
              {t("messages.activeChats", { defaultValue: "Active chats" })}
            </Text>
          </View>
          <View
            style={[
              styles.summaryItem,
              styles.summaryDivider,
              {
                borderLeftColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.28 : 0.14,
                ),
              },
            ]}
          >
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: withOpacity(
                    colors.warning,
                    theme.dark ? 0.36 : 0.18,
                  ),
                  borderColor: withOpacity(
                    colors.warning,
                    theme.dark ? 0.55 : 0.4,
                  ),
                },
              ]}
            >
              <IconSymbol name="bell.fill" size={18} color={colors.warning} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {unreadChatTotal}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: withOpacity(colors.warning, 0.85) },
              ]}
            >
              {t("messages.unreadChats", { defaultValue: "Unread chat" })}
            </Text>
          </View>
          <View
            style={[
              styles.summaryItem,
              styles.summaryDivider,
              {
                borderLeftColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.28 : 0.14,
                ),
              },
            ]}
          >
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: withOpacity(
                    colors.success,
                    theme.dark ? 0.38 : 0.2,
                  ),
                  borderColor: withOpacity(
                    colors.success,
                    theme.dark ? 0.6 : 0.46,
                  ),
                },
              ]}
            >
              <IconSymbol
                name="envelope.fill"
                size={18}
                color={colors.success}
              />
            </View>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {unreadEmailTotal}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: withOpacity(colors.success, 0.85) },
              ]}
            >
              {t("messages.unreadEmails", { defaultValue: "Unread email" })}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.segmentContainer,
            {
              backgroundColor: theme.dark
                ? colors.surfaceElevated
                : colors.surface,
              borderColor: withOpacity(
                colors.borderStrong,
                theme.dark ? 0.45 : 0.16,
              ),
            },
          ]}
        >
          {(["chat", "email"] as SegmentKey[]).map((segment, index) => {
            const isActive = activeSegment === segment;
            const label =
              segment === "chat"
                ? t("messages.chat")
                : t("messages.email", { defaultValue: "Email" });
            const badgeValue =
              segment === "chat" ? unreadChatTotal : unreadEmailTotal;
            return (
              <Pressable
                key={segment}
                onPress={() => setActiveSegment(segment)}
                style={[
                  styles.segmentButton,
                  index === 0 && styles.segmentButtonSpacing,
                  {
                    backgroundColor: isActive
                      ? withOpacity(colors.primary, theme.dark ? 0.32 : 0.12)
                      : withOpacity(
                          colors.surfaceAlt,
                          theme.dark ? 0.35 : 0.08,
                        ),
                    borderColor: isActive
                      ? withOpacity(colors.primary, theme.dark ? 0.6 : 0.28)
                      : withOpacity(colors.primary, theme.dark ? 0.45 : 0.24),
                    borderWidth: isActive ? StyleSheet.hairlineWidth : 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: isActive ? colors.primary : colors.muted },
                  ]}
                >
                  {label}
                </Text>
                {badgeValue > 0 && (
                  <View
                    style={[
                      styles.segmentBadge,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBadgeText,
                        { color: colors.onPrimary },
                      ]}
                    >
                      {badgeValue > 99 ? "99+" : badgeValue}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {activeSegment === "email" && (
          <View style={styles.folderToggle}>
            {(["inbox", "sent"] as EmailFolderKey[]).map((folder, index) => {
              const isActive = activeEmailFolder === folder;
              return (
                <Pressable
                  key={folder}
                  onPress={() => setActiveEmailFolder(folder)}
                  style={[
                    styles.folderButton,
                    index === 0 && styles.folderButtonSpacing,
                    {
                      backgroundColor: isActive
                        ? withOpacity(colors.primary, theme.dark ? 0.24 : 0.1)
                        : theme.dark
                          ? colors.surfaceElevated
                          : colors.surfaceAlt,
                      borderColor: isActive
                        ? withOpacity(colors.primary, theme.dark ? 0.6 : 0.28)
                        : withOpacity(
                            colors.borderStrong,
                            theme.dark ? 0.4 : 0.12,
                          ),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.folderLabel,
                      { color: isActive ? colors.primary : colors.muted },
                    ]}
                  >
                    {folder === "inbox"
                      ? t("messages.inbox", { defaultValue: "Inbox" })
                      : t("messages.sent", { defaultValue: "Sent" })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery("")}
          placeholder={
            activeSegment === "chat"
              ? t("messages.searchConversations", {
                  defaultValue: "Search conversations",
                })
              : t("messages.searchEmails", { defaultValue: "Search messages" })
          }
          containerStyle={[
            styles.searchFieldContainer,
            {
              backgroundColor: theme.dark
                ? withOpacity(colors.surfaceElevated, 0.96)
                : withOpacity(colors.surfaceAlt, 0.94),
              borderColor: withOpacity(
                colors.borderStrong,
                theme.dark ? 0.6 : 0.28,
              ),
              borderWidth: 1,
              shadowColor: withOpacity(
                colors.primary,
                theme.dark ? 0.45 : 0.25,
              ),
              shadowOpacity: theme.dark ? 0.32 : 0.2,
              shadowRadius: 14,
              elevation: 4,
            },
          ]}
        />

        {activeSegment === "chat" && conversationsError ? (
          <Pressable
            onPress={handleConversationsRetry}
            style={[
              styles.errorContainer,
              {
                backgroundColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.25 : 0.12,
                ),
                borderColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.55 : 0.3,
                ),
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {conversationsError}
            </Text>
          </Pressable>
        ) : null}

        {activeSegment === "email" && error ? (
          <Pressable
            onPress={handleEmailsRetry}
            style={[
              styles.errorContainer,
              {
                backgroundColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.25 : 0.12,
                ),
                borderColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.55 : 0.3,
                ),
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [
      activeEmailFolder,
      activeSegment,
      colors.borderStrong,
      colors.danger,
      colors.muted,
      colors.onPrimary,
      colors.primary,
      colors.success,
      colors.surface,
      colors.surfaceAlt,
      colors.surfaceElevated,
      colors.text,
      colors.warning,
      conversationsError,
      error,
      handleConversationsRetry,
      handleEmailsRetry,
      searchQuery,
      t,
      theme.dark,
      totalConversationCount,
      unreadChatTotal,
      unreadEmailTotal,
    ],
  );

  useEffect(() => {
    setAtBottom(true);
    setScrollDirection(false);
  }, [setAtBottom, setScrollDirection]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.dark
              ? "#1f2937"
              : withOpacity(colors.primary, 0.06),
            paddingTop: insets.top,
          },
        ]}
        edges={["top", "bottom"]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.backgroundAccent,
            {
              backgroundColor: theme.dark
                ? withOpacity(colors.surfaceElevated, 0.32)
                : withOpacity(colors.warning, 0.12),
            },
          ]}
        />
        <View style={styles.header}>
          <BackButton onPress={handleBackPress} iconSize={22} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("messages.title")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {t("messages.subtitle", {
                defaultValue:
                  "Stay connected with your advisors and keep track of updates.",
              })}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/messages/compose")}
            style={[
              styles.headerAction,
              {
                backgroundColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.22 : 0.12,
                ),
              },
            ]}
          >
            <IconSymbol
              name="square.and.pencil"
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.listWrapper,
            {
              backgroundColor: theme.dark
                ? withOpacity(colors.surface, 0.96)
                : withOpacity(colors.surface, 0.98),
              borderColor: withOpacity(
                colors.borderStrong,
                theme.dark ? 0.55 : 0.18,
              ),
              shadowColor: withOpacity(
                colors.primary,
                theme.dark ? 0.45 : 0.18,
              ),
            },
          ]}
        >
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderListItem}
            ListHeaderComponent={listHeaderComponent}
            ListEmptyComponent={listEmptyComponent}
            showsVerticalScrollIndicator={false}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const { contentOffset, layoutMeasurement, contentSize } =
                event.nativeEvent;
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              scrollTimeoutRef.current = setTimeout(() => {
                const currentY = contentOffset.y;
                const isAtBottom =
                  currentY + layoutMeasurement.height >=
                  contentSize.height - 50;
                setAtBottom(isAtBottom);
                const diff = currentY - lastScrollOffsetRef.current;
                if (Math.abs(diff) > 5) {
                  setScrollDirection(diff > 0);
                  lastScrollOffsetRef.current = currentY;
                }
              }, 50);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.listContent,
              listData.length === 0 && !showLoadingOverlay
                ? styles.listEmptyPadding
                : null,
              { paddingBottom: contentPaddingBottom },
            ]}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />

          {showLoadingOverlay && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundAccent: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listEmptyPadding: {
    flexGrow: 1,
    justifyContent: "center",
  },
  listHeader: {
    paddingBottom: 16,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    paddingLeft: 20,
    marginLeft: 20,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  segmentButtonSpacing: {
    marginRight: 8,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  segmentBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  folderToggle: {
    flexDirection: "row",
    marginBottom: 16,
  },
  folderButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  folderButtonSpacing: {
    marginRight: 12,
  },
  folderLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchFieldContainer: {
    marginBottom: 18,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  listWrapper: {
    flex: 1,
    position: "relative",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 8,
    marginHorizontal: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    pointerEvents: "none",
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
  },
  conversationCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  conversationContent: {
    flex: 1,
  },
  conversationCase: {
    fontSize: 12,
    marginBottom: 4,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  messageName: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
    marginRight: 12,
  },
  messageTime: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadBadge: {
    minWidth: 24,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  messageCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  messageContent: {
    flex: 1,
  },
  messageSubject: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
    marginRight: 12,
  },
  messageMeta: {
    fontSize: 12,
    marginBottom: 4,
  },
  messageActions: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  attachmentText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

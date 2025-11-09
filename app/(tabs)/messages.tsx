
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  GestureResponderEvent,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
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

type SegmentKey = "chat" | "email";
type EmailFolderKey = "inbox" | "sent";

const formatRelativeTime = (timestamp?: number | null, fallback = "") => {
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

  if (diffMinutes < 1) return "Now";
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
  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
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
    }))
  );

  const [activeSegment, setActiveSegment] = useState<SegmentKey>("chat");
  const [activeEmailFolder, setActiveEmailFolder] = useState<EmailFolderKey>("inbox");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (user?.uid) {
      fetchConversations(user.uid);
      const unsubscribe = subscribeToConversations(user.uid);
      return unsubscribe;
    }
  }, [user?.uid, fetchConversations, subscribeToConversations]);

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
    [activeEmailFolder, emailInbox, emailSent]
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

  const handleEmailPress = useCallback((message: Message) => {
    if (message.unread) {
      markAsRead(message.id).catch(() => { });
    }
    router.push({
      pathname: "/email/[id]",
      params: { id: message.id },
    });
  }, [markAsRead, router]);

  const handleToggleEmailReadStatus = useCallback((message: Message) => {
    if (message.unread) {
      markAsRead(message.id).catch(() => { });
    } else {
      markAsUnread(message.id).catch(() => { });
    }
  }, [markAsRead, markAsUnread]);

  const handleConversationPress = useCallback((conversation: Conversation) => {
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
  }, [router]);

  const renderConversationItem: ListRenderItem<typeof sortedConversations[number]> = useCallback(({ item }) => {
    const participantName = item.participants?.agentName || item.participants?.clientName || t("messages.agent", { defaultValue: "Advisor" });
    return (
      <Pressable
        style={[
          styles.conversationCard,
          {
            backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
            borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.35 : 0.16),
            shadowColor: colors.backdrop,
          },
        ]}
        onPress={() => handleConversationPress(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <IconSymbol name="person.fill" size={22} color={colors.onPrimary} />
          </View>
          {item.unreadCount > 0 && (
            <View style={[styles.onlineIndicator, { backgroundColor: colors.success }]} />
          )}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.messageName, { color: colors.text }]} numberOfLines={1}>
              {participantName}
            </Text>
            <Text style={[styles.messageTime, { color: colors.muted }]}>
              {formatRelativeTime(item.lastMessageTime, t("messages.justNow", { defaultValue: "Just now" }))}
            </Text>
          </View>
          <Text style={[styles.conversationCase, { color: colors.muted }]} numberOfLines={1}>
            {item.caseReference}
          </Text>
          <Text
            numberOfLines={2}
            style={[
              styles.messageText,
              { color: colors.muted },
              item.unreadCount > 0 && { fontWeight: "600", color: colors.text },
            ]}
          >
            {item.lastMessage || t("messages.noMessages")}
          </Text>
        </View>
        {item.unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.unreadBadgeText, { color: colors.onPrimary }]}>
              {item.unreadCount > 99 ? "99+" : item.unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }, [colors, handleConversationPress, t, theme.dark]);

  const renderEmailItem: ListRenderItem<typeof emailData[number]> = useCallback(({ item }) => (
    <Pressable
      style={[
        styles.messageCard,
        {
          backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
          borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.35 : 0.16),
          shadowColor: colors.backdrop,
        },
      ]}
      onPress={() => handleEmailPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: item.role === "System" ? withOpacity(colors.muted, 0.9) : colors.primary },
          ]}
        >
          <IconSymbol
            name={item.role === "System" ? "gear.circle.fill" : "envelope.fill"}
            size={22}
            color={colors.onPrimary}
          />
        </View>
        {item.unread && (
          <View style={[styles.onlineIndicator, { backgroundColor: colors.accent }]} />
        )}
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageSubject, { color: colors.text }]} numberOfLines={1}>
            {item.subject || t("messages.noSubject", { defaultValue: "(No subject)" })}
          </Text>
          <Text style={[styles.messageTime, { color: colors.muted }]} numberOfLines={1}>
            {item.time}
          </Text>
        </View>
        <Text style={[styles.messageMeta, { color: colors.muted }]} numberOfLines={1}>
          {item.direction === "outgoing"
            ? t("messages.toLabel", { defaultValue: "To {{name}}", name: item.name })
            : t("messages.fromLabel", { defaultValue: "From {{name}}", name: item.name })}
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
            item.unread && { fontWeight: "600", color: colors.text },
          ]}
          numberOfLines={2}
        >
          {item.preview || item.message}
        </Text>
      </View>
      <View style={styles.messageActions}>
        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.attachmentBadge}>
            <IconSymbol
              name="paperclip"
              size={16}
              color={colors.muted}
            />
            <Text style={[styles.attachmentText, { color: colors.muted }]}>
              {item.attachments.length}
            </Text>
          </View>
        )}
        <Pressable
          style={styles.toggleButton}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation?.();
            handleToggleEmailReadStatus(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={item.unread ? t("messages.markAsRead", { defaultValue: "Mark as read" }) : t("messages.markAsUnread", { defaultValue: "Mark as unread" })}
        >
          <IconSymbol
            name={item.unread ? "envelope.open.fill" : "envelope.badge.fill"}
            size={20}
            color={item.unread ? colors.success : colors.warning}
          />
        </Pressable>
      </View>
    </Pressable>
  ), [colors, handleEmailPress, handleToggleEmailReadStatus, t, theme.dark]);

  const renderEmptyState = useCallback((title: string) => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="message.fill" size={64} color={colors.muted} />
      <Text style={[styles.emptyText, { color: colors.muted }]}>{title}</Text>
    </View>
  ), [colors.muted]);

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

  const contentPaddingBottom = useMemo(
    () => insets.bottom + 32,
    [insets.bottom]
  );

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
    () => t("messages.noConversations", { defaultValue: "No conversations yet" }),
    [t]
  );

  const emailEmptyTitle = useMemo(
    () =>
      activeEmailFolder === "inbox"
        ? t("messages.noInboxMessages", { defaultValue: "Inbox is empty" })
        : t("messages.noSentMessages", { defaultValue: "No sent messages" }),
    [activeEmailFolder, t]
  );

  const listEmptyComponent = useMemo(() => {
    if (activeSegment === "chat") {
      if (chatRefreshing) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );
      }
      return renderEmptyState(chatEmptyTitle);
    }

    if (emailRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return renderEmptyState(emailEmptyTitle);
  }, [activeSegment, chatEmptyTitle, chatRefreshing, colors.primary, emailEmptyTitle, emailRefreshing, renderEmptyState]);

  const isChatSegment = activeSegment === "chat";

  const listData = useMemo<Array<Conversation | Message>>(
    () =>
      (isChatSegment ? filteredConversations : filteredEmailData) as Array<
        Conversation | Message
      >,
    [filteredConversations, filteredEmailData, isChatSegment]
  );

  const keyExtractor = useCallback(
    (item: Conversation | Message, _index: number) =>
      isChatSegment
        ? (item as Conversation).id
        : (item as Message).id,
    [isChatSegment]
  );

  const renderListItem = useCallback(
    (info: ListRenderItemInfo<Conversation | Message>) =>
      isChatSegment
        ? renderConversationItem(
          info as ListRenderItemInfo<typeof filteredConversations[number]>
        )
        : renderEmailItem(
          info as ListRenderItemInfo<typeof filteredEmailData[number]>
        ),
    [isChatSegment, renderConversationItem, renderEmailItem]
  );

  const refreshing = isChatSegment
    ? chatRefreshing && filteredConversations.length > 0
    : emailRefreshing && filteredEmailData.length > 0;
  const onRefresh = isChatSegment ? handleChatRefresh : handleEmailRefresh;

  const listHeaderComponent = useMemo(() => (
    <View style={styles.listHeader}>
      <View
        style={[
          styles.segmentContainer,
          {
            backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
            borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.45 : 0.16),
          },
        ]}
      >
        {(["chat", "email"] as SegmentKey[]).map((segment, index) => {
          const isActive = activeSegment === segment;
          const label =
            segment === "chat"
              ? t("messages.chat")
              : t("messages.email", { defaultValue: "Email" });
          const badgeValue = segment === "chat" ? unreadChatTotal : unreadEmailTotal;
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
                    : "transparent",
                  borderColor: isActive
                    ? withOpacity(colors.primary, theme.dark ? 0.6 : 0.28)
                    : "transparent",
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
                <View style={[styles.segmentBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.segmentBadgeText, { color: colors.onPrimary }]}>
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
                      : withOpacity(colors.borderStrong, theme.dark ? 0.4 : 0.12),
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

      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.dark ? colors.surfaceElevated : colors.surface,
            borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.45 : 0.16),
          },
        ]}
      >
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={
            activeSegment === "chat"
              ? t("messages.searchConversations", { defaultValue: "Search conversations" })
              : t("messages.searchEmails", { defaultValue: "Search messages" })
          }
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} style={styles.searchClearButton}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {activeSegment === "chat" && conversationsError ? (
        <Pressable
          onPress={handleConversationsRetry}
          style={[
            styles.errorContainer,
            {
              backgroundColor: withOpacity(colors.danger, theme.dark ? 0.25 : 0.12),
              borderColor: withOpacity(colors.danger, theme.dark ? 0.55 : 0.3),
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
              backgroundColor: withOpacity(colors.danger, theme.dark ? 0.25 : 0.12),
              borderColor: withOpacity(colors.danger, theme.dark ? 0.55 : 0.3),
            },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </Pressable>
      ) : null}
    </View>
  ), [
    activeEmailFolder,
    activeSegment,
    colors.borderStrong,
    colors.danger,
    colors.muted,
    colors.onPrimary,
    colors.primary,
    colors.surface,
    colors.surfaceAlt,
    colors.surfaceElevated,
    colors.text,
    conversationsError,
    error,
    handleConversationsRetry,
    handleEmailsRetry,
    searchQuery,
    t,
    theme.dark,
    unreadChatTotal,
    unreadEmailTotal,
  ]);

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
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        edges={["top"]}
      >
        <View style={styles.header}>
          <BackButton onPress={handleBackPress} iconSize={22} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("messages.title")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {t("messages.subtitle", {
                defaultValue: "Stay connected with your advisors and keep track of updates.",
              })}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/messages/compose")}
            style={[
              styles.headerAction,
              {
                backgroundColor: withOpacity(colors.primary, theme.dark ? 0.22 : 0.12),
              },
            ]}
          >
            <IconSymbol name="square.and.pencil" size={22} color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderListItem}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={listEmptyComponent}
          showsVerticalScrollIndicator={false}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
              const currentY = contentOffset.y;
              const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 50;
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
            listData.length === 0 ? styles.listEmptyPadding : null,
            { paddingBottom: contentPaddingBottom },
          ]}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 16,
  },
  listEmptyPadding: {
    flexGrow: 1,
    justifyContent: "center",
  },
  listHeader: {
    paddingBottom: 16,
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
  },
  searchClearButton: {
    padding: 4,
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
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
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
  },
});

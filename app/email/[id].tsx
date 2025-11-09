import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { messagesService } from "@/lib/services/messagesService";
import { downloadAndTrackFile } from "@/lib/utils/fileDownload";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import type { EmailAttachment, Message } from "@/lib/types";
import { logger } from "@/lib/utils/logger";

const formatFullDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AttachmentRow = ({
  attachment,
  onDownload,
  isLoading,
}: {
  attachment: EmailAttachment;
  onDownload: (attachment: EmailAttachment) => void;
  isLoading: boolean;
}) => {
  return (
    <Pressable
      style={styles.attachmentRow}
      onPress={() => onDownload(attachment)}
      disabled={isLoading}
    >
      <View style={styles.attachmentIcon}>
        <IconSymbol name="paperclip" size={20} color="#2196F3" />
      </View>
      <View style={styles.attachmentDetails}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {attachment.name}
        </Text>
        {attachment.size ? (
          <Text style={styles.attachmentMeta}>
            {(attachment.size / (1024 * 1024)).toFixed(2)} MB
          </Text>
        ) : null}
      </View>
      <IconSymbol name={isLoading ? "clock" : "arrow.down.circle"} size={20} color="#2196F3" />
    </Pressable>
  );
};

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { user } = useAuthStore();
  const { markAsRead, markAsUnread } = useMessagesStore();

  const [email, setEmail] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyVisible, setReplyVisible] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadEmail = useCallback(
    async (suppressLoading = false) => {
      if (!id) return;
      if (!suppressLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      try {
        const data = await messagesService.getMessageById(id);
        setEmail(data);
        if (data.direction !== "outgoing" && data.unread) {
          void markAsRead(id);
        }
      } catch (loadError: any) {
        logger.error("Failed to load email", loadError);
        setError(loadError?.message || t("email.loadError", { defaultValue: "Unable to load this email." }));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id, markAsRead, t]
  );

  useEffect(() => {
    void loadEmail();
  }, [loadEmail]);

  const handleToggleRead = useCallback(() => {
    if (!email) return;
    if (email.unread) {
      void markAsRead(email.id);
      setEmail({ ...email, unread: false, isRead: true, readAt: new Date().toISOString() });
    } else {
      void markAsUnread(email.id);
      setEmail({ ...email, unread: true, isRead: false, readAt: undefined });
    }
  }, [email, markAsRead, markAsUnread]);

  const handleDownloadAttachment = useCallback(
    async (attachment: EmailAttachment) => {
      if (!email) return;
      setDownloadingId(attachment.url || attachment.name);
      try {
        const result = await downloadAndTrackFile({
          url: attachment.url,
          filename: attachment.name,
          mimeType: attachment.type,
          source: "email",
          sourceId: email.id,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
        showAlert({
          title: t("email.downloadSuccessTitle", { defaultValue: "Download complete" }),
          message: t("email.downloadSuccessMessage", {
            defaultValue: "You can find this file under Downloads in Documents.",
          }),
          actions: [{ text: t("common.close"), variant: "primary" }],
        });
      } catch (downloadError: any) {
        logger.error("Failed to download attachment", downloadError);
        showAlert({
          title: t("email.downloadFailedTitle", { defaultValue: "Download failed" }),
          message:
            downloadError?.message || t("email.downloadFailedMessage", { defaultValue: "Unable to download this attachment." }),
          actions: [{ text: t("common.close"), variant: "primary" }],
        });
      } finally {
        setDownloadingId(null);
      }
    },
    [email, showAlert, t]
  );

  const handleReplySubmit = useCallback(async () => {
    if (!email || !replyText.trim() || !user) return;
    if (!email.threadId) {
      showAlert({
        title: t("email.replyNotSupportedTitle", { defaultValue: "Unable to reply" }),
        message: t("email.replyNotSupportedMessage", { defaultValue: "This email thread cannot be replied to." }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }
    setIsSendingReply(true);
    try {
      await messagesService.replyToEmail({
        threadId: email.threadId,
        senderId: user.uid,
        content: replyText.trim(),
        subject: `Re: ${email.subject || t("messages.noSubject", { defaultValue: "(No subject)" })}`,
      });
      showAlert({
        title: t("email.replySentTitle", { defaultValue: "Reply sent" }),
        message: t("email.replySentMessage", { defaultValue: "Your message has been delivered to your advisor." }),
        actions: [{ text: t("common.close"), variant: "primary", onPress: () => setReplyVisible(false) }],
      });
      setReplyText("");
    } catch (replyError: any) {
      logger.error("Failed to send reply", replyError);
      showAlert({
        title: t("email.replyFailedTitle", { defaultValue: "Reply failed" }),
        message: replyError?.message || t("email.replyFailedMessage", { defaultValue: "Unable to send this reply. Please try again later." }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
    } finally {
      setIsSendingReply(false);
    }
  }, [email, replyText, showAlert, t, user]);

  const handleViewCase = useCallback(() => {
    if (!email?.caseId) return;
    router.push({
      pathname: "/case/[id]",
      params: { id: email.caseId },
    });
  }, [email, router]);

  const contentParagraphs = useMemo(() => {
    if (!email?.content) return [];
    return email.content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  }, [email]);

  const canReply = !!email?.threadId && !!user;
  const isInboxEmail = email?.direction !== "outgoing";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {t("email.detailTitle", { defaultValue: "Email" })}
          </Text>
          <Pressable style={styles.headerButton} onPress={handleToggleRead}>
            <IconSymbol
              name={email?.unread ? "envelope.open.fill" : "envelope.badge.fill"}
              size={22}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => loadEmail(true)}>
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>
                {t("common.retry", { defaultValue: "Retry" })}
              </Text>
            </Pressable>
          </View>
        ) : email ? (
          <>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={() => loadEmail(true)} />
              }
            >
              <View style={styles.subjectBlock}>
                <Text style={[styles.subjectText, { color: theme.colors.text }]}>
                  {email.subject || t("messages.noSubject", { defaultValue: "(No subject)" })}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {formatFullDate(email.sentAt)}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.directionBadge, { backgroundColor: isInboxEmail ? "#EAF4FF" : "#F5F5F5" }]}>
                    <Text style={[styles.directionText, { color: theme.colors.primary }]}>
                      {isInboxEmail
                        ? t("messages.inbox", { defaultValue: "Inbox" })
                        : t("messages.sent", { defaultValue: "Sent" })}
                    </Text>
                  </View>
                  {email.caseReference ? (
                    <Pressable style={styles.caseBadge} onPress={handleViewCase}>
                      <IconSymbol name="folder" size={16} color="#2196F3" />
                      <Text style={styles.caseBadgeText}>
                        {t("messages.caseLabel", {
                          defaultValue: "Case {{reference}}",
                          reference: email.caseReference,
                        })}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.participantBlock}>
                <Text style={[styles.participantText, { color: theme.colors.text }]}>
                  {isInboxEmail
                    ? t("messages.fromLabel", { defaultValue: "From {{name}}", name: email.name })
                    : t("messages.toLabel", { defaultValue: "To {{name}}", name: email.name })}
                </Text>
                {email.senderId ? (
                  <Text style={[styles.participantMeta, { color: theme.colors.text + "99" }]}>
                    ID: {email.senderId}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.bodyBlock, { backgroundColor: theme.dark ? "#1C1C1E" : "#FFFFFF" }]}>
                {contentParagraphs.length > 0 ? (
                  contentParagraphs.map((paragraph, index) => (
                    <Text key={index} style={[styles.bodyText, { color: theme.colors.text }]}>
                      {paragraph}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.bodyText, { color: theme.dark ? "#98989D" : "#666" }]}>
                    {t("email.emptyBody", { defaultValue: "No message content." })}
                  </Text>
                )}
              </View>

              {email.attachments && email.attachments.length > 0 ? (
                <View style={styles.attachmentsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {t("email.attachmentsTitle", { defaultValue: "Attachments" })}
                  </Text>
                  {email.attachments.map((attachment) => (
                    <AttachmentRow
                      key={attachment.url || attachment.name}
                      attachment={attachment}
                      onDownload={handleDownloadAttachment}
                      isLoading={downloadingId === (attachment.url || attachment.name)}
                    />
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >
              <View style={[styles.actionBar, { borderTopColor: theme.dark ? "#2C2C2E" : "#E5E5EA" }]}>
                {canReply && (
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => setReplyVisible(true)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {t("email.reply", { defaultValue: "Reply" })}
                    </Text>
                  </Pressable>
                )}
                <Pressable style={styles.secondaryButton} onPress={handleToggleRead}>
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
                    {email.unread
                      ? t("messages.markAsRead", { defaultValue: "Mark as read" })
                      : t("messages.markAsUnread", { defaultValue: "Mark as unread" })}
                  </Text>
                </Pressable>
                {email.caseId ? (
                  <Pressable style={styles.secondaryButton} onPress={handleViewCase}>
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
                      {t("email.viewCase", { defaultValue: "View case" })}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </KeyboardAvoidingView>

            {replyVisible && (
              <View style={styles.replyOverlay}>
                <View style={[styles.replyCard, { backgroundColor: theme.colors.card }]}>
                  <View style={styles.replyHeader}>
                    <Text style={[styles.replyTitle, { color: theme.colors.text }]}>
                      {t("email.reply", { defaultValue: "Reply" })}
                    </Text>
                    <Pressable onPress={() => setReplyVisible(false)}>
                      <IconSymbol name="xmark.circle.fill" size={22} color={theme.colors.text} />
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.replyInput, { color: theme.colors.text }]}
                    multiline
                    placeholder={t("email.replyPlaceholder", { defaultValue: "Write your reply..." })}
                    placeholderTextColor={theme.dark ? "#98989D" : "#999"}
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus
                  />
                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.colors.primary, opacity: replyText.trim() && !isSendingReply ? 1 : 0.6 },
                    ]}
                    onPress={handleReplySubmit}
                    disabled={!replyText.trim() || isSendingReply}
                  >
                    {isSendingReply ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {t("email.sendReply", { defaultValue: "Send reply" })}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : null}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2196F3",
  },
  retryText: {
    fontWeight: "600",
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  subjectBlock: {
    marginBottom: 16,
    gap: 6,
  },
  subjectText: {
    fontSize: 20,
    fontWeight: "700",
  },
  metaText: {
    fontSize: 14,
    opacity: 0.8,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    flexWrap: "wrap",
  },
  directionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  directionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  caseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#E8F2FF",
  },
  caseBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2196F3",
  },
  participantBlock: {
    marginBottom: 16,
  },
  participantText: {
    fontSize: 15,
    fontWeight: "600",
  },
  participantMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  bodyBlock: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  attachmentsSection: {
    marginTop: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    gap: 12,
  },
  attachmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF4FF",
  },
  attachmentDetails: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: "600",
  },
  attachmentMeta: {
    fontSize: 12,
    color: "#666",
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2196F3",
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },
  replyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  replyCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  replyInput: {
    minHeight: 120,
    maxHeight: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
  },
});



import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useToast } from "@/components/Toast";
import { messagesService } from "@/lib/services/messagesService";
import { downloadAndTrackFile } from "@/lib/utils/fileDownload";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import type { EmailAttachment, Message } from "@/lib/types";
import { logger } from "@/lib/utils/logger";
import { COLORS, FONT_SIZES, SPACING } from "@/lib/constants";
import { withOpacity } from "@/styles/theme";
import { apiClient } from "@/lib/api/axios";

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
  onPreview,
  isLoading,
  isPreviewing,
  accentColor,
  isDark,
  mutedColor,
}: {
  attachment: EmailAttachment;
  onDownload: (attachment: EmailAttachment) => void;
    onPreview: (attachment: EmailAttachment) => void;
  isLoading: boolean;
    isPreviewing: boolean;
    accentColor: string;
    isDark: boolean;
    mutedColor: string;
}) => {
  const backgroundColor = isDark ? withOpacity(accentColor, 0.18) : withOpacity(accentColor, 0.1);

  return (
    <View
      style={[
        styles.attachmentRow,
        {
          backgroundColor,
        },
      ]}
    >
      <View
        style={[
          styles.attachmentIcon,
          { backgroundColor: isDark ? withOpacity(accentColor, 0.25) : withOpacity(accentColor, 0.18) },
        ]}
      >
        <IconSymbol name="paperclip" size={18} color={accentColor} />
      </View>
      <View style={styles.attachmentDetails}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {attachment.name}
        </Text>
        {attachment.size ? (
          <Text style={[styles.attachmentMeta, { color: mutedColor }]}>
            {(attachment.size / (1024 * 1024)).toFixed(2)} MB
          </Text>
        ) : null}
      </View>
      <View style={styles.attachmentActions}>
        <Pressable
          style={[styles.attachmentActionButton, { borderColor: withOpacity(accentColor, isDark ? 0.4 : 0.2) }]}
          onPress={() => onPreview(attachment)}
          disabled={isPreviewing}
          accessibilityRole="button"
        >
          {isPreviewing ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <IconSymbol name="eye.fill" size={16} color={accentColor} />
          )}
        </Pressable>
        <Pressable
          style={[styles.attachmentActionButton, { borderColor: withOpacity(accentColor, isDark ? 0.4 : 0.2) }]}
          onPress={() => onDownload(attachment)}
          disabled={isLoading}
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <IconSymbol name="arrow.down.circle.fill" size={16} color={accentColor} />
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const { markAsRead, markAsUnread } = useMessagesStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const replyBottomSheetRef = useRef<BottomSheetModal>(null);

  const handleGoToProfile = useCallback(() => {
    router.push("/(tabs)/profile");
  }, [router]);

  const resolveAttachmentUrl = useCallback((url?: string | null) => {
    if (!url) {
      throw new Error("Attachment URL is missing");
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    const baseURL = apiClient.defaults.baseURL?.replace(/\/$/, "");
    if (!baseURL) {
      return url;
    }
    return `${baseURL}${url.startsWith("/") ? url : `/${url}`}`;
  }, []);

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
        showToast({
          type: "success",
          title: t("email.downloadSuccessTitle", { defaultValue: "Download complete" }),
          message: t("email.downloadSuccessMessage", {
            defaultValue: "You can find this file under Downloads in Documents.",
          }),
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

  const handlePreviewAttachment = useCallback(
    async (attachment: EmailAttachment) => {
      setPreviewingId(attachment.url || attachment.name);
      try {
        const remoteUrl = resolveAttachmentUrl(attachment.url);
        const canOpen = await Linking.canOpenURL(remoteUrl);

        if (!canOpen) {
          showAlert({
            title: t("email.previewUnavailableTitle", { defaultValue: "Preview unavailable" }),
            message: t("email.previewUnavailableMessage", {
              defaultValue: "We could not open this attachment. Please download it instead.",
            }),
            actions: [{ text: t("common.close"), variant: "primary" }],
          });
          return;
        }

        await Linking.openURL(remoteUrl);
      } catch (error: any) {
        logger.error("Failed to open attachment preview", error);
        showAlert({
          title: t("email.previewUnavailableTitle", { defaultValue: "Preview unavailable" }),
          message:
            error?.message ||
            t("email.previewUnavailableMessage", {
              defaultValue: "We could not open this attachment. Please download it instead.",
            }),
          actions: [{ text: t("common.close"), variant: "primary" }],
        });
      } finally {
        setPreviewingId(null);
      }
    },
    [resolveAttachmentUrl, showAlert, t]
  );

  const handleOpenReply = useCallback(() => {
    if (!email?.threadId || !user) {
      showAlert({
        title: t("email.replyNotSupportedTitle", { defaultValue: "Unable to reply" }),
        message: t("email.replyNotSupportedMessage", { defaultValue: "This email thread cannot be replied to." }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }
    replyBottomSheetRef.current?.present();
  }, [email, user, showAlert, t]);

  const handleCloseReply = useCallback(() => {
    replyBottomSheetRef.current?.dismiss();
    setReplyText("");
  }, []);

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
      showToast({
        type: "success",
        title: t("email.replySentTitle", { defaultValue: "Reply sent" }),
        message: t("email.replySentMessage", { defaultValue: "Your message has been delivered to your advisor." }),
      });
      setReplyText("");
      handleCloseReply();
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
  }, [email, replyText, showAlert, showToast, t, user, handleCloseReply]);

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
  const directionIcon = isInboxEmail ? "envelope.fill" : "paperplane.fill";
  const sentAtLabel = email?.sentAt ? formatFullDate(email.sentAt) : "";
  const cardBackground = theme.dark ? theme.colors.surfaceElevated : COLORS.card;
  const surfaceBackground = theme.dark ? theme.colors.surface : COLORS.surface;
  const mutedTextColor = withOpacity(theme.colors.text, theme.dark ? 0.7 : 0.6);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, {
        backgroundColor: theme.dark ? "#1f2937" : theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom
      }]} edges={["top"]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.dark ? theme.colors.surface : COLORS.surface,
              borderBottomColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.4 : 0.18),
            },
          ]}
        >
          <BackButton onPress={() => router.back()} iconSize={22} style={styles.backButton} />
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {t("email.detailTitle", { defaultValue: "Email" })}
            </Text>
            {email?.subject ? (
              <Text
                style={[styles.headerSubtitle, { color: withOpacity(theme.colors.text, theme.dark ? 0.7 : 0.55) }]}
                numberOfLines={1}
              >
                {email.subject}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.headerActionButton,
                {
                  backgroundColor: theme.dark ? withOpacity(theme.colors.primary, 0.18) : withOpacity(theme.colors.primary, 0.12),
                  borderColor: withOpacity(theme.colors.primary, theme.dark ? 0.45 : 0.25),
                },
              ]}
              onPress={handleToggleRead}
            >
              <IconSymbol
                name={email?.unread ? "envelope.fill" : "envelope"}
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.headerActionButton,
                {
                  backgroundColor: theme.dark ? withOpacity(theme.colors.primary, 0.18) : withOpacity(theme.colors.primary, 0.12),
                  borderColor: withOpacity(theme.colors.primary, theme.dark ? 0.45 : 0.25),
                },
              ]}
              onPress={handleGoToProfile}
            >
              <IconSymbol name="person.circle.fill" size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
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
                  <View
                    style={[
                      styles.heroCard,
                      {
                        backgroundColor: cardBackground,
                        borderColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.5 : 0.16),
                        shadowColor: withOpacity(theme.colors.primary, theme.dark ? 0.25 : 0.12),
                      },
                    ]}
                  >
                    {/* <View style={styles.subjectRow}>
                      <IconSymbol name={directionIcon} size={18} color={theme.colors.primary} />
                      <Text style={[styles.subjectText, { color: theme.colors.text }]} numberOfLines={2}>
                        {email.subject || t("messages.noSubject", { defaultValue: "(No subject)" })}
                      </Text>
                    </View> */}
                    <View style={[styles.metaRow, { marginTop: 4 }]}>
                      {sentAtLabel ? (
                        <View style={styles.metaItem}>
                          <IconSymbol name="clock.fill" size={14} color={mutedTextColor} />
                          <Text style={[styles.metaText, { color: mutedTextColor }]}>{sentAtLabel}</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaDivider} />
                      <View
                        style={[
                          styles.directionPill,
                          {
                            backgroundColor: theme.dark
                              ? withOpacity(theme.colors.primary, 0.25)
                              : withOpacity(theme.colors.primary, 0.12),
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: theme.colors.primary }]}>
                      {isInboxEmail
                        ? t("messages.inbox", { defaultValue: "Inbox" })
                        : t("messages.sent", { defaultValue: "Sent" })}
                    </Text>
                      </View>
                </View>
              </View>

                  <View
                    style={[
                      styles.bodyCard,
                      {
                        backgroundColor: surfaceBackground,
                        borderColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.45 : 0.16),
                      },
                    ]}
                  >
                {contentParagraphs.length > 0 ? (
                  contentParagraphs.map((paragraph, index) => (
                    <Text key={index} style={[styles.bodyText, { color: theme.colors.text }]}>
                      {paragraph}
                    </Text>
                  ))
                ) : (
                        <Text style={[styles.bodyText, { color: mutedTextColor }]}>
                    {t("email.emptyBody", { defaultValue: "No message content." })}
                  </Text>
                )}
              </View>

              {email.attachments && email.attachments.length > 0 ? (
                    <View
                      style={[
                        styles.attachmentsCard,
                        {
                          backgroundColor: surfaceBackground,
                          borderColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.45 : 0.16),
                        },
                      ]}
                    >
                      <View style={styles.attachmentsHeader}>
                        <IconSymbol name="paperclip" size={18} color={theme.colors.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          {t("email.attachmentsTitle", { defaultValue: "Attachments" })}
                        </Text>
                        <View style={styles.metaDivider} />
                        <Text style={[styles.attachmentsCount, { color: mutedTextColor }]}>
                          {email.attachments.length}
                        </Text>
                      </View>
                  {email.attachments.map((attachment) => (
                    <AttachmentRow
                      key={attachment.url || attachment.name}
                      attachment={attachment}
                      onDownload={handleDownloadAttachment}
                      onPreview={handlePreviewAttachment}
                      isLoading={downloadingId === (attachment.url || attachment.name)}
                      isPreviewing={previewingId === (attachment.url || attachment.name)}
                      accentColor={theme.colors.primary}
                      isDark={theme.dark}
                      mutedColor={mutedTextColor}
                    />
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >
                  <View
                    style={[
                      styles.actionBar,
                      {
                        borderTopColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.45 : 0.18),
                        backgroundColor: surfaceBackground,
                      },
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: theme.dark
                            ? withOpacity(theme.colors.primary, 0.1)
                            : withOpacity(theme.colors.primary, 0.06),
                        },
                      ]}
                      onPress={handleToggleRead}
                    >
                      <View style={styles.buttonContent}>
                        <IconSymbol
                          name={email?.unread ? "envelope.fill" : "envelope"}
                          size={16}
                          color={theme.colors.primary}
                        />
                        <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
                          {email?.unread
                            ? t("messages.markAsRead", { defaultValue: "Mark as read" })
                            : t("messages.markAsUnread", { defaultValue: "Mark as unread" })}
                        </Text>
                      </View>
                </Pressable>
                    {email?.caseId ? (
                      <Pressable
                        style={[
                          styles.secondaryButton,
                          {
                            backgroundColor: theme.dark
                              ? withOpacity(theme.colors.accent, 0.12)
                              : withOpacity(theme.colors.accent, 0.06),
                          },
                        ]}
                        onPress={handleViewCase}
                      >
                        <View style={styles.buttonContent}>
                          <IconSymbol name="folder.fill" size={16} color={theme.colors.accent} />
                          <Text style={[styles.secondaryButtonText, { color: theme.colors.accent }]}>
                            {t("email.viewCase", { defaultValue: "View case" })}
                          </Text>
                        </View>
                  </Pressable>
                ) : null}
                    {canReply && (
                      <Pressable
                        style={[
                          styles.primaryButton,
                          {
                            backgroundColor: theme.colors.primary,
                            shadowColor: withOpacity(theme.colors.primary, theme.dark ? 0.4 : 0.25),
                          },
                        ]}
                        onPress={handleOpenReply}
                      >
                        <View style={styles.buttonContent}>
                          <IconSymbol name="paperplane.fill" size={16} color={theme.colors.onPrimary} />
                          <Text style={styles.primaryButtonText}>
                            {t("email.reply", { defaultValue: "Reply" })}
                          </Text>
                        </View>
                      </Pressable>
                    )}
              </View>
            </KeyboardAvoidingView>

                <BottomSheetModal
                  ref={replyBottomSheetRef}
                  index={0}
                  snapPoints={['75%', '90%']}
                  enablePanDownToClose
                  enableDismissOnClose
                  backgroundStyle={{
                    backgroundColor: theme.dark ? "#111827" : "#FFFFFF",
                  }}
                  handleIndicatorStyle={{
                    backgroundColor: theme.dark ? "#374151" : "#D1D5DB",
                  }}
                  keyboardBehavior="interactive"
                  keyboardBlurBehavior="restore"
                  android_keyboardInputMode="adjustResize"
                >
                  <BottomSheetView style={styles.replySheetContent}>
                    <View style={styles.replySheetHeader}>
                      <Text style={[styles.replyTitle, { color: theme.colors.text }]}>
                        {t("email.reply", { defaultValue: "Reply" })}
                      </Text>
                      <Pressable onPress={handleCloseReply} style={styles.closeButton}>
                        <IconSymbol name="xmark.circle.fill" size={24} color={theme.colors.muted} />
                      </Pressable>
                    </View>

                    {email && (
                      <View style={[styles.replyContext, {
                        backgroundColor: theme.dark ? withOpacity(theme.colors.primary, 0.1) : withOpacity(theme.colors.primary, 0.05),
                        borderColor: withOpacity(theme.colors.primary, theme.dark ? 0.3 : 0.2),
                      }]}>
                        <View style={styles.replyContextHeader}>
                          <IconSymbol name="envelope.fill" size={16} color={theme.colors.primary} />
                          <Text style={[styles.replyContextLabel, { color: theme.colors.primary }]}>
                            {t("email.replyingTo", { defaultValue: "Replying to" })}
                          </Text>
                        </View>
                        <Text style={[styles.replyContextSubject, { color: theme.colors.text }]} numberOfLines={1}>
                          {email.subject || t("messages.noSubject", { defaultValue: "(No subject)" })}
                        </Text>
                      </View>
                    )}

                    <BottomSheetTextInput
                      style={[
                        styles.replyInput,
                        {
                          color: theme.colors.text,
                          borderColor: withOpacity(theme.colors.borderStrong, theme.dark ? 0.6 : 0.3),
                          backgroundColor: theme.dark
                            ? withOpacity(theme.colors.surfaceAlt, 0.75)
                            : COLORS.surface,
                        },
                      ]}
                      multiline
                      placeholder={t("email.replyPlaceholder", { defaultValue: "Write your reply..." })}
                      placeholderTextColor={withOpacity(theme.colors.text, theme.dark ? 0.45 : 0.4)}
                      value={replyText}
                      onChangeText={setReplyText}
                      autoFocus
                      textAlignVertical="top"
                    />

                    <Pressable
                      style={[
                        styles.replySendButton,
                        {
                          backgroundColor: theme.colors.primary,
                          opacity: replyText.trim() && !isSendingReply ? 1 : 0.6,
                          shadowColor: withOpacity(theme.colors.primary, theme.dark ? 0.4 : 0.25),
                        },
                      ]}
                      onPress={handleReplySubmit}
                      disabled={!replyText.trim() || isSendingReply}
                    >
                      {isSendingReply ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                          <>
                            <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                            <Text style={styles.replySendButtonText}>
                        {t("email.sendReply", { defaultValue: "Send reply" })}
                      </Text>
                          </>
                      )}
                    </Pressable>
                  </BottomSheetView>
                </BottomSheetModal>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
  },
  backButton: {
    marginRight: SPACING.sm,
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerActionButton: {
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryText: {
    fontWeight: "600",
    fontSize: FONT_SIZES.md,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.lg,
    gap: SPACING.lg,
  },
  heroCard: {
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  subjectText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    flex: 1,
  },
  previewText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: withOpacity("#000000", 0.08),
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  directionPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  attachmentsCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  participantDetails: {
    flex: 1,
    gap: 4,
  },
  participantText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  participantMeta: {
    fontSize: FONT_SIZES.sm,
  },
  bodyCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  bodyText: {
    fontSize: FONT_SIZES.lg,
    lineHeight: 26,
  },
  attachmentsCard: {
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  attachmentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
  },
  attachmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentDetails: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  attachmentMeta: {
    fontSize: FONT_SIZES.sm,
  },
  attachmentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  attachmentActionButton: {
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm + 2,
    borderRadius: 12,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonCompact: {
    flex: undefined,
    minWidth: 150,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: FONT_SIZES.md,
  },
  replySheetContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  replySheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  replyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
  },
  closeButton: {
    padding: SPACING.xs,
  },
  replyContext: {
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  replyContextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  replyContextLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  replyContextSubject: {
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    marginTop: 2,
  },
  replyInput: {
    minHeight: 160,
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
  },
  replySendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  replySendButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
});



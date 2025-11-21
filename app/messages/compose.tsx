import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { BackButton } from "@/components/BackButton";
import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { messagesService } from "@/lib/services/messagesService";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useToast } from "@/components/Toast";
import Button from "@/components/button";
import FormInput from "@/components/FormInput";
import { useShallow } from "zustand/react/shallow";
import type { Case, CaseAssignedAgent } from "@/lib/types";

const formatServiceTypeLabel = (serviceType?: string) =>
  serviceType
    ? serviceType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/(^|\s)\w/g, (char) => char.toUpperCase())
    : "";

export default function ComposeEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useAppTheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();

  const {
    cases,
    isLoading: casesLoading,
    fetchCases,
  } = useCasesStore(
    useShallow((state) => ({
      cases: state.cases,
      isLoading: state.isLoading,
      fetchCases: state.fetchCases,
    })),
  );

  const fetchMessages = useMessagesStore((state) => state.fetchMessages);

  type AgentOption = {
    agent: CaseAssignedAgent;
    cases: Case[];
  };

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [isAgentPickerVisible, setAgentPickerVisible] = useState(false);
  const [isCasePickerVisible, setCasePickerVisible] = useState(false);

  const hasRequestedCasesRef = useRef(false);

  useEffect(() => {
    if (hasRequestedCasesRef.current) {
      return;
    }
    hasRequestedCasesRef.current = true;
    fetchCases()
      .then(() => setHasFetchError(false))
      .catch((error) => {
        console.warn("[ComposeEmail] Failed to fetch cases", error);
        setHasFetchError(true);
      });
  }, [fetchCases]);

  const agentOptions: AgentOption[] = useMemo(() => {
    const map = new Map<string, AgentOption>();
    cases.forEach((caseItem) => {
      const agent = caseItem.assignedAgent;
      if (!agent) return;
      const existing = map.get(agent.id);
      if (existing) {
        existing.cases.push(caseItem);
        return;
      }
      map.set(agent.id, {
        agent,
        cases: [caseItem],
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const nameA = `${a.agent.firstName ?? ""} ${a.agent.lastName ?? ""}`
        .trim()
        .toLowerCase();
      const nameB = `${b.agent.firstName ?? ""} ${b.agent.lastName ?? ""}`
        .trim()
        .toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [cases]);

  useEffect(() => {
    if (!agentOptions.length) {
      setSelectedAgentId("");
      return;
    }
    if (
      !selectedAgentId ||
      !agentOptions.some((option) => option.agent.id === selectedAgentId)
    ) {
      setSelectedAgentId(agentOptions[0].agent.id);
    }
  }, [agentOptions, selectedAgentId]);

  const selectedAgentGroup = useMemo(
    () =>
      agentOptions.find((option) => option.agent.id === selectedAgentId) ??
      null,
    [agentOptions, selectedAgentId],
  );

  const filteredCases = selectedAgentGroup?.cases ?? [];

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedCaseId("");
      return;
    }
    if (
      !selectedCaseId ||
      !filteredCases.some((caseItem) => caseItem.id === selectedCaseId)
    ) {
      setSelectedCaseId(filteredCases[0].id);
    }
  }, [filteredCases, selectedCaseId]);

  const selectedCase = useMemo(
    () => filteredCases.find((item) => item.id === selectedCaseId) ?? null,
    [filteredCases, selectedCaseId],
  );

  const selectedAgent = selectedAgentGroup?.agent ?? null;

  const canSend = useMemo(() => {
    return (
      Boolean(selectedCase) &&
      Boolean(selectedAgent) &&
      subject.trim().length > 0 &&
      messageBody.trim().length >= 10 &&
      !isSending
    );
  }, [isSending, messageBody, selectedAgent, selectedCase, subject]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRetryFetch = useCallback(() => {
    setHasFetchError(false);
    fetchCases().catch(() => {
      setHasFetchError(true);
    });
  }, [fetchCases]);

  const handleSendEmail = useCallback(async () => {
    if (!selectedCase || !selectedAgent) {
      showAlert({
        title: t("common.error"),
        message: t("messages.composeSelectAgentError", {
          defaultValue: "Select a case and advisor before sending your email.",
        }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedBody = messageBody.trim();

    if (!trimmedSubject) {
      setSubjectTouched(true);
      showAlert({
        title: t("common.error"),
        message: t("messages.composeSubjectRequired", {
          defaultValue:
            "Add a subject so your advisor understands the context.",
        }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }

    if (trimmedBody.length < 10) {
      setBodyTouched(true);
      showAlert({
        title: t("common.error"),
        message: t("messages.composeBodyTooShort", {
          defaultValue: "Please provide a bit more detail before sending.",
        }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }

    setIsSending(true);
    try {
      await messagesService.sendEmail({
        caseId: selectedCase.id,
        subject: trimmedSubject,
        content: trimmedBody,
        recipientId: selectedAgent.id,
      });

      await fetchMessages(true);

      showToast({
        type: "success",
        title: t("messages.composeSuccessTitle", {
          defaultValue: "Email sent",
        }),
        message: t("messages.composeSuccessMessage", {
          defaultValue: "Your advisor will receive your message shortly.",
        }),
      });

      router.replace("/(tabs)/messages");
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        t("messages.composeSendError", {
          defaultValue: "We could not send your email. Please try again.",
        });
      showAlert({
        title: t("common.error"),
        message: errorMessage,
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
    } finally {
      setIsSending(false);
    }
  }, [
    fetchMessages,
    messageBody,
    router,
    selectedAgent,
    selectedCase,
    showAlert,
    showToast,
    subject,
    t,
  ]);

  const subjectError =
    subjectTouched && !subject.trim()
      ? t("messages.composeSubjectRequired", {
          defaultValue: "Subject is required",
        })
      : undefined;

  const bodyError =
    bodyTouched && messageBody.trim().length < 10
      ? t("messages.composeBodyTooShort", {
          defaultValue: "Enter at least 10 characters.",
        })
      : undefined;

  const renderContent = () => {
    if (casesLoading && !agentOptions.length && !hasFetchError) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            {t("messages.composeLoadingCases", {
              defaultValue: "Loading your cases...",
            })}
          </Text>
        </View>
      );
    }

    if (hasFetchError) {
      return (
        <View style={styles.emptyState}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={56}
            color={colors.danger}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t("messages.composeCasesErrorTitle", {
              defaultValue: "Unable to load advisors",
            })}
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.muted }]}>
            {t("messages.composeCasesErrorBody", {
              defaultValue:
                "We couldn't retrieve your cases. Please try again.",
            })}
          </Text>
          <Button
            variant="filled"
            onPress={handleRetryFetch}
            style={styles.retryButton}
          >
            {t("messages.composeRetry", { defaultValue: "Try again" })}
          </Button>
        </View>
      );
    }

    if (!agentOptions.length) {
      return (
        <View style={styles.emptyState}>
          <IconSymbol
            name="person.crop.circle.fill"
            size={56}
            color={colors.muted}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t("messages.composeNoCasesTitle", {
              defaultValue: "No advisors available yet",
            })}
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.muted }]}>
            {t("messages.composeNoCasesDescription", {
              defaultValue:
                "Once one of your cases is assigned to an advisor you can start an email directly from here.",
            })}
          </Text>
          <Button
            variant="outline"
            onPress={() => router.replace("/(tabs)/cases")}
            style={styles.retryButton}
          >
            {t("messages.composeGoToCases", { defaultValue: "View my cases" })}
          </Button>
        </View>
      );
    }

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 16, 24),
            paddingTop: Math.max(insets.top, 20),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            {t("messages.composeTitle", { defaultValue: "New email" })}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
            {t("messages.composeSubtitle", {
              defaultValue: "Start a fresh conversation with your advisor via email.",
            })}
          </Text>
        </View> */}

        <View style={styles.section}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.dark
                  ? colors.surfaceElevated
                  : colors.surface,
                borderColor: withOpacity(
                  colors.borderStrong,
                  theme.dark ? 0.7 : 0.9,
                ),
                shadowColor: "green",
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <IconSymbol
                name="person.2.fill"
                size={18}
                color={colors.primary}
              />
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t("messages.composeSelectAgent", {
                    defaultValue: "Choose an advisor",
                  })}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                  {t("messages.composeSelectAgentHint", {
                    defaultValue:
                      "Pick the advisor and case you want to contact via email.",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.selectorGroup}>
              <Pressable
                onPress={() => setAgentPickerVisible(true)}
                style={[
                  styles.selectorField,
                  {
                    backgroundColor: theme.dark
                      ? withOpacity(colors.surfaceAlt, 0.75)
                      : withOpacity(colors.primary, 0.05),
                    borderColor: withOpacity(
                      colors.primary,
                      theme.dark ? 0.55 : 0.8,
                    ),
                  },
                ]}
              >
                <View style={[styles.selectorTextGroup]}>
                  <Text
                    style={[styles.selectorLabel, { color: colors.primary }]}
                  >
                    {t("messages.composeAdvisorLabel", {
                      defaultValue: "Advisor",
                    })}
                  </Text>
                  <Text style={[styles.selectorValue, { color: colors.text }]}>
                    {selectedAgent
                      ? `${selectedAgent.firstName ?? ""} ${selectedAgent.lastName ?? ""}`.trim() ||
                        selectedAgent.email
                      : t("messages.composeAdvisorPlaceholder", {
                          defaultValue: "Select advisor",
                        })}
                  </Text>
                  {selectedAgent?.email ? (
                    <Text
                      style={[styles.selectorMeta, { color: colors.muted }]}
                    >
                      {selectedAgent.email}
                    </Text>
                  ) : null}
                </View>
                <IconSymbol
                  name="chevron.down"
                  size={16}
                  color={colors.muted}
                />
              </Pressable>

              <Pressable
                onPress={() => setCasePickerVisible(true)}
                disabled={!filteredCases.length}
                style={[
                  styles.selectorField,
                  {
                    backgroundColor: theme.dark
                      ? withOpacity(colors.surfaceAlt, 0.75)
                      : withOpacity(colors.primary, 0.05),
                    borderColor: withOpacity(
                      colors.primary,
                      theme.dark ? 0.55 : 0.8,
                    ),
                    opacity: filteredCases.length ? 1 : 0.6,
                  },
                ]}
              >
                <View style={styles.selectorTextGroup}>
                  <Text style={[styles.selectorLabel, { color: colors.muted }]}>
                    {t("messages.composeCaseLabel", { defaultValue: "Case" })}
                  </Text>
                  <Text style={[styles.selectorValue, { color: colors.text }]}>
                    {selectedCase
                      ? selectedCase.displayName || selectedCase.referenceNumber
                      : t("messages.composeCasePlaceholder", {
                          defaultValue: "Select case",
                        })}
                  </Text>
                  {selectedCase ? (
                    <Text
                      style={[styles.selectorMeta, { color: colors.muted }]}
                    >
                      {selectedCase.referenceNumber}
                    </Text>
                  ) : null}
                </View>
                <IconSymbol
                  name="chevron.down"
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.sectionCompact]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.dark
                  ? colors.surfaceElevated
                  : colors.surface,
                borderColor: withOpacity(
                  colors.borderStrong,
                  theme.dark ? 0.55 : 1,
                ),
                shadowColor: "green",
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <IconSymbol
                name="doc.text.fill"
                size={18}
                color={colors.primary}
              />
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t("messages.composeDetailsTitle", {
                    defaultValue: "Message details",
                  })}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                  {t("messages.composeDetailsHint", {
                    defaultValue:
                      "Add a clear subject and message so your advisor can respond quickly.",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.subjectFieldContainer}>
              <FormInput
                label={t("messages.composeSubjectLabel", {
                  defaultValue: "Subject",
                })}
                placeholder={t("messages.composeSubjectPlaceholder", {
                  defaultValue: "Visa interview preparation",
                })}
                value={subject}
                onChangeText={setSubject}
                onBlur={() => setSubjectTouched(true)}
                autoCapitalize="sentences"
                autoCorrect
                returnKeyType="done"
                errorText={subjectError}
                containerStyle={styles.subjectField}
              />
            </View>

            <View style={styles.messageInputContainer}>
              <View style={styles.messageLabelRow}>
                <Text style={[styles.messageLabel, { color: colors.text }]}>
                  {t("messages.composeBodyLabel", { defaultValue: "Message" })}
                </Text>
                <Text style={[styles.messageHelper, { color: colors.muted }]}>
                  {t("messages.composeBodyHelper", {
                    defaultValue: "Share all the context your advisor needs.",
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.messageInputWrapper,
                  {
                    borderColor: withOpacity(
                      bodyError ? colors.danger : colors.borderStrong,
                      theme.dark
                        ? bodyError
                          ? 0.9
                          : 0.6
                        : bodyError
                          ? 0.9
                          : 0.35,
                    ),
                    borderWidth: StyleSheet.hairlineWidth * 2,
                    backgroundColor: theme.dark
                      ? withOpacity(colors.surfaceAlt, 0.7)
                      : colors.surfaceAlt,
                  },
                ]}
              >
                <TextInput
                  multiline
                  value={messageBody}
                  onChangeText={setMessageBody}
                  onBlur={() => setBodyTouched(true)}
                  placeholder={t("messages.composeBodyPlaceholder", {
                    defaultValue:
                      "Hello advisor,\n\nI would like to clarify the remaining steps for my application...",
                  })}
                  placeholderTextColor={withOpacity(colors.muted, 0.7)}
                  style={[styles.messageInput, { color: colors.text }]}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  autoCorrect
                  maxLength={4000}
                />
              </View>
              {bodyError ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {bodyError}
                </Text>
              ) : (
                <Text style={[styles.characterCount, { color: colors.muted }]}>
                  {t("messages.composeCharacterCount", {
                    defaultValue: "{{count}} / 4000",
                    count: messageBody.length,
                  })}
                </Text>
              )}
            </View>
          </View>
        </View>

        <Button
          onPress={handleSendEmail}
          loading={isSending}
          disabled={!canSend}
          style={styles.sendButton}
        >
          {t("messages.composeSendCta", { defaultValue: "Send email" })}
        </Button>
      </ScrollView>
    );
  };

  const renderAgentPicker = () => (
    <Modal
      visible={isAgentPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setAgentPickerVisible(false)}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={() => setAgentPickerVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.dark
                ? colors.surfaceElevated
                : colors.surface,
              paddingBottom: Math.max(insets.bottom + 20, 36),
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("messages.composeAgentPickerTitle", {
                defaultValue: "Choose advisor",
              })}
            </Text>
            <Pressable
              onPress={() => setAgentPickerVisible(false)}
              style={styles.modalClose}
            >
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalList}
            showsVerticalScrollIndicator={false}
          >
            {agentOptions.map((option) => {
              const { agent, cases: agentCases } = option;
              const isSelected = agent.id === selectedAgentId;
              const fullName =
                `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim();
              return (
                <Pressable
                  key={agent.id}
                  onPress={() => {
                    setSelectedAgentId(agent.id);
                    setAgentPickerVisible(false);
                  }}
                  style={[
                    styles.modalOption,
                    isSelected && {
                      borderColor: withOpacity(
                        colors.primary,
                        theme.dark ? 0.7 : 0.3,
                      ),
                      backgroundColor: withOpacity(
                        colors.primary,
                        theme.dark ? 0.2 : 0.08,
                      ),
                    },
                  ]}
                >
                  <View style={styles.modalOptionHeader}>
                    <Text
                      style={[styles.modalOptionTitle, { color: colors.text }]}
                    >
                      {fullName.length ? fullName : agent.email}
                    </Text>
                    {isSelected ? (
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </View>
                  {agent.email ? (
                    <Text
                      style={[
                        styles.modalOptionSubtitle,
                        { color: colors.muted },
                      ]}
                    >
                      {agent.email}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.modalOptionMeta, { color: colors.muted }]}
                  >
                    {t("messages.composeAgentCasesCount", {
                      count: agentCases.length,
                      defaultValue:
                        agentCases.length === 1
                          ? "1 case"
                          : `${agentCases.length} cases`,
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderCasePicker = () => (
    <Modal
      visible={isCasePickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setCasePickerVisible(false)}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={() => setCasePickerVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.dark
                ? colors.surfaceElevated
                : colors.surface,
              paddingBottom: Math.max(insets.bottom + 20, 36),
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("messages.composeCasePickerTitle", {
                defaultValue: "Choose case",
              })}
            </Text>
            <Pressable
              onPress={() => setCasePickerVisible(false)}
              style={styles.modalClose}
            >
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalList}
            showsVerticalScrollIndicator={false}
          >
            {filteredCases.map((caseItem) => {
              const isSelected = caseItem.id === selectedCaseId;
              return (
                <Pressable
                  key={caseItem.id}
                  onPress={() => {
                    setSelectedCaseId(caseItem.id);
                    setCasePickerVisible(false);
                  }}
                  style={[
                    styles.modalOption,
                    isSelected && {
                      borderColor: withOpacity(
                        colors.primary,
                        theme.dark ? 0.7 : 0.3,
                      ),
                      backgroundColor: withOpacity(
                        colors.primary,
                        theme.dark ? 0.2 : 0.08,
                      ),
                    },
                  ]}
                >
                  <View style={styles.modalOptionHeader}>
                    <Text
                      style={[styles.modalOptionTitle, { color: colors.text }]}
                    >
                      {caseItem.displayName || caseItem.referenceNumber}
                    </Text>
                    {isSelected ? (
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.modalOptionSubtitle,
                      { color: colors.muted },
                    ]}
                  >
                    {caseItem.referenceNumber}
                  </Text>
                  <Text
                    style={[styles.modalOptionMeta, { color: colors.muted }]}
                  >
                    {formatServiceTypeLabel(caseItem.serviceType)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#1f2937" : colors.background },
        ]}
        edges={["top"]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.select({
            ios: insets.top + 60,
            android: 0,
            default: 0,
          })}
        >
          <View style={styles.header}>
            <BackButton onPress={handleGoBack} iconSize={22} />
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {t("messages.composeTitle", { defaultValue: "New email" })}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
                {t("messages.composeSubtitle", {
                  defaultValue:
                    "Start a fresh conversation with your advisor via email.",
                })}
              </Text>
            </View>
            <View style={styles.headerPlaceholder} />
          </View>

          {renderContent()}
          {renderAgentPicker()}
          {renderCasePicker()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
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
  headerPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionCompact: {
    marginBottom: 16,
  },
  selectorGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 12,
  },
  selectorField: {
    flex: 1,
    minWidth: 160,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  selectorLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    fontWeight: "600",
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  selectorMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    shadowOpacity: 0.08,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageInputContainer: {
    marginTop: 8,
  },
  messageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  messageLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  messageHelper: {
    fontSize: 12,
  },
  messageInputWrapper: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 160,
  },
  pageHeader: {
    gap: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageInput: {
    fontSize: 15,
    lineHeight: 22,
  },
  characterCount: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  subjectFieldContainer: {
    marginBottom: 14,
  },
  subjectField: {
    marginBottom: 0,
  },
  sendButton: {
    marginTop: 8,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 160,
    paddingHorizontal: 24,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalClose: {
    padding: 6,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  modalOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalOptionSubtitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  modalOptionMeta: {
    fontSize: 12,
  },
});

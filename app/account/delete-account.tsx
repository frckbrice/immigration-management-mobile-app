import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { BackButton } from "@/components/BackButton";
import { IconSymbol } from "@/components/IconSymbol";
import { profileService } from "@/lib/services/profileService";
import { useAuthStore } from "@/stores/auth/authStore";

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    showAlert({
      title: t("profile.deleteAccountConfirmTitle", {
        defaultValue: "Confirm Deletion",
      }),
      message: t("profile.deleteAccountConfirmMessage", {
        defaultValue:
          "This action is irreversible. All your data will be permanently deleted. Continue?",
      }),
      actions: [
        {
          text: t("common.cancel"),
          variant: "secondary",
        },
        {
          text: t("profile.deleteAccountConfirm", { defaultValue: "Delete" }),
          variant: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await profileService.deleteAccount();
              await logout();
            } catch (e: any) {
              showAlert({
                title: t("common.error"),
                message:
                  e?.message ||
                  t("profile.deleteAccountError", {
                    defaultValue: "Failed to delete account. Please try again.",
                  }),
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background },
        ]}
        edges={["top", "bottom"]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <BackButton
              onPress={() => router.back()}
              style={{ marginRight: 12 }}
            />
            <View style={styles.headerTextGroup}>
              <Text style={[styles.screenTitle, { color: theme.colors.text }]}>
                {t("profile.deleteAccount")}
              </Text>
              <Text
                style={[
                  styles.screenSubtitle,
                  { color: theme.dark ? "#8E8E93" : "#64748B" },
                ]}
              >
                {t("profile.deleteAccountSubtitle", {
                  defaultValue:
                    "Permanently remove your account and all associated data.",
                })}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Warning Card */}
          <View
            style={[
              styles.warningCard,
              {
                backgroundColor: theme.dark ? "#111827" : "#FFF5F5",
                borderColor: theme.dark ? "#1F2937" : "#FEE2E2",
              },
            ]}
          >
            <View style={styles.warningHeader}>
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={24}
                color={theme.dark ? "#FF6B6B" : "#DC2626"}
              />
              <Text style={[styles.warningTitle, { color: theme.colors.text }]}>
                {t("profile.deleteAccountWarningTitle", {
                  defaultValue: "Warning",
                })}
              </Text>
            </View>
            <Text
              style={[
                styles.warningText,
                { color: theme.dark ? "#E2E8F0" : "#7F1D1D" },
              ]}
            >
              {t("profile.deleteAccountWarningMessage", {
                defaultValue:
                  "This will permanently delete your account and all associated data including:\n\n• All your cases and documents\n• Your payment history\n• Your messages and conversations\n• Your profile information\n\nThis action cannot be undone.",
              })}
            </Text>
          </View>

          {/* Information Card */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.dark ? "#111113" : "#FFFFFF",
                borderColor: theme.dark ? "#1F2937" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.infoRow}>
              <IconSymbol
                name="info.circle"
                size={18}
                color={theme.dark ? "#8E8E93" : "#64748B"}
              />
              <View style={styles.infoTextContainer}>
                <Text
                  style={[
                    styles.infoText,
                    { color: theme.dark ? "#8E8E93" : "#64748B" },
                  ]}
                >
                  {t("profile.deleteAccountInfo", {
                    defaultValue:
                      "If you have any pending cases or payments, please ",
                  })}
                </Text>
                <Pressable onPress={() => router.push("/support/contact")}>
                  <Text
                    style={[
                      styles.supportLink,
                      { color: theme.dark ? "#2196F3" : "#1976D2" },
                    ]}
                  >
                    {t("support.contactSupport")}
                  </Text>
                </Pressable>
                <Text
                  style={[
                    styles.infoText,
                    { color: theme.dark ? "#8E8E93" : "#64748B" },
                  ]}
                >
                  {t("profile.deleteAccountInfoSuffix", {
                    defaultValue: " before deleting your account.",
                  })}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Bar */}
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: theme.dark ? "#000000E6" : "transparent",
              borderTopColor: theme.dark ? "#2C2C2E" : "#E2E8F0",
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            style={[
              styles.cancelButton,
              {
                borderColor: theme.dark ? "#2C2C2E" : "#CBD5F5",
                backgroundColor: theme.dark ? "#111827" : "#FFFFFF",
              },
            ]}
            onPress={() => router.back()}
            disabled={deleting}
          >
            <Text
              style={[
                styles.cancelButtonText,
                { color: theme.dark ? "#E2E8F0" : "#1E293B" },
              ]}
            >
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.deleteButton,
              {
                backgroundColor: "#DC2626",
                opacity: deleting ? 0.7 : 1,
              },
            ]}
            onPress={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol name="trash.fill" size={18} color="#fff" />
                <Text style={styles.deleteButtonText}>
                  {t("profile.deleteAccount")}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 12 : 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  warningCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  warningText: {
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  supportLink: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

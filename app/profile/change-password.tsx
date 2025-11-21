import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { profileService } from "@/lib/services/profileService";
import FormInput from "@/components/FormInput";
import { IconSymbol } from "@/components/IconSymbol";
import { useToast } from "@/components/Toast";
import { BackButton } from "@/components/BackButton";

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({
        title: t("common.validation", { defaultValue: "Validation" }),
        message: t("validation.required"),
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({
        title: t("common.validation", { defaultValue: "Validation" }),
        message: t("validation.passwordsDontMatch"),
      });
      return;
    }
    try {
      setSubmitting(true);
      await profileService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({
        type: "success",
        title: t("common.success"),
        message: t("profile.passwordUpdated", {
          defaultValue: "Your password has been changed.",
        }),
      });
    } catch (e: any) {
      showAlert({
        title: t("common.error"),
        message:
          e?.message ||
          t("profile.passwordUpdateFailed", {
            defaultValue: "Failed to change password.",
          }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {Platform.OS === "ios" && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor: theme.dark ? "#1f2937" : theme.colors.background,
            paddingTop: insets.top,
          },
        ]}
        edges={["top", "bottom"]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <View style={styles.headerTextGroup}>
                <Text
                  style={[styles.screenTitle, { color: theme.colors.text }]}
                >
                  {t("profile.changePassword")}
                </Text>
                <Text
                  style={[
                    styles.screenSubtitle,
                    { color: theme.dark ? "#8E8E93" : "#64748B" },
                  ]}
                >
                  {t("profile.changePasswordSubtitle", {
                    defaultValue:
                      "Use a strong password that you have not used elsewhere.",
                  })}
                </Text>
              </View>
              <View style={styles.headerSpacer} />
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.dark ? "#111113" : "#FFFFFF",
                  borderColor: theme.dark ? "#1F2937" : "#E2E8F0",
                },
              ]}
            >
              <FormInput
                label={t("profile.currentPassword", {
                  defaultValue: "Current Password",
                })}
                placeholder={t("profile.currentPassword", {
                  defaultValue: "Current Password",
                })}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                enablePasswordToggle
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
              />
              <FormInput
                label={t("profile.newPassword", {
                  defaultValue: "New Password",
                })}
                placeholder={t("auth.password")}
                value={newPassword}
                onChangeText={setNewPassword}
                enablePasswordToggle
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
              />
              <FormInput
                label={t("auth.confirmPassword")}
                placeholder={t("auth.confirmPassword")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                enablePasswordToggle
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
              />

              <View style={styles.metaRow}>
                <IconSymbol
                  name="info.circle"
                  size={18}
                  color={theme.dark ? "#8E8E93" : "#64748B"}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: theme.dark ? "#8E8E93" : "#64748B" },
                  ]}
                >
                  {t("profile.passwordHint", {
                    defaultValue:
                      "Passwords must be at least 8 characters and include a combination of numbers and letters.",
                  })}
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
              styles.secondaryButton,
              { borderColor: theme.dark ? "#1F2937" : "#CBD5F5" },
            ]}
            onPress={() => {
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
            }}
            disabled={submitting}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: theme.dark ? "#E2E8F0" : "#1E293B" },
              ]}
            >
              {t("common.reset")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryButton,
              {
                opacity: submitting ? 0.6 : 1,
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={onChange}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t("common.save")}</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 12 : 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  headerSpacer: { width: 40, height: 40 },
  headerTextGroup: { flex: 1, gap: 4 },
  screenTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.2 },
  screenSubtitle: { fontSize: 14 },
  card: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  metaText: { fontSize: 13, flex: 1, lineHeight: 18 },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "600" },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  primaryButtonText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

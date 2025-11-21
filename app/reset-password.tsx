import React, { useState, useRef, useEffect } from "react";
import {
  ScrollView,
  Pressable,
  StyleSheet,
  View,
  Text,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { BackButton } from "@/components/BackButton";
import FormInput from "@/components/FormInput";
import { useTheme } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { apiClient } from "@/lib/api/axios";
import { logger } from "@/lib/utils/logger";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { validatePassword } from "@/lib/utils/passwordValidation";
import * as Linking from "expo-linking";

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ oobCode?: string; mode?: string }>();
  const { showAlert } = useBottomSheetAlert();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);

  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // Extract oobCode from URL parameters or deep link
  useEffect(() => {
    let code = params.oobCode;

    // If not in params, try to get from deep link
    const extractFromDeepLink = async () => {
      if (!code) {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const parsed = Linking.parse(initialUrl);
            code = parsed.queryParams?.oobCode as string | undefined;
          }
        } catch (error) {
          logger.warn("Failed to get initial URL", error);
        }
      }

      if (code) {
        setOobCode(code);
      } else {
        // No oobCode found - show error and redirect
        showAlert({
          title: t("common.error"),
          message:
            t("auth.invalidResetLink") ||
            "Invalid or missing reset link. Please request a new password reset.",
          actions: [
            {
              text: t("common.ok"),
              onPress: () => router.replace("/forgot-password"),
              variant: "primary",
            },
          ],
        });
      }
    };

    extractFromDeepLink();

    // Listen for incoming deep links when app is already open
    const subscription = Linking.addEventListener("url", (event) => {
      const parsed = Linking.parse(event.url);
      const linkCode = parsed.queryParams?.oobCode as string | undefined;
      if (linkCode) {
        setOobCode(linkCode);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [params.oobCode, showAlert, t, router]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Validate password
    if (!password.trim()) {
      setPasswordError(t("validation.required") || "Password is required");
      isValid = false;
    } else {
      const validation = validatePassword(password);
      if (!validation.valid) {
        setPasswordError(validation.errors[0]);
        isValid = false;
      } else {
        setPasswordError(null);
      }
    }

    // Validate confirm password
    if (!confirmPassword.trim()) {
      setConfirmPasswordError(
        t("validation.confirmPasswordRequired") ||
          "Please confirm your password",
      );
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError(
        t("validation.passwordsDoNotMatch") || "Passwords do not match",
      );
      isValid = false;
    } else {
      setConfirmPasswordError(null);
    }

    return isValid;
  };

  const handleResetPassword = async () => {
    if (!oobCode) {
      showAlert({
        title: t("common.error"),
        message:
          t("auth.invalidResetLink") ||
          "Invalid reset link. Please request a new password reset.",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post("/auth/reset-password", {
        oobCode,
        password: password.trim(),
      });

      if (response.data.success) {
        logger.info("Password reset successfully", {
          email: response.data.data?.email,
        });

        showAlert({
          title: t("auth.passwordResetSuccess") || "Password Reset Successful",
          message:
            response.data.message ||
            t("auth.passwordResetSuccessMessage") ||
            "Your password has been reset successfully. You can now login with your new password.",
          actions: [
            {
              text: t("auth.login"),
              onPress: () => router.replace("/login"),
              variant: "primary",
            },
          ],
        });
      } else {
        throw new Error(response.data.error || t("errors.generic"));
      }
    } catch (error: any) {
      logger.error("Password reset error", error);
      let errorMessage = t("errors.generic");

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 400) {
          // Invalid/expired code or weak password
          errorMessage =
            data.error ||
            t("auth.invalidResetLink") ||
            "Invalid or expired reset link. Please request a new one.";
        } else if (status === 500) {
          errorMessage = data.error || data.message || t("errors.generic");
        } else {
          errorMessage = data.error || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert({
        title: t("common.error"),
        message: errorMessage,
        actions: [
          {
            text: t("auth.requestNewLink") || "Request New Link",
            onPress: () => router.replace("/forgot-password"),
            variant: "primary",
          },
          {
            text: t("common.cancel"),
            variant: "secondary",
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!oobCode) {
    // Show loading state while extracting oobCode
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={[
            styles.container,
            {
              backgroundColor: theme.dark ? "#1f2937" : theme.colors.background,
            },
          ]}
          edges={["top"]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              {t("common.loading") || "Loading..."}
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

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
          { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background },
        ]}
        edges={["top"]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 100) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Back Button */}
            <BackButton
              onPress={() => router.back()}
              iconSize={24}
              style={styles.backButtonWrapper}
            />

            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoIconContainer}>
                <Image
                  source={require("@/assets/app_logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {t("auth.resetPassword") || "Reset Password"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                {t("auth.enterNewPassword") || "Enter your new password below"}
              </Text>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text
                style={[
                  styles.requirementsTitle,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                {t("auth.passwordRequirements") || "Password must contain:"}
              </Text>
              <Text
                style={[
                  styles.requirement,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                • {t("auth.min8Characters") || "At least 8 characters"}
              </Text>
              <Text
                style={[
                  styles.requirement,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                • {t("auth.oneUppercase") || "One uppercase letter"}
              </Text>
              <Text
                style={[
                  styles.requirement,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                • {t("auth.oneLowercase") || "One lowercase letter"}
              </Text>
              <Text
                style={[
                  styles.requirement,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                • {t("auth.oneNumber") || "One number"}
              </Text>
            </View>

            {/* Password Input */}
            <FormInput
              ref={passwordInputRef}
              label={t("auth.newPassword") || "New Password"}
              placeholder={t("auth.enterNewPassword") || "Enter new password"}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) {
                  const validation = validatePassword(text);
                  if (validation.valid) {
                    setPasswordError(null);
                  }
                }
              }}
              enablePasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              textContentType="newPassword"
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
              editable={!isLoading}
              errorText={passwordError || undefined}
            />

            {/* Confirm Password Input */}
            <FormInput
              ref={confirmPasswordInputRef}
              label={t("auth.confirmPassword") || "Confirm Password"}
              placeholder={
                t("auth.confirmNewPassword") || "Confirm new password"
              }
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) {
                  if (text === password) {
                    setConfirmPasswordError(null);
                  }
                }
              }}
              enablePasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              textContentType="newPassword"
              onSubmitEditing={handleResetPassword}
              editable={!isLoading}
              errorText={confirmPasswordError || undefined}
            />

            {/* Reset Button */}
            <Pressable
              style={[
                styles.resetButton,
                isLoading && styles.resetButtonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.resetButtonText}>
                  {t("auth.resetPassword") || "Reset Password"}
                </Text>
              )}
            </Pressable>

            {/* Back to Login Link */}
            <View style={styles.backToLoginContainer}>
              <Text
                style={[
                  styles.backToLoginText,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                {t("auth.rememberPassword")}
              </Text>
              <Pressable onPress={() => router.replace("/login")}>
                <Text style={styles.backToLoginLink}>{t("auth.login")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  backButtonWrapper: {
    padding: 8,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  titleContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  requirementsContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(33, 150, 243, 0.05)",
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  requirement: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },
  resetButton: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  backToLoginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  backToLoginText: {
    fontSize: 14,
  },
  backToLoginLink: {
    fontSize: 14,
    color: "#2196F3",
    fontWeight: "700",
  },
});

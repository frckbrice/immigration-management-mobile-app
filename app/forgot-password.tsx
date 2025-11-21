import React, { useState, useRef } from "react";
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
import { IconSymbol } from "@/components/IconSymbol";
import { BackButton } from "@/components/BackButton";
import FormInput from "@/components/FormInput";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { apiClient } from "@/lib/api/axios";
import { logger } from "@/lib/utils/logger";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useBottomSheetAlert();
  const emailInputRef = useRef<TextInput>(null);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showAlert({
        title: t("common.error"),
        message: t("validation.required"),
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showAlert({
        title: t("common.error"),
        message: t("validation.invalidEmail"),
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post("/auth/forgot-password", {
        email: email.trim(),
      });

      if (response.data.success) {
        logger.info("Password reset email sent", { email: email.trim() });

        showAlert({
          title: t("auth.passwordResetSent"),
          message: response.data.message || t("auth.checkEmailForReset"),
          actions: [
            {
              text: t("common.ok"),
              onPress: () => router.back(),
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
        // Backend error response
        const status = error.response.status;
        const data = error.response.data;

        if (status === 400) {
          errorMessage = data.error || t("validation.invalidEmail");
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
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
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

            {/* Logo - Matching onboarding design */}
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
                {t("auth.forgotPassword")}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.dark ? "#98989D" : "#666" },
                ]}
              >
                {t("auth.enterEmailForReset")}
              </Text>
            </View>

            {/* Email Input */}
            <FormInput
              ref={emailInputRef}
              label={t("auth.email")}
              placeholder={t("auth.enterEmail")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              textContentType="emailAddress"
              onSubmitEditing={handleResetPassword}
              editable={!isLoading}
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
                  {t("auth.sendResetLink")}
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
              <Pressable onPress={() => router.back()}>
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
    marginBottom: 32,
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

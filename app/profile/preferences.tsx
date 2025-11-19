import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { type AppThemeColors } from "@/styles/theme";
import { IconSymbol } from "@/components/IconSymbol";
import { useSettingsStore } from "@/stores/settings/settingsStore";
import { useToast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth/authStore";
import { BackButton } from "@/components/BackButton";
import { resetOnboarding, resetGetStarted } from "@/lib/utils/onboarding";

type ThemePreference = "system" | "light" | "dark";
type LanguagePreference = "en" | "fr";

export default function PreferencesScreen() {
    const { t, changeLanguage, currentLanguage } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const theme = useAppTheme();
    const colors = theme.colors as AppThemeColors;
    const { showToast } = useToast();

    const {
        settings,
        fetchSettings,
        updateSettings,
        isUpdating,
        setSettings,
    } = useSettingsStore();
    const { registerPushToken, unregisterPushToken } = useAuthStore();

    const [themePreference, setThemePreference] = useState<ThemePreference>("system");
    const [languagePreference, setLanguagePreference] = useState<LanguagePreference>("en");
    const [initializing, setInitializing] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [processingNotifications, setProcessingNotifications] = useState(false);
    const [resettingOnboarding, setResettingOnboarding] = useState(false);

    useEffect(() => {
        const hydrate = async () => {
            if (!settings) {
                await fetchSettings();
            }
            setInitializing(false);
        };
        hydrate();
    }, [settings, fetchSettings]);

    useEffect(() => {
        if (settings) {
            setThemePreference(settings.themePreference ?? "system");
            // Use stored preference first, then fall back to current i18n language
            const storedLang = settings.languagePreference;
            const currentLang = currentLanguage === "fr" ? "fr" : "en";
            setLanguagePreference(storedLang ?? currentLang);
            const enabled = Boolean(settings.pushNotifications && settings.emailNotifications);
            setNotificationsEnabled(enabled);
        }
    }, [settings, currentLanguage]);

    const themeOptions = useMemo(
        () => [
            {
                value: "system" as ThemePreference,
                label: t("profile.themeOptions.system", { defaultValue: "Match System" }),
                description: t("profile.themeSystemDescription", {
                    defaultValue: "Follow your device preference automatically.",
                }),
                icon: "circle.lefthalf.fill",
            },
            {
                value: "light" as ThemePreference,
                label: t("profile.themeOptions.light", { defaultValue: "Light" }),
                description: t("profile.themeLightDescription", {
                    defaultValue: "Bright background with high contrast.",
                }),
                icon: "sun.max.fill",
            },
            {
                value: "dark" as ThemePreference,
                label: t("profile.themeOptions.dark", { defaultValue: "Dark" }),
                description: t("profile.themeDarkDescription", {
                    defaultValue: "Dimmed tones that are easier on the eyes.",
                }),
                icon: "moon.fill",
            },
        ],
        [t]
    );

    const languageOptions = useMemo(
        () => [
            {
                value: "en" as LanguagePreference,
                label: t("profile.languageOptions.en", { defaultValue: "English" }),
                description: t("profile.languageEnDescription", {
                    defaultValue: "Use English across menus and content.",
                }),
                flag: "🇬🇧",
            },
            {
                value: "fr" as LanguagePreference,
                label: t("profile.languageOptions.fr", { defaultValue: "Français" }),
                description: t("profile.languageFrDescription", {
                    defaultValue: "Utiliser le français pour toutes les sections.",
                }),
                flag: "🇫🇷",
            },
        ],
        [t]
    );

    const handleThemeChange = async (value: ThemePreference) => {
        if (themePreference === value || isUpdating) return;
        setThemePreference(value);
        try {
            await updateSettings({ themePreference: value });
            showToast({
                type: "success",
                title: t("common.success"),
                message: t("profile.themeUpdated", { defaultValue: "Theme preference updated." }),
            });
        } catch (error: any) {
            setThemePreference(settings?.themePreference ?? "system");
            const message = typeof error?.message === "string" ? error.message : undefined;
            showToast({
                type: "error",
                title: t("common.error"),
                message:
                    message ||
                    t("profile.themeUpdateError", { defaultValue: "Unable to update theme preference." }),
            });
        }
    };

    const handleLanguageChange = async (value: LanguagePreference) => {
        if (languagePreference === value || isUpdating) return;
        setLanguagePreference(value);
        try {
            // Change language first (this also saves to AsyncStorage)
            await changeLanguage(value);
            // Then update settings store
            await updateSettings({ languagePreference: value });
            showToast({
                type: "success",
                title: t("common.success"),
                message: t("profile.languageUpdated", { defaultValue: "Language updated successfully." }),
            });
        } catch (error: any) {
            // Revert on error
            const previousLang = settings?.languagePreference ?? (currentLanguage === "fr" ? "fr" : "en");
            setLanguagePreference(previousLang);
            // Try to restore previous language
            try {
                await changeLanguage(previousLang);
            } catch (restoreError) {
                // Ignore restore errors
            }
            const message = typeof error?.message === "string" ? error.message : undefined;
            showToast({
                type: "error",
                title: t("common.error"),
                message:
                    message ||
                    t("profile.languageUpdateError", { defaultValue: "Unable to change language right now." }),
            });
        }
    };

    const handleNotificationToggle = async (enabled: boolean) => {
        if (processingNotifications || isUpdating) {
            return;
        }

        const previousSettings = settings;
        const previousValue = notificationsEnabled;
        setNotificationsEnabled(enabled);
        setProcessingNotifications(true);
        let tokenRegistered = false;

        try {
            if (enabled) {
                const tokenData = await registerPushToken();
                if (!tokenData) {
                    throw new Error(
                        t("profile.notificationsEnableError", {
                            defaultValue: "Unable to enable notifications. Check your device permissions and try again.",
                        })
                    );
                }
                tokenRegistered = true;

                const updated = await updateSettings({ pushNotifications: true, emailNotifications: true });
                if (!updated) {
                    throw new Error(
                        t("profile.notificationsUpdateError", {
                            defaultValue: "Failed to save notification preference. Please try again.",
                        })
                    );
                }

                showToast({
                    type: "success",
                    title: t("common.success"),
                    message: t("profile.notificationsEnabledMessage", {
                        defaultValue: "You will now receive email and push notifications for case updates and new messages.",
                    }),
                });
            } else {
                const updated = await updateSettings({ pushNotifications: false, emailNotifications: false });
                if (!updated) {
                    throw new Error(
                        t("profile.notificationsUpdateError", {
                            defaultValue: "Failed to save notification preference. Please try again.",
                        })
                    );
                }

                await unregisterPushToken();

                showToast({
                    type: "info",
                    title: t("profile.notificationsDisabledTitle", { defaultValue: "Notifications Off" }),
                    message: t("profile.notificationsDisabledMessage", {
                        defaultValue: "Email and push alerts are silenced. You can still review new messages from the bell icon.",
                    }),
                });
            }
        } catch (error: any) {
            const message = typeof error?.message === "string" ? error.message : undefined;
            setNotificationsEnabled(previousValue);
            if (previousSettings) {
                setSettings(previousSettings);
            }

            if (enabled && tokenRegistered) {
                await unregisterPushToken();
            }

            showToast({
                type: "error",
                title: t("common.error"),
                message:
                    message ||
                    t("profile.notificationsToggleError", {
                        defaultValue: "We could not update your notification preference right now. Please try again later.",
                    }),
            });
        } finally {
            setProcessingNotifications(false);
        }
    };

    const handleResetOnboarding = () => {
        Alert.alert(
            t("profile.resetOnboardingTitle", { defaultValue: "Reset Onboarding" }),
            t("profile.resetOnboardingMessage", {
                defaultValue: "This will reset your onboarding status. You'll be taken to the welcome screens immediately. Continue?",
            }),
            [
                {
                    text: t("common.cancel", { defaultValue: "Cancel" }),
                    style: "cancel",
                },
                {
                    text: t("common.reset", { defaultValue: "Reset" }),
                    style: "destructive",
                    onPress: async () => {
                        setResettingOnboarding(true);
                        try {
                            // Reset both onboarding and getstarted to allow full flow
                            await resetOnboarding();
                            await resetGetStarted();
                            showToast({
                                type: "success",
                                title: t("common.success"),
                                message: t("profile.onboardingResetSuccess", {
                                    defaultValue: "Onboarding reset. Redirecting to getstarted screens...",
                                }),
                            });
                            // Navigate immediately to getstarted page after a short delay to show toast
                            setTimeout(() => {
                                router.replace('/getstarted');
                            }, 500);
                        } catch (error: any) {
                            setResettingOnboarding(false);
                            showToast({
                                type: "error",
                                title: t("common.error"),
                                message: error?.message || t("profile.onboardingResetError", {
                                    defaultValue: "Failed to reset onboarding.",
                                }),
                            });
                        }
                    },
                },
            ]
        );
    };

    const renderThemeOptions = () =>
        themeOptions.map((option) => {
            const isActive = option.value === themePreference;
            return (
                <Pressable
                    key={option.value}
                    style={[
                        styles.optionRow,
                        {
                            borderColor: isActive ? colors.primary : theme.dark ? "#1F2937" : "#E2E8F0",
                            backgroundColor: isActive
                                ? theme.dark ? "rgba(33, 150, 243, 0.12)" : "rgba(33, 150, 243, 0.08)"
                                : theme.dark ? "#111827" : "#F8FAFC",
                        },
                    ]}
                    onPress={() => handleThemeChange(option.value)}
                    disabled={isUpdating}
                >
                    <View style={styles.optionContent}>
                        <View style={[styles.optionIcon, { backgroundColor: colors.primary + "15" }]}>
                            <IconSymbol name={option.icon} size={22} color={colors.primary} />
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                            <Text style={[styles.optionDescription, { color: colors.muted }]}>
                                {option.description}
                            </Text>
                        </View>
                    </View>
                    {isActive && <IconSymbol name="checkmark.circle.fill" size={22} color={colors.primary} />}
                </Pressable>
            );
        });

    const renderLanguageOptions = () =>
        languageOptions.map((option) => {
            const isActive = option.value === languagePreference;
            return (
                <Pressable
                    key={option.value}
                    style={[
                        styles.optionRow,
                        {
                            borderColor: isActive ? colors.primary : theme.dark ? "#1F2937" : "#E2E8F0",
                            backgroundColor: isActive
                                ? theme.dark ? "rgba(33, 150, 243, 0.12)" : "rgba(33, 150, 243, 0.08)"
                                : theme.dark ? "#111827" : "#F8FAFC",
                        },
                    ]}
                    onPress={() => handleLanguageChange(option.value)}
                    disabled={isUpdating}
                >
                    <View style={styles.optionContent}>
                        <Text style={styles.flag}>{option.flag}</Text>
                        <View style={styles.optionTextContainer}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                            <Text style={[styles.optionDescription, { color: colors.muted }]}>
                                {option.description}
                            </Text>
                        </View>
                    </View>
                    {isActive && <IconSymbol name="checkmark.circle.fill" size={22} color={colors.primary} />}
                </Pressable>
            );
        });

    if (initializing && !settings) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator />
            </SafeAreaView>
        );
    }

    return (
        <>
            {Platform.OS === "ios" && (
                <Stack.Screen
                    options={{
                        headerShown: false,
                    }}
                />
            )}
            <SafeAreaView
                style={[styles.container,
                {
                    backgroundColor: theme.dark ? "#1f2937" : theme.colors.background,
                    paddingBottom: insets.bottom,
                    paddingTop: insets.top
                }]}

                edges={["top"]}
            >
                <View style={[styles.header, { paddingTop: insets.top }]}>
                    <View style={{ marginRight: 16 }} >
                    <BackButton onPress={() => router.back()} iconSize={22} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {t("profile.preferencesTitle", { defaultValue: "Theme & Language" })}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
                            {t("profile.preferencesSubtitle", {
                                defaultValue: "Personalize how the app looks and the language you read.",
                            })}
                        </Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 24, paddingTop: insets.top },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.card, { backgroundColor: theme.dark ? "#111827" : "#FFFFFF" }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderText}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    {t("profile.notificationSectionTitle", { defaultValue: "Notifications" })}
                                </Text>
                                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                                    {t("profile.notificationSectionSubtitle", {
                                        defaultValue: "Enable email and push alerts for new messages and case updates.",
                                    })}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.cardBody}>
                            <View
                                style={[
                                    styles.toggleRow,
                                    {
                                        borderColor: theme.dark ? "#1F2937" : "#E2E8F0",
                                        backgroundColor: theme.dark ? "#111827" : "#F8FAFC",
                                    },
                                ]}
                            >
                                <View style={styles.toggleContent}>
                                    <View style={[styles.optionIcon, { backgroundColor: colors.primary + "15" }]}>
                                        <IconSymbol name="bell.fill" size={22} color={colors.primary} />
                                    </View>
                                    <View style={styles.toggleTextContainer}>
                                        <Text style={[styles.optionTitle, { color: colors.text }]}>
                                            {t("profile.notifications")}
                                        </Text>
                                        <Text style={[styles.optionDescription, { color: colors.muted }]}>
                                            {t("profile.notificationsDescription", {
                                                defaultValue: "Enable alerts for new messages and case updates.",
                                            })}
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={notificationsEnabled}
                                    onValueChange={handleNotificationToggle}
                                    trackColor={{ false: "#767577", true: colors.primary }}
                                    thumbColor={
                                        Platform.OS === "android"
                                            ? notificationsEnabled
                                                ? colors.primary
                                                : "#f4f3f4"
                                            : undefined
                                    }
                                    disabled={processingNotifications || isUpdating}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: theme.dark ? "#111827" : "#FFFFFF" }]}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                {t("profile.themeSectionTitle", { defaultValue: "Appearance" })}
                            </Text>
                        </View>
                        <View style={styles.cardBody}>{renderThemeOptions()}</View>
                    </View>

                    <View style={[styles.card, { backgroundColor: theme.dark ? "#111827" : "#FFFFFF" }]}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                {t("profile.languageSectionTitle", { defaultValue: "Language" })}
                            </Text>
                        </View>
                        <View style={styles.cardBody}>{renderLanguageOptions()}</View>
                    </View>

                    {/* Developer/Test Options */}
                    <View style={[styles.card, { backgroundColor: theme.dark ? "#111827" : "#FFFFFF" }]}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                {t("profile.developerSectionTitle", { defaultValue: "Developer Options" })}
                            </Text>
                        </View>
                        <View style={styles.cardBody}>
                            <Pressable
                                style={[
                                    styles.optionRow,
                                    {
                                        borderColor: theme.dark ? "#1F2937" : "#E2E8F0",
                                        backgroundColor: theme.dark ? "#111827" : "#F8FAFC",
                                        opacity: resettingOnboarding ? 0.6 : 1,
                                    },
                                ]}
                                onPress={handleResetOnboarding}
                                disabled={resettingOnboarding}
                            >
                                <View style={styles.optionContent}>
                                    <View style={[styles.optionIcon, { backgroundColor: "#EF4444" + "15" }]}>
                                        <IconSymbol name="arrow.counterclockwise" size={22} color="#EF4444" />
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={[styles.optionTitle, { color: colors.text }]}>
                                            {t("profile.resetOnboarding", { defaultValue: "Reset Onboarding" })}
                                        </Text>
                                        <Text style={[styles.optionDescription, { color: colors.muted }]}>
                                            {t("profile.resetOnboardingDescription", {
                                                defaultValue: "Reset onboarding and return to welcome screens immediately.",
                                            })}
                                        </Text>
                                    </View>
                                </View>
                                {resettingOnboarding && <ActivityIndicator size="small" color={colors.primary} />}
                            </Pressable>
                        </View>
                    </View>

                    {isUpdating && (
                        <View style={styles.updatingIndicator}>
                            <ActivityIndicator />
                            <Text style={[styles.updatingText, { color: colors.muted }]}>
                                {t("common.saving", { defaultValue: "Saving..." })}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTextContainer: {
        flex: 1,
        gap: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
    },
    headerSubtitle: {
        fontSize: 13,
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 16,
    },
    card: {
        borderRadius: 18,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        gap: 12,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cardHeaderText: {
        flex: 1,
        gap: 4,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
    },
    cardSubtitle: {
        fontSize: 12,
    },
    cardBody: {
        gap: 12,
    },
    optionRow: {
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    optionContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    optionTextContainer: {
        flex: 1,
        gap: 4,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: "600",
    },
    optionDescription: {
        fontSize: 12,
    },
    flag: {
        fontSize: 22,
    },
    toggleRow: {
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    toggleContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    toggleTextContainer: {
        flex: 1,
        gap: 4,
    },
    updatingIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 8,
    },
    updatingText: {
        fontSize: 13,
    },
});


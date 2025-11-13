import React, { useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useToast } from "@/components/Toast";
import { profileService } from "@/lib/services/profileService";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { type AppThemeColors } from "@/styles/theme";
import { BackButton } from "@/components/BackButton";
import { IconSymbol } from "@/components/IconSymbol";

export default function ExportDataScreen() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    const colors = theme.colors as AppThemeColors;

    const [exporting, setExporting] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);

    const onExport = async () => {
        try {
            setExporting(true);
            const response = await profileService.exportData();
            const successMessage =
                response?.message ||
                t("profile.exportSuccessMessage", {
                    defaultValue: "Your data export has been emailed to you.",
                });
            setLastMessage(successMessage);

            showToast({
                type: "success",
                title: t("common.success"),
                message: successMessage,
            });
        } catch (error: any) {
            const errorMessage =
                error?.response?.data?.error ||
                error?.message ||
                t("profile.exportErrorMessage", {
                    defaultValue: "We couldn’t start the export. Please try again shortly.",
                });

            setLastMessage(errorMessage);
            showToast({
                type: "error",
                title: t("common.error"),
                message: errorMessage,
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            {Platform.OS === "ios" && <Stack.Screen options={{ headerShown: false }} />}
            <SafeAreaView
                style={[
                    styles.container,
                    {
                        backgroundColor: colors.background,
                        paddingBottom: insets.bottom,
                    },
                ]}
                edges={["top"]}
            >
                <View style={styles.header}>
                    <BackButton onPress={() => router.back()} iconSize={22} />
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {t("profile.exportMyData", { defaultValue: "Export my data" })}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
                            {t("profile.exportSubtitle", {
                                defaultValue: "Request a copy of your personal data for your records.",
                            })}
                        </Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 32, paddingTop: insets.top },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.card, { backgroundColor: theme.dark ? "#111827" : "#FFFFFF" }]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.primary + "15" }]}>
                                <IconSymbol name="square.and.arrow.up" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    {t("profile.exportCardTitle", { defaultValue: "Request your personal data" })}
                                </Text>
                                <Text style={[styles.cardDescription, { color: colors.muted }]}>
                                    {t("profile.exportCardDescription", {
                                        defaultValue:
                                            "We will package your submissions, case files, and account activity into a download link delivered via email.",
                                    })}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            style={[
                                styles.primaryButton,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: exporting ? 0.7 : 1,
                                },
                            ]}
                            onPress={onExport}
                            disabled={exporting}
                        >
                            {exporting ? (
                                <ActivityIndicator color={colors.background} />
                            ) : (
                                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                                    {t("profile.exportCta", { defaultValue: "Submit export request" })}
                                </Text>
                            )}
                        </Pressable>

                        {lastMessage && (
                            <View style={styles.statusContainer}>
                                <Text style={[styles.statusText, { color: colors.muted }]}>{lastMessage}</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
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
        padding: 20,
        gap: 16,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    cardTextContainer: {
        flex: 1,
        gap: 6,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
    },
    cardDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    primaryButton: {
        alignSelf: "center",
        minWidth: "70%",
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: "700",
    },
    statusContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: "transparent",
        alignItems: "center",
    },
    statusText: {
        fontSize: 13,
        textAlign: "center",
    },
});

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Pressable,
    Text,
    Image,
    Dimensions,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import * as Sharing from "expo-sharing";
import { logger } from "@/lib/utils/logger";
import { Platform } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function DocumentPreviewScreen() {
    const params = useLocalSearchParams<{
        uri?: string;
        url?: string;
        title?: string;
        type?: string;
        mimeType?: string;
    }>();
    const router = useRouter();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { showAlert } = useBottomSheetAlert();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    // Use ref to prevent multiple attempts
    const hasAttemptedOpenRef = useRef(false);

    const uri = params.url || params.uri || "";
    const title = params.title || "Document Preview";
    const fileType = params.type?.toLowerCase() || "";
    const mimeType = params.mimeType?.toLowerCase() || "";

    // Determine if file is an image
    const isImage = useCallback(() => {
        if (!fileType && !mimeType) {
            const uriLower = uri.toLowerCase();
            return /\.(jpg|jpeg|png|gif|bmp|webp|heic|svg)$/i.test(uriLower);
        }
        const type = fileType || mimeType;
        return (
            type.includes("image") ||
            ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "svg"].some(
                (ext) => type.includes(ext),
            )
        );
    }, [fileType, mimeType, uri]);

    // Determine if file is a PDF
    const isPDF = useCallback(() => {
        if (!fileType && !mimeType) {
            const uriLower = uri.toLowerCase();
            return uriLower.includes(".pdf") || uriLower.includes("pdf");
        }
        const type = fileType || mimeType;
        return type.includes("pdf");
    }, [fileType, mimeType, uri]);

    const isImageFile = isImage();
    const isPDFFile = isPDF();
    const isRemoteUri = uri.startsWith("http://") || uri.startsWith("https://");

    // Handle remote URIs - open directly with Linking.openURL() like template preview
    useEffect(() => {
        if (isRemoteUri && uri && !hasAttemptedOpenRef.current) {
            hasAttemptedOpenRef.current = true;
            const openRemoteUri = async () => {
                try {
                    setLoading(true);
                    const canOpen = await Linking.canOpenURL(uri);

                    if (!canOpen) {
                        showAlert({
                            title: t("documents.previewUnavailableTitle", {
                                defaultValue: "Preview unavailable",
                            }),
                            message: t("documents.previewUnavailableMessage", {
                                defaultValue:
                                    "We could not open this file. Please download it instead.",
                            }),
                            actions: [{ text: t("common.close"), variant: "primary" }],
                        });
                        setError("Cannot open this file");
                        setLoading(false);
                        return;
                    }

                    await Linking.openURL(uri);
                    // Navigate back after opening
                    setTimeout(() => {
                        router.back();
                    }, 500);
                } catch (error: any) {
                    logger.error("Failed to open remote URI", error);
                    showAlert({
                        title: t("documents.previewUnavailableTitle", {
                            defaultValue: "Preview unavailable",
                        }),
                        message:
                            error?.message ||
                            t("documents.previewUnavailableMessage", {
                                defaultValue:
                                    "We could not open this file. Please download it instead.",
                            }),
                        actions: [{ text: t("common.close"), variant: "primary" }],
                    });
                    setError("Failed to open file");
                    setLoading(false);
                }
            };
            openRemoteUri();
        }
    }, [isRemoteUri, uri, router, showAlert, t]);

    // Handle local files - use Sharing API for Android, Linking for iOS
    useEffect(() => {
        if (
            uri.startsWith("file://") &&
            !hasAttemptedOpenRef.current &&
            !isRemoteUri
        ) {
            hasAttemptedOpenRef.current = true;
            const openLocalFile = async () => {
                try {
                    setLoading(true);

                    // On Android, use Sharing API which works with private directories
                    if (Platform.OS === "android") {
                        const isAvailable = await Sharing.isAvailableAsync();
                        if (isAvailable) {
                            await Sharing.shareAsync(uri, {
                                mimeType: isPDFFile
                                    ? "application/pdf"
                                    : mimeType || "application/octet-stream",
                                dialogTitle: isPDFFile ? "Open PDF" : "Open File",
                                UTI: isPDFFile ? "com.adobe.pdf" : undefined,
                            });
                            setTimeout(() => {
                                router.back();
                            }, 500);
                            return;
                        }
                    }

                    // On iOS, try Linking directly
                    const canOpen = await Linking.canOpenURL(uri);
                    if (canOpen) {
                        await Linking.openURL(uri);
                        setTimeout(() => {
                            router.back();
                        }, 500);
                    } else {
                        throw new Error("Cannot open file");
                    }
                } catch (error: any) {
                    logger.error("Failed to open local file", error);
                    showAlert({
                        title: t("documents.previewUnavailableTitle", {
                            defaultValue: "Preview unavailable",
                        }),
                        message:
                            error?.message ||
                            t("documents.previewUnavailableMessage", {
                                defaultValue:
                                    "We could not open this file. Please download it instead.",
                            }),
                        actions: [{ text: t("common.close"), variant: "primary" }],
                    });
                    setError("Failed to open file");
                    setLoading(false);
                }
            };
            openLocalFile();
        }
    }, [uri, router, isRemoteUri, isPDFFile, mimeType, showAlert, t]);

    const handleImageError = useCallback(() => {
        setImageError(true);
        setLoading(false);
    }, []);

    const handleImageLoad = useCallback(() => {
        setLoading(false);
        setImageError(false);
    }, []);

    // Render images (only for local images that weren't opened externally)
    const renderImage = () => {
        if (!uri.startsWith("file://")) {
            return null;
        }

        if (imageError) {
            return (
                <View style={styles.centerContainer}>
                    <IconSymbol
                        name="exclamationmark.triangle"
                        size={48}
                        color={colors.danger}
                    />
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                        {t("documents.previewError", {
                            defaultValue: "Failed to load image",
                        })}
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: colors.background }]}
            edges={["top"]}
        >
            <Stack.Screen
                options={{
                    title,
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                    headerTintColor: colors.text,
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [
                                styles.backButton,
                                pressed && { opacity: 0.6 },
                            ]}
                        >
                            <IconSymbol
                                name="chevron.left"
                                size={24}
                                color={colors.text}
                            />
                        </Pressable>
                    ),
                }}
            />

            {error && (
                <View style={styles.errorContainer}>
                    <IconSymbol
                        name="exclamationmark.triangle"
                        size={32}
                        color={colors.danger}
                    />
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                        {error}
                    </Text>
                    <Pressable
                        onPress={() => router.back()}
                        style={[styles.errorButton, { backgroundColor: colors.primary }]}
                    >
                        <Text style={[styles.errorButtonText, { color: colors.background }]}>
                            {t("common.close")}
                        </Text>
                    </Pressable>
                </View>
            )}

            {!error && (
                <View style={styles.content}>
                    {/* Show loading while opening externally */}
                    {(isRemoteUri || uri.startsWith("file://")) && !isImageFile && (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                                {t("common.opening", { defaultValue: "Opening..." })}
                            </Text>
                        </View>
                    )}

                    {/* Show local images in-app */}
                    {isImageFile && uri.startsWith("file://") && renderImage()}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    imageContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
    },
    image: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: "center",
    },
    errorButton: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    errorButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    loadingText: {
        fontSize: 14,
        textAlign: "center",
    },
});

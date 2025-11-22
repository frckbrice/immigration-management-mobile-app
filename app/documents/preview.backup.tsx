import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Pressable,
    Text,
    Image,
    Dimensions,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { useTranslation } from "@/lib/hooks/useTranslation";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { logger } from "@/lib/utils/logger";

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

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [webViewHtml, setWebViewHtml] = useState<string | null>(null);
    const [openingExternally, setOpeningExternally] = useState(false);

    // Use ref to prevent infinite loops
    const hasAttemptedOpenRef = useRef(false);

    const uri = params.uri || params.url || "";
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

    // Handle remote URIs - open them in browser using expo-web-browser
    // This opens directly in browser without showing chooser dialogs
    useEffect(() => {
        if (isRemoteUri && uri && !hasAttemptedOpenRef.current) {
            hasAttemptedOpenRef.current = true;
            const openExternally = async () => {
                try {
                    setOpeningExternally(true);
                    setLoading(true);

                    // Use expo-web-browser to open in system browser
                    // This prevents Android from showing app chooser dialog
                    await WebBrowser.openBrowserAsync(uri, {
                        showTitle: true,
                        toolbarColor: colors.background,
                        controlsColor: colors.primary,
                        enableBarCollapsing: false,
                        showInRecents: true,
                    });

                    // Navigate back after opening
                    setTimeout(() => {
                        router.back();
                    }, 500);
                } catch (error: any) {
                    logger.error("Failed to open remote URI with WebBrowser", error);
                    // Fallback to Linking API if WebBrowser fails
                    try {
                        const canOpen = await Linking.canOpenURL(uri);
                        if (canOpen) {
                            await Linking.openURL(uri);
                            setTimeout(() => {
                                router.back();
                            }, 500);
                        } else {
                            setError("Cannot open this file. Please install an appropriate viewer.");
                            setOpeningExternally(false);
                            setLoading(false);
                        }
                    } catch (linkError: any) {
                        logger.error("Failed to open remote URI with Linking fallback", linkError);
                        setError("Failed to open file");
                        setOpeningExternally(false);
                        setLoading(false);
                    }
                }
            };
            openExternally();
        }
    }, [isRemoteUri, uri, router, colors.background, colors.primary]);

    // Handle local PDF files - use Sharing API for Android (works with private directories)
    // On iOS, fall back to base64 embedding in WebView since Sharing doesn't open directly
    useEffect(() => {
        if (isPDFFile && uri.startsWith("file://") && !hasAttemptedOpenRef.current && !openingExternally) {
            hasAttemptedOpenRef.current = true;
            const handleLocalPdf = async () => {
                try {
                    setLoading(true);

                    // On Android, use Sharing API which can handle private app directories
                    if (Platform.OS === "android") {
                        const isAvailable = await Sharing.isAvailableAsync();
                        if (isAvailable) {
                            setOpeningExternally(true);
                            await Sharing.shareAsync(uri, {
                                mimeType: "application/pdf",
                                dialogTitle: "Open PDF",
                                UTI: "com.adobe.pdf",
                            });
                            // Navigate back after sharing
                            setTimeout(() => {
                                router.back();
                            }, 500);
                            return;
                        }
                    }

                    // Fallback: For iOS or if sharing fails, use base64 embedding in WebView
                    const base64 = await FileSystem.readAsStringAsync(uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100vh; overflow: hidden; background: #1a1a1a; }
iframe { width: 100%; height: 100%; display: block; border: none; }
</style>
</head>
<body>
<iframe src="data:application/pdf;base64,${base64}#toolbar=0&navpanes=0&scrollbar=0" type="application/pdf"></iframe>
</body>
</html>`;
                    setWebViewHtml(html);
                    setLoading(false);
                } catch (error: any) {
                    logger.error("Failed to handle local PDF", error);
                    setError("Failed to load PDF file");
                    setLoading(false);
                }
            };
            handleLocalPdf();
        }
    }, [isPDFFile, uri, router]);

    const handleImageError = useCallback(() => {
        setImageError(true);
        setLoading(false);
    }, []);

    const handleImageLoad = useCallback(() => {
        setLoading(false);
        setImageError(false);
    }, []);

    const handleWebViewLoad = useCallback(() => {
        setLoading(false);
        setError(null);
    }, []);

    const handleWebViewError = useCallback((syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        logger.error("WebView error", nativeEvent);
        setError(nativeEvent?.description || "Failed to load document");
        setLoading(false);
    }, []);

    // Render PDF content
    const renderPDF = () => {
        // Remote PDFs or Android local PDFs opening externally - show loading message
        if (isRemoteUri || openingExternally) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                        {t("documents.openingPDF", { defaultValue: "Opening PDF..." })}
                    </Text>
                </View>
            );
        }

        // Local PDFs with base64 HTML embedding (iOS fallback) - render in WebView
        if (webViewHtml) {
            return (
                <WebView
                    source={{ html: webViewHtml }}
                    style={styles.webView}
                    onLoad={handleWebViewLoad}
                    onError={handleWebViewError}
                    onLoadEnd={() => {
                        setLoading(false);
                        setError(null);
                    }}
                    onLoadStart={() => {
                        setLoading(true);
                    }}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                                {t("common.loading", { defaultValue: "Loading PDF..." })}
                            </Text>
                        </View>
                    )}
                    scalesPageToFit={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    originWhitelist={['*']}
                    allowFileAccess={true}
                    allowUniversalAccessFromFileURLs={true}
                    mixedContentMode="always"
                />
            );
        }

        // Loading state while preparing PDF
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                    {t("common.loading", { defaultValue: "Loading PDF..." })}
                </Text>
            </View>
        );
    };

    // Render images
    const renderImage = () => {
        // Remote images - open externally
        if (isRemoteUri || openingExternally) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                        {t("common.opening", { defaultValue: "Opening..." })}
                    </Text>
                </View>
            );
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

    // Render other file types (documents, etc.)
    const renderOther = () => {
        // Remote files - open externally
        if (isRemoteUri || openingExternally) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.muted, marginTop: 16 }]}>
                        {t("common.opening", { defaultValue: "Opening..." })}
                    </Text>
                </View>
            );
        }

        // Local files - use WebView directly with file:// URI
        if (uri.startsWith("file://")) {
            return (
                <WebView
                    source={{ uri }}
                    style={styles.webView}
                    onLoad={handleWebViewLoad}
                    onError={handleWebViewError}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    )}
                    scalesPageToFit={true}
                    javaScriptEnabled={true}
                    originWhitelist={['*']}
                    allowFileAccess={true}
                    allowUniversalAccessFromFileURLs={true}
                />
            );
        }

        // Fallback loading state
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
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
                    {isImageFile && renderImage()}
                    {isPDFFile && !isImageFile && renderPDF()}
                    {!isImageFile && !isPDFFile && renderOther()}
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
    webView: {
        flex: 1,
        backgroundColor: "transparent",
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

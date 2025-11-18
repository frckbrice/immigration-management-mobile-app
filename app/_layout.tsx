import React, { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useColorScheme, View, Text, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
// Safely import SystemBars with fallback
let SystemBars: React.ComponentType<{ style: "light" | "dark" }> | null = null;
try {
    const edgeToEdgeModule = require("react-native-edge-to-edge");
    SystemBars = edgeToEdgeModule?.SystemBars || null;
} catch (error) {
    console.warn('SystemBars not available, will skip rendering', error);
}
import { ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "react-native-reanimated";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { initializeAuthListener, useAuthStore } from "@/stores/auth/authStore";
import { logger } from "@/lib/utils/logger";
import { setupNotificationListeners, getLastNotificationResponse, handleNotificationNavigation } from "@/lib/services/pushNotifications";
import { BottomSheetAlertProvider } from "@/components/BottomSheetAlert";
import { ToastProvider } from "@/components/Toast";
import { useToast } from "@/components/Toast";
import { ScrollProvider } from "@/contexts/ScrollContext";
import { palette, themes } from "@/styles/theme";
import "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings/settingsStore";
import { presenceService } from "@/lib/services/presenceService";
import i18n from "@/lib/i18n";


// Error Boundary Component
class ErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        logger?.error('App Error Boundary:', { error: error.message, stack: error.stack, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>{i18n.t('errors.somethingWentWrong')}</Text>
                    <Text style={styles.errorText}>{this.state.error?.message || i18n.t('common.unknownError')}</Text>
                    <Text style={styles.errorHint}>{i18n.t('errors.restartApp')}</Text>
                </View>
            );
        }

        return this.props.children;
    }
}

SplashScreen.preventAutoHideAsync();

// Debug: Log that the layout file is being loaded
console.log('[App] _layout.tsx loaded');

// Create React Query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
});

function AppContent() {
    console.log('[App] AppContent rendering');

    // Safely get color scheme with fallback
    let colorScheme: 'light' | 'dark' | null | undefined = 'light';
    try {
        const scheme = useColorScheme();
        // Handle 'unspecified' and null cases
        colorScheme = (scheme === 'light' || scheme === 'dark') ? scheme : 'light';
    } catch (error) {
        console.warn('Failed to get color scheme, using light as default', error);
        colorScheme = 'light';
    }

    const [loaded] = useFonts({
        SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
    });

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const registerPushToken = useAuthStore((state) => state.registerPushToken);
    const settings = useSettingsStore((state) => state.settings);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const { showToast } = useToast();

    console.log('[App] AppContent state:', { loaded, isAuthenticated });

    useEffect(() => {
        // Hide splash screen after fonts load, or after a timeout
        if (loaded) {
            SplashScreen.hideAsync();
        } else {
            // Fallback: hide splash screen after 2 seconds even if fonts haven't loaded
            const timeout = setTimeout(() => {
                SplashScreen.hideAsync();
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [loaded]);

    useEffect(() => {
        // Initialize auth state listener on app start
        initializeAuthListener();
        logger.info('App layout initialized');

        // Temporarily disabled presence tracking to test app functionality
        // const cleanupPresence = presenceService.initializePresenceTracking();
        // return () => {
        //     cleanupPresence?.();
        // };
    }, []);

    useEffect(() => {
        if (!settings) {
            fetchSettings();
        }
    }, [settings, fetchSettings]);

    // Setup push notifications
    useEffect(() => {
        let cleanup: (() => void) | undefined;

        const setupNotifications = async () => {
            // Setup notification listeners
            cleanup = setupNotificationListeners({
                onNotificationReceived: ({ notification, data }) => {
                    const title = notification.request.content.title?.trim() || i18n.t('notifications.newNotification');
                    const body = notification.request.content.body?.trim();
                    const fallbackMessage =
                        typeof data?.message === 'string' && data.message.trim().length > 0
                            ? data.message.trim()
                            : undefined;
                    const message = body || fallbackMessage || i18n.t('notifications.openAppMessage');

                    showToast({
                        title,
                        message,
                        duration: 5000,
                    });
                },
            });

            // Check for cold start notification
            const lastNotification = await getLastNotificationResponse();
            if (lastNotification) {
                logger.info('App opened from notification', lastNotification);
                await handleNotificationNavigation(lastNotification);
            }
        };

        setupNotifications();

        return () => {
            if (cleanup) cleanup();
        };
    }, [showToast]);

    // Register push token when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            // Defer push token registration to avoid blocking UI
            setTimeout(() => {
                registerPushToken();
            }, 2000);
        }
    }, [isAuthenticated, registerPushToken]);

    // Render app even if fonts haven't loaded yet (they'll load asynchronously)
    const themePreference = settings?.themePreference ?? 'system';
    const resolvedTheme = themePreference === 'system' ? colorScheme ?? 'light' : themePreference;
    const isDarkTheme = resolvedTheme === 'dark';
    const activeTheme = isDarkTheme ? themes.dark : themes.light;

    return (
        <ThemeProvider value={activeTheme}>
            {SystemBars && <SystemBars style={isDarkTheme ? "light" : "dark"} />}
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="getstarted" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="forgot-password" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="chat" />
                <Stack.Screen name="case/[id]" />
                <Stack.Screen name="cases/new" />
                <Stack.Screen name="documents/upload" />
                <Stack.Screen name="modal" options={{ presentation: "modal" }} />
                <Stack.Screen name="formsheet" options={{ presentation: "formSheet" }} />
                <Stack.Screen name="transparent-modal" options={{ presentation: "transparentModal" }} />
            </Stack>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        </ThemeProvider>
    );
}

export default function RootLayout() {
    console.log('[App] RootLayout rendering');

    try {
        return (
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <ScrollProvider>
                            <BottomSheetAlertProvider>
                                <ToastProvider>
                                    <WidgetProvider>
                                        <AppContent />
                                    </WidgetProvider>
                                </ToastProvider>
                            </BottomSheetAlertProvider>
                        </ScrollProvider>
                    </GestureHandlerRootView>
                </QueryClientProvider>
            </ErrorBoundary>
        );
    } catch (error) {
        console.error('[App] RootLayout error:', error);
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>{i18n.t('errors.rootLayoutError')}</Text>
                <Text style={styles.errorText}>{error instanceof Error ? error.message : i18n.t('common.unknownError')}</Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: palette.background,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: palette.danger,
    },
    errorText: {
        fontSize: 14,
        color: palette.textMuted,
        textAlign: 'center',
        marginBottom: 20,
    },
    errorHint: {
        fontSize: 12,
        color: palette.textSecondary,
        fontStyle: 'italic',
    },
});



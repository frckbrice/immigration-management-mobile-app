import React, { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useColorScheme, View, Text, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SystemBars } from "react-native-edge-to-edge";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "react-native-reanimated";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { initializeAuthListener, useAuthStore } from "@/stores/auth/authStore";
import { logger } from "@/lib/utils/logger";
import { setupNotificationListeners, getLastNotificationResponse, handleNotificationNavigation } from "@/lib/services/pushNotifications";
import { BottomSheetAlertProvider } from "@/components/BottomSheetAlert";
import { ScrollProvider } from "@/contexts/ScrollContext";
import "@/lib/i18n";

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
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <Text style={styles.errorText}>{this.state.error?.message || 'Unknown error'}</Text>
                    <Text style={styles.errorHint}>Please restart the app</Text>
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

    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
    });

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const registerPushToken = useAuthStore((state) => state.registerPushToken);

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
    }, []);

    // Setup push notifications
    useEffect(() => {
        let cleanup: (() => void) | undefined;

        const setupNotifications = async () => {
            // Setup notification listeners
            cleanup = setupNotificationListeners();

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
    }, []);

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
    return (
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <SystemBars style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
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
                                <WidgetProvider>
                                    <AppContent />
                                </WidgetProvider>
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
                <Text style={styles.errorTitle}>Root Layout Error</Text>
                <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Unknown error'}</Text>
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
        backgroundColor: '#F5F6F7',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#EF4444',
    },
    errorText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    errorHint: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
});



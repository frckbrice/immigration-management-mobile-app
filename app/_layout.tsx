import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
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
import "@/lib/i18n";

SplashScreen.preventAutoHideAsync();

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
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
    });

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const registerPushToken = useAuthStore((state) => state.registerPushToken);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
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

    if (!loaded) {
        return null;
    }

    return (
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <SystemBars style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
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
    return (
        <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <WidgetProvider>
                    <AppContent />
                </WidgetProvider>
            </GestureHandlerRootView>
        </QueryClientProvider>
    );
}



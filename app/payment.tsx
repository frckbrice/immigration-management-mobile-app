// Fallback payment screen for Expo Router
// This file is required when using platform-specific files (.native.tsx, .web.tsx)
// It will be used as a fallback for platforms that don't match .native or .web

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";

export default function PaymentScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <View style={styles.content}>
        <IconSymbol name="creditcard.fill" size={64} color="#2196F3" />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Payment Screen
        </Text>
        <Text style={[styles.message, { color: theme.dark ? "#999" : "#666" }]}>
          Please use the platform-specific payment screen
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: "#2196F3" }]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

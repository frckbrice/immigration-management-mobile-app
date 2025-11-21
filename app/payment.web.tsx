import React from "react";
import { ScrollView, Pressable, StyleSheet, View, Text } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { BackButton } from "@/components/BackButton";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function PaymentScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Get payment details from params or use defaults
  const amount = params.amount ? parseFloat(params.amount as string) : 100.0;
  const description = (params.description as string) || "Case Processing Fee";
  const caseReference =
    (params.referenceNumber as string) ||
    (params.caseNumber as string) ||
    "PT-REF-0000";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} iconSize={24} />
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {t("payments.title")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Summary Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.dark ? "#1C1C1E" : "#fff" },
          ]}
        >
          <View style={styles.summaryHeader}>
            <IconSymbol name="creditcard.fill" size={32} color="#2196F3" />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {t("payments.paymentSummary")}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryLabel,
                { color: theme.dark ? "#999" : "#666" },
              ]}
            >
              {t("payments.caseReference")}:
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {caseReference}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryLabel,
                { color: theme.dark ? "#999" : "#666" },
              ]}
            >
              {t("payments.description")}:
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {description}
            </Text>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.dark ? "#333" : "#E0E0E0" },
            ]}
          />

          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
              {t("payments.totalAmount")}:
            </Text>
            <Text style={[styles.totalValue, { color: "#2196F3" }]}>
              ${amount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Web Not Supported Notice */}
        <View
          style={[
            styles.notSupportedCard,
            { backgroundColor: theme.dark ? "#1C1C1E" : "#fff" },
          ]}
        >
          <View style={styles.iconContainer}>
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={48}
              color="#FF9800"
            />
          </View>

          <Text
            style={[styles.notSupportedTitle, { color: theme.colors.text }]}
          >
            {t("payments.web.notAvailable")}
          </Text>

          <Text
            style={[
              styles.notSupportedText,
              { color: theme.dark ? "#999" : "#666" },
            ]}
          >
            {t("payments.web.notAvailableMessage")}
          </Text>

          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.dark ? "#2C2C2E" : "#F5F5F5" },
            ]}
          >
            <IconSymbol name="info.circle.fill" size={20} color="#2196F3" />
            <Text
              style={[
                styles.infoBoxText,
                { color: theme.dark ? "#999" : "#666" },
              ]}
            >
              {t("payments.web.downloadApp")}
            </Text>
          </View>
        </View>

        {/* Alternative Options */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.dark ? "#1C1C1E" : "#fff" },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t("payments.web.alternativeOptions")}
          </Text>

          <View style={styles.optionItem}>
            <IconSymbol name="apps.iphone" size={24} color="#2196F3" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                {t("payments.web.useMobileApp")}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  { color: theme.dark ? "#999" : "#666" },
                ]}
              >
                {t("payments.web.useMobileAppDescription")}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.dark ? "#333" : "#E0E0E0" },
            ]}
          />

          <View style={styles.optionItem}>
            <IconSymbol name="envelope.fill" size={24} color="#4CAF50" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                {t("payments.web.contactSupport")}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  { color: theme.dark ? "#999" : "#666" },
                ]}
              >
                {t("payments.web.contactSupportDescription")}
              </Text>
            </View>
          </View>
        </View>

        {/* Back Button */}
        <Pressable
          style={[styles.backToHomeButton, { backgroundColor: "#2196F3" }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={20} color="#fff" />
          <Text style={styles.backToHomeText}>{t("payments.web.goBack")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 40, height: 40 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  notSupportedCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 16,
  },
  notSupportedTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  notSupportedText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  infoBoxText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  optionContent: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  backToHomeButton: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backToHomeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
});

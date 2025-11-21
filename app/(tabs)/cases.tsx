import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  TextInput,
  Platform,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { BackButton } from "@/components/BackButton";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { useShallow } from "zustand/react/shallow";
import { useScrollContext } from "@/contexts/ScrollContext";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useToast } from "@/components/Toast";

type CaseFilter = "all" | "active" | "action-required" | "complete";

const formatServiceTypeLabel = (serviceType?: string) =>
  serviceType
    ? serviceType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/(^|\s)\w/g, (char) => char.toUpperCase())
    : "";

const formatDateLabel = (date?: string) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString();
};

const normalizeStatus = (status?: string | null) =>
  (status ?? "").toLowerCase();

export default function CasesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<CaseFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { cases, isLoading, error, fetchCases, clearError } = useCasesStore(
    useShallow((state) => ({
      cases: state.cases,
      isLoading: state.isLoading,
      error: state.error,
      fetchCases: state.fetchCases,
      clearError: state.clearError,
    })),
  );
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const uploadableCases = useMemo(
    () =>
      cases.filter((caseItem) => {
        const status = (caseItem.status || "").toUpperCase();
        return (
          status !== "CLOSED" && status !== "REJECTED" && status !== "APPROVED"
        );
      }),
    [cases],
  );
  const { setScrollDirection, setAtBottom } = useScrollContext();
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterOptions = useMemo(
    () => [
      { key: "all" as CaseFilter, label: t("cases.filterAll") },
      { key: "active" as CaseFilter, label: t("cases.filterActive") },
      {
        key: "action-required" as CaseFilter,
        label: t("cases.filterActionRequired", {
          defaultValue: "Action required",
        }),
      },
      {
        key: "complete" as CaseFilter,
        label: t("cases.filterComplete", { defaultValue: "Completed" }),
      },
    ],
    [t],
  );

  const contentPaddingBottom = useMemo(
    () => insets.bottom + 160,
    [insets.bottom],
  );

  const fabBottom = useMemo(
    () => insets.bottom + (Platform.OS === "ios" ? 90 : 110),
    [insets.bottom],
  );

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(home)");
    }
  }, [router]);

  const buildFilters = useCallback(() => {
    const filters: { status?: string } = {};
    if (selectedFilter === "active") {
      filters.status = "active";
    } else if (selectedFilter === "action-required") {
      filters.status = "DOCUMENTS_REQUIRED";
    } else if (selectedFilter === "complete") {
      filters.status = "APPROVED";
    }
    return filters;
  }, [selectedFilter]);

  useEffect(() => {
    fetchCases(buildFilters());
  }, [fetchCases, buildFilters]);

  useEffect(() => {
    if (error) {
      // Clear error after 5 seconds
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const getStatusColor = useCallback(
    (status: string) => {
      const normalized = normalizeStatus(status);
      switch (normalized) {
        case "documents_required":
          return colors.warning;
        case "approved":
          return colors.success;
        case "rejected":
        case "closed":
          return colors.muted;
        case "submitted":
        case "under_review":
        case "processing":
          return colors.primary;
        default:
          return colors.mutedAlt;
      }
    },
    [colors],
  );

  const getStatusLabel = useCallback(
    (status: string) => {
      const normalized = normalizeStatus(status);
      switch (normalized) {
        case "documents_required":
          return t("cases.documentsRequired");
        case "approved":
          return t("cases.approved");
        case "submitted":
          return t("cases.submitted");
        case "under_review":
          return t("cases.underReview");
        case "processing":
          return t("cases.processing");
        case "rejected":
          return t("cases.rejected");
        case "closed":
          return t("cases.closed", { defaultValue: "Closed" });
        default:
          return t("cases.statusUnknown", { defaultValue: "Unknown status" });
      }
    },
    [t],
  );

  const handleRefresh = useCallback(() => {
    return fetchCases(buildFilters());
  }, [fetchCases, buildFilters]);

  const handleUploadNavigation = useCallback(() => {
    if (uploadableCases.length === 0) {
      showToast({
        title: t("documents.uploadUnavailableTitle", {
          defaultValue: "Unable to upload",
        }),
        message: t("documents.uploadUnavailableMessage", {
          defaultValue:
            "All of your cases are closed or rejected. Create a new case to upload documents.",
        }),
        type: "info",
      });
      showAlert({
        title: t("documents.uploadUnavailableTitle", {
          defaultValue: "Unable to upload",
        }),
        message: t("documents.uploadUnavailableMessage", {
          defaultValue:
            "All of your cases are closed or rejected. Create a new case to upload documents.",
        }),
        actions: [{ text: t("common.close"), variant: "primary" }],
      });
      return;
    }
    router.push("/documents/upload");
  }, [uploadableCases.length, router, showAlert, showToast, t]);

  const handleTemplateNavigation = useCallback(() => {
    router.push({
      pathname: "/(tabs)/documents",
      params: { tab: "templates" },
    });
  }, [router]);

  const handleCasePress = useCallback(
    (caseItem: any) => {
      router.push({ pathname: "/case/[id]", params: { id: caseItem.id } });
    },
    [router],
  );

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View
          style={[
            styles.searchContainer,
            styles.block,
            {
              backgroundColor: theme.dark ? "#111827" : colors.surface,
              borderColor: colors.accent,
              borderWidth: StyleSheet.hairlineWidth,
              shadowColor: "green",
            },
          ]}
        >
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t("cases.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearchQuery("")}
              style={styles.searchClearButton}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={18}
                color={colors.muted}
              />
            </Pressable>
          )}
        </View>

        <View style={[styles.filterRow, styles.block]}>
          {filterOptions.map((filter) => {
            const isActive = selectedFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                accessibilityRole="button"
                onPress={() => setSelectedFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? withOpacity(colors.primary, theme.dark ? 0.32 : 0.16)
                      : theme.dark
                        ? colors.surfaceElevated
                        : colors.surfaceAlt,
                    borderColor: isActive
                      ? withOpacity(colors.primary, theme.dark ? 0.7 : 0.8)
                      : withOpacity(
                          colors.borderStrong,
                          theme.dark ? 0.5 : 0.5,
                        ),
                    borderWidth: StyleSheet.hairlineWidth * 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? colors.primary : colors.muted,
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.actionButtons, styles.block]}>
          <Pressable
            style={[
              styles.actionButton,
              styles.actionButtonFirst,
              {
                backgroundColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.22 : 0.1,
                ),
                borderColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.6 : 0.28,
                ),
              },
            ]}
            onPress={handleUploadNavigation}
          >
            <IconSymbol name="doc.fill" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              {t("documents.upload")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionButton,
              {
                backgroundColor: withOpacity(
                  colors.accent,
                  theme.dark ? 0.22 : 0.12,
                ),
                borderColor: withOpacity(
                  colors.accent,
                  theme.dark ? 0.55 : 0.28,
                ),
              },
            ]}
            onPress={handleTemplateNavigation}
          >
            <IconSymbol
              name="arrow.down.doc.fill"
              size={22}
              color={colors.accent}
            />
            <Text style={[styles.actionButtonText, { color: colors.accent }]}>
              {t("documents.downloadTemplates")}
            </Text>
          </Pressable>
        </View>

        {error ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleRefresh}
            style={[
              styles.errorContainer,
              {
                backgroundColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.25 : 0.1,
                ),
                borderColor: withOpacity(
                  colors.danger,
                  theme.dark ? 0.55 : 0.3,
                ),
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [
      colors,
      theme.dark,
      searchQuery,
      t,
      filterOptions,
      selectedFilter,
      handleUploadNavigation,
      handleTemplateNavigation,
      error,
      handleRefresh,
    ],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredCases = useMemo(() => {
    let result = cases;

    // Apply filter based on selectedFilter
    if (selectedFilter !== "all") {
      result = result.filter((item) => {
        const status = normalizeStatus(item.status);

        switch (selectedFilter) {
          case "active":
            // Active cases: submitted, under_review, processing, documents_required
            return [
              "submitted",
              "under_review",
              "processing",
              "documents_required",
            ].includes(status);
          case "action-required":
            // Action required: documents_required or action-required
            return (
              status === "documents_required" || status === "action-required"
            );
          case "complete":
            // Complete: approved
            return status === "approved";
          default:
            return true;
        }
      });
    }

    // Apply search filter if search query exists
    if (normalizedSearch) {
      result = result.filter((item) => {
        const haystacks = [
          item.referenceNumber,
          item.displayName,
          item.serviceType,
          item.client?.firstName
            ? `${item.client.firstName} ${item.client.lastName ?? ""}`
            : "",
          item.client?.email ?? "",
          item.assignedAgent
            ? `${item.assignedAgent.firstName ?? ""} ${item.assignedAgent.lastName ?? ""}`
            : "",
          item.assignedAgent?.email ?? "",
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return haystacks.some((value) => value.includes(normalizedSearch));
      });
    }

    return result;
  }, [cases, selectedFilter, normalizedSearch]);

  const listEmptyComponent = useMemo(
    () =>
      isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <IconSymbol
            name="folder.fill"
            size={64}
            color={theme.dark ? colors.mutedAlt : colors.muted}
          />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {normalizedSearch
              ? t("cases.noMatches", {
                  defaultValue: "No cases match your search.",
                })
              : t("cases.noCases")}
          </Text>
        </View>
      ),
    [isLoading, colors, theme.dark, t, normalizedSearch],
  );

  const renderCaseItem = useCallback(
    ({ item }: { item: any }) => {
      const statusColor = getStatusColor(item.status);
      const progressValue = Math.min(
        Math.max(Number(item.progress) || 0, 0),
        100,
      );
      return (
        <Pressable
          style={[
            styles.caseCard,
            {
              backgroundColor: theme.dark ? "#111827" : colors.surface,
              borderColor: withOpacity(
                colors.borderStrong,
                theme.dark ? 0.35 : 0.16,
              ),
              shadowColor: colors.backdrop,
            },
          ]}
          onPress={() => handleCasePress(item)}
        >
          <View style={styles.caseHeader}>
            <View style={styles.caseHeaderLeft}>
              <Text style={[styles.caseTitle, { color: colors.text }]}>
                {item.displayName ||
                  formatServiceTypeLabel(item.serviceType) ||
                  t("cases.title")}
              </Text>
              <Text style={[styles.caseNumber, { color: colors.muted }]}>
                {item.referenceNumber}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: withOpacity(
                    statusColor,
                    theme.dark ? 0.35 : 0.15,
                  ),
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>
                {t("cases.progress")}
              </Text>
              <Text style={[styles.progressPercentage, { color: colors.text }]}>
                {progressValue}%
              </Text>
            </View>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: withOpacity(
                    colors.muted,
                    theme.dark ? 0.3 : 0.15,
                  ),
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressValue}%`,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.lastUpdated, { color: colors.muted }]}>
              {t("cases.lastUpdated")}: {formatDateLabel(item.lastUpdated)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [colors, theme.dark, getStatusColor, getStatusLabel, handleCasePress, t],
  );

  const listFooterComponent = useMemo(() => <View style={{ height: 8 }} />, []);

  useEffect(() => {
    setAtBottom(true);
    setScrollDirection(false);
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [setAtBottom, setScrollDirection]);

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
        style={[
          styles.container,
          {
            backgroundColor: theme.dark ? "#1f2937" : colors.background,
            paddingBottom: insets.bottom,
            paddingTop: insets.top,
          },
        ]}
        edges={["top"]}
      >
        <View style={styles.header}>
          <BackButton onPress={handleBackPress} iconSize={22} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("cases.title")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {t("cases.subtitle", {
                defaultValue:
                  "Review your case progress and take action quickly.",
              })}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/notifications")}
            style={[
              styles.headerAction,
              {
                backgroundColor: withOpacity(
                  colors.primary,
                  theme.dark ? 0.22 : 0.12,
                ),
              },
            ]}
          >
            <IconSymbol name="bell.fill" size={22} color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={filteredCases}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCaseItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: contentPaddingBottom, paddingTop: 12 },
          ]}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={listEmptyComponent}
          ListFooterComponent={listFooterComponent}
          refreshing={isLoading && cases.length > 0}
          onRefresh={handleRefresh}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, layoutMeasurement, contentSize } =
              event.nativeEvent;
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
              const currentY = contentOffset.y;
              const isAtBottom =
                currentY + layoutMeasurement.height >= contentSize.height - 50;
              setAtBottom(isAtBottom);
              const diff = currentY - lastScrollYRef.current;
              if (Math.abs(diff) > 5) {
                setScrollDirection(diff > 0);
                lastScrollYRef.current = currentY;
              }
            }, 50);
          }}
          scrollEventThrottle={16}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={10}
          removeClippedSubviews
        />

        <Pressable
          style={[
            styles.fab,
            {
              bottom: fabBottom,
              backgroundColor: colors.primary,
              shadowColor: colors.backdrop,
            },
          ]}
          onPress={() => router.push("/cases/new")}
        >
          <IconSymbol name="plus" size={28} color={colors.onPrimary} />
        </Pressable>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listHeader: {
    paddingBottom: 8,
  },
  block: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
  },
  searchClearButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionButtonFirst: {
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
  caseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  caseHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  caseNumber: {
    fontSize: 13,
    letterSpacing: 0.15,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 14,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  lastUpdated: {
    fontSize: 12,
    marginTop: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 16,
  },
});

import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Stack, useRouter } from "expo-router";
import {
  ScrollView,
  Pressable,
  StyleSheet,
  View,
  Text,
  Platform,
  Image,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth/authStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useSubscriptionStore } from "@/stores/subscription/subscriptionStore";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useScrollContext } from "@/contexts/ScrollContext";
import { dashboardService } from "@/lib/services/dashboardService";
import { appointmentsService } from "@/lib/services/appointmentsService";
import { logger } from "@/lib/utils/logger";
import { secureStorage } from "@/lib/storage/secureStorage";
import type { DashboardStats, Case, Appointment } from "@/lib/types";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";

const DASHBOARD_STATS_CACHE_KEY_PREFIX = "dashboard_stats_cache_"; // Will be suffixed with user ID
const DASHBOARD_STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const APPOINTMENT_CACHE_KEY_PREFIX = "appointment_cache_"; // Will be suffixed with user ID
const APPOINTMENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper to get user-specific cache keys
const getDashboardStatsCacheKey = (
  userId: string | null | undefined,
): string => {
  if (!userId) return "dashboard_stats_cache_no_user";
  return `${DASHBOARD_STATS_CACHE_KEY_PREFIX}${userId}`;
};

const getAppointmentCacheKey = (userId: string | null | undefined): string => {
  if (!userId) return "appointment_cache_no_user";
  return `${APPOINTMENT_CACHE_KEY_PREFIX}${userId}`;
};

const appLogo = require("@/assets/app_logo.png");

const normalizeStatus = (status?: string | null) =>
  (status ?? "").toLowerCase();
const formatServiceTypeLabel = (serviceType?: string) =>
  serviceType
    ? serviceType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/(^|\s)\w/g, (char) => char.toUpperCase())
    : "";

const formatCompactReference = (reference?: string | null) => {
  if (!reference) {
    return "";
  }
  const trimmed = reference.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}…${suffix}`;
};

export default function HomeScreen() {
  if (__DEV__) {
    console.log("[HomeScreen] Component rendering");
  }
  const theme = useAppTheme();
  const colors = useThemeColors();
  const surfaceCard = theme.dark ? "#111827" : colors.surface;
  const iconTint = useMemo(
    () => withOpacity(colors.primary, theme.dark ? 0.35 : 0.12),
    [colors.primary, theme.dark],
  );
  const successTint = useMemo(
    () => withOpacity(colors.success, theme.dark ? 0.35 : 0.16),
    [colors.success, theme.dark],
  );
  const warningTint = useMemo(
    () => withOpacity(colors.warning, theme.dark ? 0.35 : 0.2),
    [colors.warning, theme.dark],
  );
  const router = useRouter();
  const translation = useTranslation();
  const t = translation.t; // Extract t function once
  const scrollViewRef = useRef<ScrollView>(null);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapUserRef = useRef<string | null>(null);
  const statsRefreshCooldownRef = useRef(0);
  const { setScrollDirection, setAtBottom } = useScrollContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingAppointment, setUpcomingAppointment] =
    useState<Appointment | null>(null);
  const [isAppointmentLoading, setIsAppointmentLoading] = useState(false);
  const statsCacheRef = useRef<{
    data: DashboardStats | null;
    fetchedAt: number;
  }>({ data: null, fetchedAt: 0 });
  const statsUpdateRef = useRef(false);
  // Use stable selectors to prevent unnecessary re-renders
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Only subscribe to the data we need, not the actions (actions are stable in Zustand)
  const cases = useCasesStore((state) => state.cases);
  const fetchCases = useCasesStore((state) => state.fetchCases);

  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationsStore(
    (state) => state.fetchUnreadCount,
  );
  const markAllNotificationsAsRead = useNotificationsStore(
    (state) => state.markAllAsRead,
  );

  const unreadChatTotal = useMessagesStore((state) => state.unreadChatTotal);
  const unreadEmailTotal = useMessagesStore((state) => state.unreadEmailTotal);
  const fetchMessages = useMessagesStore((state) => state.fetchMessages);
  const fetchConversations = useMessagesStore(
    (state) => state.fetchConversations,
  );

  const documents = useDocumentsStore((state) => state.documents);
  const fetchDocuments = useDocumentsStore((state) => state.fetchDocuments);
  const { showAlert } = useBottomSheetAlert();
  const subscriptionStatus = useSubscriptionStore(
    (state) => state.subscriptionStatus,
  );
  const lastChecked = useSubscriptionStore((state) => state.lastChecked);
  const checkSubscriptionStatus = useSubscriptionStore(
    (state) => state.checkSubscriptionStatus,
  );
  const tabBarHeight = useBottomTabBarHeight();

  const scrollContentPaddingBottom = useMemo(
    () => tabBarHeight + 40,
    [tabBarHeight],
  );

  const formatCaseDate = (dateString?: string | null) => {
    if (!dateString) {
      return t("common.unknownDate", { defaultValue: "Unknown date" });
    }
    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) {
      return t("common.unknownDate", { defaultValue: "Unknown date" });
    }
    return parsedDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAppointmentDateTime = (dateString?: string | null) => {
    if (!dateString) {
      return t("common.unknownDate", { defaultValue: "Unknown date" });
    }
    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) {
      return t("common.unknownDate", { defaultValue: "Unknown date" });
    }
    return parsedDate.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCaseStatusLabel = (status?: string | null) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case "submitted":
        return t("cases.submitted");
      case "under_review":
      case "under-review":
        return t("cases.underReview");
      case "documents_required":
      case "action-required":
        return t("cases.filterActionRequired");
      case "processing":
        return t("cases.processing");
      case "approved":
        return t("cases.approved");
      case "rejected":
        return t("cases.rejected");
      case "closed":
        return t("cases.closed", { defaultValue: "Closed" });
      default:
        return (
          status || t("cases.statusUnknown", { defaultValue: "Unknown status" })
        );
    }
  };

  const refreshStats = useCallback(
    async (force = false) => {
      if (!isAuthenticated || !user?.uid) {
        setStats(null);
        return;
      }

      const cacheKey = getDashboardStatsCacheKey(user.uid);
      const now = Date.now();

      // Check in-memory cache first
      if (
        !force &&
        statsCacheRef.current.data &&
        now - statsCacheRef.current.fetchedAt < DASHBOARD_STATS_CACHE_TTL
      ) {
        setStats(statsCacheRef.current.data);
        return;
      }

      // Check persistent cache (user-specific)
      if (!force) {
        try {
          const cached = await secureStorage.get<{
            data: DashboardStats;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user
          if (
            cached &&
            cached.userId === user.uid &&
            now - cached.fetchedAt < DASHBOARD_STATS_CACHE_TTL
          ) {
            logger.debug("Dashboard stats cache hit (persistent)", {
              userId: user.uid,
            });
            statsCacheRef.current = {
              data: cached.data,
              fetchedAt: cached.fetchedAt,
            };
            setStats(cached.data);
            return;
          }
        } catch (error) {
          logger.debug("Failed to read dashboard stats cache", error);
        }
      }

      // Fetch from API
      try {
        const data = await dashboardService.getStats();
        statsCacheRef.current = { data, fetchedAt: now };
        setStats(data);

        // Update persistent cache with user ID
        try {
          await secureStorage.set(cacheKey, {
            data,
            fetchedAt: now,
            userId: user.uid, // Store user ID for verification
          });
        } catch (error) {
          logger.debug("Failed to save dashboard stats cache", error);
        }
      } catch (error) {
        logger.error("Failed to fetch dashboard stats", error);

        // Try to use cached data on error (only if same user)
        try {
          const cached = await secureStorage.get<{
            data: DashboardStats;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user
          if (cached && cached.userId === user.uid && cached.data) {
            logger.info("Using cached dashboard stats due to fetch error", {
              userId: user.uid,
            });
            statsCacheRef.current = {
              data: cached.data,
              fetchedAt: cached.fetchedAt,
            };
            setStats(cached.data);
            return;
          }
        } catch (cacheError) {
          logger.debug(
            "Failed to read dashboard stats cache on error",
            cacheError,
          );
        }
      }
    },
    [isAuthenticated, user?.uid],
  );

  const fetchUpcomingAppointment = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const silent = options?.silent ?? false;
      const force = options?.force ?? false;

      if (!isAuthenticated || !user?.uid) {
        setUpcomingAppointment(null);
        setIsAppointmentLoading(false);
        return;
      }

      const cacheKey = getAppointmentCacheKey(user.uid);
      const now = Date.now();

      // Check persistent cache first (only if same user)
      if (!force) {
        try {
          const cached = await secureStorage.get<{
            appointment: Appointment | null;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user (extra safety check)
          if (
            cached &&
            cached.userId === user.uid &&
            now - cached.fetchedAt < APPOINTMENT_CACHE_TTL
          ) {
            logger.debug("Appointment cache hit", { userId: user.uid });
            setUpcomingAppointment(cached.appointment);
            setIsAppointmentLoading(false);
            return;
          }
        } catch (error) {
          logger.debug("Failed to read appointment cache", error);
        }
      }

      if (!silent) {
        setIsAppointmentLoading(true);
      }

      try {
        const appointment = await appointmentsService.getUpcoming();
        setUpcomingAppointment(appointment);

        // Update persistent cache with user ID for verification
        try {
          await secureStorage.set(cacheKey, {
            appointment,
            fetchedAt: now,
            userId: user.uid, // Store user ID in cache for verification
          });
        } catch (error) {
          logger.debug("Failed to save appointment cache", error);
        }
      } catch (error) {
        logger.error("Failed to load upcoming appointment", error);

        // Try to use cached data on error (only if same user)
        try {
          const cached = await secureStorage.get<{
            appointment: Appointment | null;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user
          if (cached && cached.userId === user.uid) {
            logger.info("Using cached appointment due to fetch error", {
              userId: user.uid,
            });
            setUpcomingAppointment(cached.appointment);
            return;
          }
        } catch (cacheError) {
          logger.debug("Failed to read appointment cache on error", cacheError);
        }

        setUpcomingAppointment(null);
      } finally {
        if (!silent) {
          setIsAppointmentLoading(false);
        }
      }
    },
    [isAuthenticated, user?.uid],
  );

  // Store actions in refs to prevent dependency changes
  const fetchCasesRef = useRef(fetchCases);
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  const fetchMessagesRef = useRef(fetchMessages);
  const fetchDocumentsRef = useRef(fetchDocuments);
  const fetchConversationsRef = useRef(fetchConversations);
  const fetchUpcomingAppointmentRef = useRef(fetchUpcomingAppointment);
  const refreshStatsRef = useRef(refreshStats);

  // Update refs when actions change (they shouldn't, but just in case)
  useEffect(() => {
    fetchCasesRef.current = fetchCases;
    fetchUnreadCountRef.current = fetchUnreadCount;
    fetchMessagesRef.current = fetchMessages;
    fetchDocumentsRef.current = fetchDocuments;
    fetchConversationsRef.current = fetchConversations;
    fetchUpcomingAppointmentRef.current = fetchUpcomingAppointment;
    refreshStatsRef.current = refreshStats;
  }, [
    fetchCases,
    fetchUnreadCount,
    fetchMessages,
    fetchDocuments,
    fetchConversations,
    fetchUpcomingAppointment,
    refreshStats,
  ]);

  useFocusEffect(
    useCallback(() => {
      fetchUpcomingAppointmentRef.current({ silent: true });
    }, []), // Empty deps - use ref instead
  );

  // Handle Make Payment button click - check payment status and show tier selection if needed
  const handleMakePayment = useCallback(async () => {
    if (!isAuthenticated) {
      showAlert({
        title: t("common.error", { defaultValue: "Error" }),
        message: t("auth.loginRequired", {
          defaultValue: "Please log in to make a payment.",
        }),
        actions: [{ text: t("common.close", { defaultValue: "Close" }) }],
      });
      return;
    }

    // Check cache first - if we have fresh cached data, use it
    const now = Date.now();
    const cacheAge = lastChecked ? now - lastChecked : Infinity;
    const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes

    if (!subscriptionStatus || !cacheValid) {
      // Cache miss or stale - refresh status
      logger.info(
        "Cache miss or stale, refreshing subscription status for payment check",
      );
      await checkSubscriptionStatus({ force: false });
    }

    // Re-check status after potential refresh
    const currentStatus = useSubscriptionStore.getState().subscriptionStatus;
    const hasPaid = currentStatus?.hasPaid === true;
    const isActive = currentStatus?.isActive === true;

    if (hasPaid && isActive) {
      // User has already paid - show info alert
      showAlert({
        title: t("payments.alreadyPaidTitle", {
          defaultValue: "Payment Already Made",
        }),
        message: t("payments.alreadyPaidMessage", {
          defaultValue:
            "You have already made a one-time payment. Your payment is active.",
          tier: currentStatus?.subscriptionTier || "active",
        }),
        actions: [
          {
            text: t("common.close", { defaultValue: "Close" }),
            variant: "primary",
          },
        ],
      });
      return;
    }

    // User hasn't paid or payment expired - show tier selection
    const paymentTiers = [
      {
        id: "basic",
        name: "Basic",
        amount: 500.0,
        description: "Basic Tier - One-time payment",
      },
      {
        id: "standard",
        name: "Standard",
        amount: 1500.0,
        description: "Standard Tier - One-time payment",
      },
      {
        id: "premium",
        name: "Premium",
        amount: 2000.0,
        description: "Premium Tier - One-time payment",
      },
    ];

    // Create actions for each tier + cancel
    const tierActions = paymentTiers.map((tier) => ({
      text: `${tier.name} - $${tier.amount.toFixed(2)}`,
      onPress: () => {
        router.push({
          pathname: "/payment",
          params: {
            amount: tier.amount.toString(),
            description: tier.description,
            tier: tier.id,
          },
        });
      },
      variant: "primary" as const,
    }));

    const errorMessage = hasPaid
      ? t("payments.subscriptionExpired", {
          defaultValue:
            "Your payment has expired. Please select a payment tier to renew.",
        })
      : t("payments.subscriptionRequired", {
          defaultValue:
            "Active payment required. Please select a payment tier to continue.",
        });

    showAlert({
      title: t("payments.paymentRequiredTitle", {
        defaultValue: "Payment Required",
      }),
      message: errorMessage,
      actions: [
        {
          text: t("common.cancel", { defaultValue: "Cancel" }),
          variant: "secondary",
          onPress: () => {
            // User cancelled - do nothing
          },
        },
        ...tierActions,
      ],
    });
  }, [
    isAuthenticated,
    subscriptionStatus,
    lastChecked,
    checkSubscriptionStatus,
    showAlert,
    router,
    t,
  ]);

  useEffect(() => {
    setAtBottom(true);
    setScrollDirection(false);
  }, [setAtBottom, setScrollDirection]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const bootstrapData = useCallback(
    async (userId?: string | null) => {
      if (!isAuthenticated) {
        return;
      }

      // Load cached data first for instant display
      try {
        // Load cached stats (only if user ID matches)
        if (userId) {
          const cacheKey = getDashboardStatsCacheKey(userId);
          const cachedStats = await secureStorage.get<{
            data: DashboardStats;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user
          if (
            cachedStats &&
            cachedStats.userId === userId &&
            cachedStats.data
          ) {
            statsCacheRef.current = {
              data: cachedStats.data,
              fetchedAt: cachedStats.fetchedAt,
            };
            setStats(cachedStats.data);
          }
        }

        // Load cached appointment (only if user ID matches)
        if (userId) {
          const cacheKey = getAppointmentCacheKey(userId);
          const cachedAppointment = await secureStorage.get<{
            appointment: Appointment | null;
            fetchedAt: number;
            userId?: string;
          }>(cacheKey);
          // Verify cache is for current user
          if (cachedAppointment && cachedAppointment.userId === userId) {
            setUpcomingAppointment(cachedAppointment.appointment);
          }
        }
      } catch (error) {
        logger.debug("Failed to load cached data on bootstrap", error);
      }

      // Then fetch fresh data in background (non-blocking)
      const tasks: Promise<unknown>[] = [
        fetchCasesRef.current(),
        fetchUnreadCountRef.current(),
        fetchMessagesRef.current(),
        fetchDocumentsRef.current(),
        fetchUpcomingAppointmentRef.current({ silent: true }),
        refreshStatsRef.current(false), // Use cache if available
      ];

      if (userId) {
        tasks.push(fetchConversationsRef.current(userId));
      }

      const results = await Promise.allSettled(tasks);
      results.forEach((result) => {
        if (result.status === "rejected") {
          logger.error("Home bootstrap task failed", result.reason);
        }
      });
    },
    [isAuthenticated], // Only depend on isAuthenticated
  );

  // Store bootstrapData in ref to prevent useEffect from re-running
  const bootstrapDataRef = useRef(bootstrapData);
  useEffect(() => {
    bootstrapDataRef.current = bootstrapData;
  }, [bootstrapData]);

  useEffect(() => {
    if (__DEV__) {
      console.log("[HomeScreen] Mounted, isAuthenticated:", isAuthenticated);
      console.log("[HomeScreen] User:", user?.email || "No user");
    }

    if (!isAuthenticated || !user?.uid) {
      // Clear appointment cache when user logs out
      setUpcomingAppointment(null);
      bootstrapUserRef.current = null;
      return;
    }

    // If user changed, clear caches from previous user
    if (bootstrapUserRef.current && bootstrapUserRef.current !== user.uid) {
      logger.info("User changed, clearing caches", {
        previousUserId: bootstrapUserRef.current,
        newUserId: user.uid,
      });
      // Clear previous user's caches
      const previousAppointmentKey = getAppointmentCacheKey(
        bootstrapUserRef.current,
      );
      const previousStatsKey = getDashboardStatsCacheKey(
        bootstrapUserRef.current,
      );
      Promise.all([
        secureStorage.delete(previousAppointmentKey),
        secureStorage.delete(previousStatsKey),
      ]).catch((error) => {
        logger.debug("Failed to clear previous user caches", error);
      });
      // Clear current state
      setUpcomingAppointment(null);
      setStats(null);
      statsCacheRef.current = { data: null, fetchedAt: 0 };
    }

    if (bootstrapUserRef.current === user.uid) {
      return;
    }

    bootstrapUserRef.current = user.uid;
    bootstrapDataRef.current(user.uid);

    return () => {
      bootstrapUserRef.current = null;
    };
  }, [isAuthenticated, user?.uid]); // Removed bootstrapData from deps - using ref instead

  const sortedCases = useMemo(() => {
    if (!cases || cases.length === 0) {
      return [] as typeof cases;
    }
    return [...cases].sort((a, b) => {
      const dateA = new Date(a.lastUpdated || a.submissionDate || 0);
      const dateB = new Date(b.lastUpdated || b.submissionDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [cases]);

  const activeCases = useMemo(() => {
    return sortedCases.filter((caseItem) => {
      const status = normalizeStatus(caseItem.status);
      return [
        "submitted",
        "under_review",
        "documents_required",
        "processing",
      ].includes(status);
    });
  }, [sortedCases]);

  const latestActiveCase = useMemo(() => {
    return (
      sortedCases.find((caseItem) => {
        const status = normalizeStatus(caseItem.status);
        return [
          "submitted",
          "under_review",
          "documents_required",
          "processing",
        ].includes(status);
      }) ?? null
    );
  }, [sortedCases]);

  const latestCase = sortedCases[0] ?? null;
  const caseForStatusCard = latestActiveCase ?? latestCase;

  const latestApprovedCase = useMemo(() => {
    return (
      sortedCases.find(
        (caseItem) => normalizeStatus(caseItem.status) === "approved",
      ) ?? null
    );
  }, [sortedCases]);

  const upcomingActionCase = useMemo(() => {
    return (
      sortedCases.find((caseItem) => {
        const status = normalizeStatus(caseItem.status);
        return ["action-required", "pending"].includes(status);
      }) ?? null
    );
  }, [sortedCases]);

  const pendingDocsCount = stats?.pendingDocuments ?? documents.length;
  const activeCasesCount = stats?.activeCases ?? activeCases.length;
  const unreadChatCount = unreadChatTotal;
  const headerBadgeCount = unreadCount > 0 ? unreadCount : unreadEmailTotal;

  // Use refs to track previous values and only update when they actually change
  const prevCasesLengthRef = useRef(cases.length);
  const prevDocumentsLengthRef = useRef(documents.length);
  const prevUnreadCountRef = useRef(unreadCount);
  const prevUnreadChatCountRef = useRef(unreadChatCount);

  useEffect(() => {
    if (!isAuthenticated) {
      statsUpdateRef.current = false;
      statsRefreshCooldownRef.current = 0;
      setStats(null);
      prevCasesLengthRef.current = 0;
      prevDocumentsLengthRef.current = 0;
      prevUnreadCountRef.current = 0;
      prevUnreadChatCountRef.current = 0;
      return;
    }

    // Check if any values actually changed
    const casesChanged = cases.length !== prevCasesLengthRef.current;
    const documentsChanged =
      documents.length !== prevDocumentsLengthRef.current;
    const unreadCountChanged = unreadCount !== prevUnreadCountRef.current;
    const unreadChatCountChanged =
      unreadChatCount !== prevUnreadChatCountRef.current;

    // Update refs
    prevCasesLengthRef.current = cases.length;
    prevDocumentsLengthRef.current = documents.length;
    prevUnreadCountRef.current = unreadCount;
    prevUnreadChatCountRef.current = unreadChatCount;

    // Only proceed if something actually changed
    if (
      !casesChanged &&
      !documentsChanged &&
      !unreadCountChanged &&
      !unreadChatCountChanged
    ) {
      return;
    }

    if (!statsUpdateRef.current) {
      statsUpdateRef.current = true;
      return;
    }

    const now = Date.now();
    if (now - statsRefreshCooldownRef.current < 60_000) {
      return;
    }
    statsRefreshCooldownRef.current = now;
    refreshStatsRef.current();
  }, [
    isAuthenticated,
    cases.length,
    documents.length,
    unreadCount,
    unreadChatCount,
  ]); // Removed refreshStats from deps - using ref instead

  // Memoize all translation strings to prevent unnecessary re-renders
  const importantUpdatesTitle = useMemo(
    () => t("home.importantUpdates", { defaultValue: "Important Updates" }),
    [t],
  );
  const paymentButtonLabel = useMemo(
    () => t("home.makePayment", { defaultValue: "Make Payment" }),
    [t],
  );

  const approvedUpdateTitle = useMemo(
    () =>
      latestApprovedCase
        ? t("home.caseApprovedTitle", {
            defaultValue: "{{service}} ({{reference}}) Approved",
            service: formatServiceTypeLabel(latestApprovedCase.serviceType),
            reference: formatCompactReference(
              latestApprovedCase.referenceNumber,
            ),
          })
        : t("home.noRecentApprovalsTitle", {
            defaultValue: "No cases approved yet",
          }),
    [t, latestApprovedCase],
  );

  const approvedUpdateDescription = useMemo(
    () =>
      latestApprovedCase
        ? t("home.caseApprovedDescription", {
            defaultValue: "Case {{reference}} was approved on {{date}}.",
            reference: latestApprovedCase.referenceNumber,
            date: formatCaseDate(
              latestApprovedCase.approvedAt || latestApprovedCase.lastUpdated,
            ),
          })
        : t("home.noRecentApprovalsDescription", {
            defaultValue: "You will be notified when a case is approved.",
          }),
    [t, latestApprovedCase],
  );

  const pendingUpdateTitle = useMemo(
    () =>
      upcomingActionCase
        ? t("home.pendingActionTitle", {
            defaultValue: "Action Required: {{service}} ({{reference}})",
            service: formatServiceTypeLabel(upcomingActionCase.serviceType),
            reference: formatCompactReference(
              upcomingActionCase.referenceNumber,
            ),
          })
        : t("home.noPendingActionsTitle", {
            defaultValue: "No pending actions",
          }),
    [t, upcomingActionCase],
  );

  const pendingUpdateDescription = useMemo(
    () =>
      upcomingActionCase
        ? t("home.pendingActionDescription", {
            defaultValue:
              "Latest update on {{date}}. Please review the case details.",
            date: formatCaseDate(
              upcomingActionCase.lastUpdated ||
                upcomingActionCase.submissionDate,
            ),
          })
        : t("home.noPendingActionsDescription", {
            defaultValue:
              "Great job! All your cases are up to date and nothing needs your attention right now.",
          }),
    [t, upcomingActionCase],
  );

  const nextAppointmentLabel = useMemo(
    () => t("home.nextAppointment", { defaultValue: "Next Appointment" }),
    [t],
  );

  const appointmentCaseReference = useMemo(
    () =>
      upcomingAppointment?.case?.referenceNumber ||
      t("cases.statusUnknown", { defaultValue: "Unknown case" }),
    [t, upcomingAppointment?.case?.referenceNumber],
  );

  const nextAppointmentValue = useMemo(
    () =>
      upcomingAppointment
        ? t("home.nextAppointmentValueWithCase", {
            defaultValue: "{{date}} · {{reference}}",
            date: formatAppointmentDateTime(upcomingAppointment.scheduledAt),
            reference: appointmentCaseReference,
          })
        : t("home.noUpcomingAppointments", {
            defaultValue: "No upcoming appointments",
          }),
    [t, upcomingAppointment, appointmentCaseReference],
  );

  const appointmentLocationText = useMemo(
    () =>
      upcomingAppointment?.location
        ? t("home.appointmentLocation", {
            defaultValue: "Location: {{location}}",
            location: upcomingAppointment.location,
          })
        : null,
    [t, upcomingAppointment?.location],
  );

  const appointmentAdvisorName = useMemo(() => {
    if (!upcomingAppointment?.assignedAgent) {
      return "";
    }
    const { firstName, lastName, email } = upcomingAppointment.assignedAgent;
    const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();
    return composedName || email || "";
  }, [upcomingAppointment]);

  const appointmentAdvisorText = useMemo(
    () =>
      upcomingAppointment?.assignedAgent && appointmentAdvisorName
        ? t("home.appointmentAdvisor", {
            defaultValue: "Advisor: {{name}}",
            name: appointmentAdvisorName,
          })
        : null,
    [t, upcomingAppointment?.assignedAgent, appointmentAdvisorName],
  );

  const appointmentNotesText = useMemo(
    () =>
      upcomingAppointment?.notes
        ? t("home.appointmentNotes", {
            defaultValue: "Notes: {{notes}}",
            notes: upcomingAppointment.notes,
          })
        : null,
    [t, upcomingAppointment?.notes],
  );

  const userName = useMemo(
    () =>
      user?.displayName ||
      user?.email?.split("@")[0] ||
      t("home.defaultUserName", { defaultValue: "User" }),
    [t, user?.displayName, user?.email],
  );

  // Memoize frequently used static translation strings
  const goodMorningText = useMemo(() => t("home.goodMorning"), [t]);
  const welcomeText = useMemo(
    () => t("home.welcome", { name: userName }),
    [t, userName],
  );
  const currentCaseStatusText = useMemo(() => t("home.currentCaseStatus"), [t]);
  const viewAllText = useMemo(() => t("common.viewAll"), [t]);
  const noCasesText = useMemo(() => t("cases.noCases"), [t]);
  const newCaseText = useMemo(() => t("cases.newCase"), [t]);
  const loadingText = useMemo(() => t("common.loading"), [t]);
  const activeCasesText = useMemo(() => t("home.activeCases"), [t]);
  const pendingDocumentsText = useMemo(() => t("home.pendingDocuments"), [t]);
  const newMessagesText = useMemo(() => t("home.newMessages"), [t]);
  const quickAccessText = useMemo(() => t("home.quickAccess"), [t]);
  const uploadDocumentText = useMemo(() => t("home.uploadDocument"), [t]);
  const getHelpText = useMemo(() => t("home.getHelp"), [t]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
      const contentHeight = event.nativeEvent.contentSize.height;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const isAtBottom =
          currentScrollY + scrollViewHeight >= contentHeight - 50;
        setAtBottom(isAtBottom);

        const scrollDiff = currentScrollY - lastScrollY.current;
        if (Math.abs(scrollDiff) > 5) {
          setScrollDirection(scrollDiff > 0);
          lastScrollY.current = currentScrollY;
        }
      }, 50);
    },
    [setAtBottom, setScrollDirection],
  );

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
          { backgroundColor: theme.dark ? "#1f2937" : colors.background },
        ]}
        edges={["top"]}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollContentPaddingBottom },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Header with Greeting and Notification */}
          <View style={styles.header}>
            <View style={styles.greetingContainer}>
              <View
                style={[
                  styles.logoWrapper,
                  {
                    backgroundColor: withOpacity(
                      "FFFFFF",
                      theme.dark ? 0.4 : 0.12,
                    ),
                    borderColor: withOpacity(
                      colors.primary,
                      theme.dark ? 0.45 : 0.2,
                    ),
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <Image
                  source={appLogo}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.greetingTextContainer}>
                <Text style={[styles.greetingText, { color: colors.muted }]}>
                  {goodMorningText}
                </Text>
                <Text style={[styles.welcomeText, { color: colors.text }]}>
                  {welcomeText}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.notificationButton}
              onPress={() => {
                if (unreadCount > 0) {
                  markAllNotificationsAsRead();
                }
                router.push({
                  pathname: "/(tabs)/messages",
                  params: { segment: "email" },
                });
              }}
            >
              <IconSymbol name="bell.fill" size={26} color={colors.text} />
              {headerBadgeCount > 0 && (
                <View
                  style={[
                    styles.notificationBadge,
                    { backgroundColor: colors.danger },
                  ]}
                >
                  <Text
                    style={[
                      styles.notificationBadgeText,
                      { color: colors.onPrimary },
                    ]}
                  >
                    {headerBadgeCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Current Case Status Card */}
          <View style={[styles.card, { backgroundColor: surfaceCard }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {currentCaseStatusText}
              </Text>
              <Pressable onPress={() => router.push("/(tabs)/cases")}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>
                  {viewAllText}
                </Text>
              </Pressable>
            </View>

            {/* Current Case Status */}
            {caseForStatusCard ? (
              <View key={caseForStatusCard.id} style={styles.statusRow}>
                <View
                  style={[styles.iconCircle, { backgroundColor: iconTint }]}
                >
                  <IconSymbol
                    name="hourglass"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text
                    style={[styles.statusSubtitle, { color: colors.muted }]}
                  >
                    {formatServiceTypeLabel(caseForStatusCard.serviceType)} (
                    {caseForStatusCard.referenceNumber})
                  </Text>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {getCaseStatusLabel(caseForStatusCard.status)}
                  </Text>
                  <Text style={[styles.statusMeta, { color: colors.mutedAlt }]}>
                    {t("home.updatedOn", {
                      defaultValue: "Updated on {{date}}",
                      date: formatCaseDate(
                        caseForStatusCard.lastUpdated ||
                          caseForStatusCard.submissionDate,
                      ),
                    })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <View
                  style={[styles.iconCircle, { backgroundColor: iconTint }]}
                >
                  <IconSymbol
                    name="folder.fill"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text
                    style={[styles.statusSubtitle, { color: colors.muted }]}
                  >
                    {noCasesText}
                  </Text>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {newCaseText}
                  </Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <View
              style={[
                styles.divider,
                { backgroundColor: theme.dark ? "#1F2937" : colors.border },
              ]}
            />

            {/* Next Appointment */}
            <View style={styles.statusRow}>
              <View style={[styles.iconCircle, { backgroundColor: iconTint }]}>
                <IconSymbol name="calendar" size={24} color={colors.primary} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusSubtitle, { color: colors.muted }]}>
                  {nextAppointmentLabel}
                </Text>
                {isAppointmentLoading ? (
                  <View style={styles.appointmentLoadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text
                      style={[
                        styles.statusMeta,
                        { color: colors.muted, marginTop: 0 },
                      ]}
                    >
                      {loadingText}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {nextAppointmentValue}
                    </Text>
                    {appointmentLocationText ? (
                      <Text
                        style={[styles.statusMeta, { color: colors.mutedAlt }]}
                      >
                        {appointmentLocationText}
                      </Text>
                    ) : null}
                    {appointmentAdvisorText ? (
                      <Text
                        style={[styles.statusMeta, { color: colors.mutedAlt }]}
                      >
                        {appointmentAdvisorText}
                      </Text>
                    ) : null}
                    {appointmentNotesText ? (
                      <Text
                        style={[styles.statusMeta, { color: colors.mutedAlt }]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {appointmentNotesText}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Stats Cards Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {activeCasesText}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {activeCasesCount}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {pendingDocumentsText}
              </Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {pendingDocsCount}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: surfaceCard }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {newMessagesText}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {unreadChatCount}
              </Text>
            </View>
          </View>

          {/* Quick Access Section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {quickAccessText}
          </Text>
          <View style={styles.quickAccessGrid}>
            <Pressable
              style={[
                styles.quickAccessButton,
                { backgroundColor: surfaceCard },
              ]}
              onPress={() => router.push("/cases/new")}
            >
              <View
                style={[
                  styles.quickAccessIconCircle,
                  { backgroundColor: iconTint },
                ]}
              >
                <IconSymbol
                  name="plus.circle.fill"
                  size={32}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {newCaseText}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.quickAccessButton,
                { backgroundColor: surfaceCard },
              ]}
              onPress={() => router.push("/documents/upload")}
            >
              <View
                style={[
                  styles.quickAccessIconCircle,
                  { backgroundColor: iconTint },
                ]}
              >
                <IconSymbol name="doc.fill" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {uploadDocumentText}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.quickAccessButton,
                { backgroundColor: surfaceCard },
              ]}
              onPress={handleMakePayment}
            >
              <View
                style={[
                  styles.quickAccessIconCircle,
                  { backgroundColor: successTint },
                ]}
              >
                <IconSymbol
                  name="creditcard.fill"
                  size={32}
                  color={colors.success}
                />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {paymentButtonLabel}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.quickAccessButton,
                { backgroundColor: surfaceCard },
              ]}
              onPress={() => router.push("/support/contact")}
            >
              <View
                style={[
                  styles.quickAccessIconCircle,
                  { backgroundColor: iconTint },
                ]}
              >
                <IconSymbol
                  name="message.fill"
                  size={32}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.quickAccessLabel, { color: colors.text }]}>
                {getHelpText}
              </Text>
            </Pressable>
          </View>

          {/* Important Updates Section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {importantUpdatesTitle}
          </Text>

          {/* Update Card 1 - Success */}
          <View style={[styles.updateCard, { backgroundColor: surfaceCard }]}>
            <View
              style={[
                styles.updateIconCircle,
                { backgroundColor: successTint },
              ]}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={32}
                color={colors.success}
              />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: colors.text }]}>
                {approvedUpdateTitle}
              </Text>
              <Text style={[styles.updateDescription, { color: colors.muted }]}>
                {approvedUpdateDescription}
              </Text>
            </View>
          </View>

          {/* Update Card 2 - Warning */}
          <View style={[styles.updateCard, { backgroundColor: surfaceCard }]}>
            <View
              style={[
                styles.updateIconCircle,
                { backgroundColor: warningTint },
              ]}
            >
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={32}
                color={colors.warning}
              />
            </View>
            <View style={styles.updateTextContainer}>
              <Text style={[styles.updateTitle, { color: colors.text }]}>
                {pendingUpdateTitle}
              </Text>
              <Text style={[styles.updateDescription, { color: colors.muted }]}>
                {pendingUpdateDescription}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },

  // Header Section
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greetingContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
  },
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  notificationBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Card Styles
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  appointmentLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },

  // Stats Cards
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 100,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 18,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
  },

  // Section Title
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },

  // Quick Access Grid
  quickAccessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  quickAccessButton: {
    width: "48%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  quickAccessIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  quickAccessLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  // Update Cards
  updateCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  updateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    flexShrink: 0,
  },
  updateTextContainer: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  updateDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
});

import React, { useMemo, useCallback } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  type ViewStyle,
} from "react-native";
import { Tabs } from "expo-router";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { IconSymbol } from "@/components/IconSymbol";
import { useAppTheme } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { useMessagesStore } from "@/stores/messages/messagesStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const colors = theme.colors;

  const TAB_ITEMS: TabBarItem[] = useMemo(
    () => [
      {
        name: "Home",
        label: t("home.title"),
        icon: "house.fill",
        inactiveIcon: "house",
        route: "/(tabs)/(home)",
        routeName: "(home)",
      },
      {
        name: "Cases",
        label: t("cases.title"),
        icon: "folder.fill",
        inactiveIcon: "folder",
        route: "/(tabs)/cases",
        routeName: "cases",
      },
      {
        name: "Messages",
        label: t("messages.title"),
        icon: "message.fill",
        inactiveIcon: "message",
        route: "/(tabs)/messages",
        routeName: "messages",
      },
      {
        name: "Documents",
        label: t("documents.title"),
        icon: "doc.fill",
        inactiveIcon: "doc",
        route: "/(tabs)/documents",
        routeName: "documents",
      },
      {
        name: "Profile",
        label: t("profile.title"),
        icon: "person.fill",
        inactiveIcon: "person",
        route: "/(tabs)/profile",
        routeName: "profile",
      },
    ],
    [t],
  );
  const unreadChatTotal = useMessagesStore((state) => state.unreadChatTotal);
  const totalUnreadMessages = unreadChatTotal;
  const tabBadges = useMemo<Record<string, number>>(
    () => ({
      messages: totalUnreadMessages,
      "/(tabs)/messages": totalUnreadMessages,
    }),
    [totalUnreadMessages],
  );

  const elevatedWrapperStyle = useMemo<ViewStyle>(() => {
    const base: ViewStyle = {
      borderRadius: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.text, theme.dark ? 0.25 : 0.1),
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: colors.backdrop,
      shadowOpacity: theme.dark ? 0.35 : 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
    };

    if (Platform.OS === "ios") {
      base.backgroundColor = theme.dark
        ? "rgba(17, 24, 39, 0.42)"
        : "rgba(255, 255, 255, 0.42)";
    } else if (Platform.OS === "android") {
      base.backgroundColor = theme.dark
        ? "rgba(17, 24, 39, 0.6)"
        : "rgba(255, 255, 255, 0.6)";
      base.elevation = 12;
    } else {
      base.backgroundColor = theme.dark
        ? "rgba(17, 24, 39, 0.4)"
        : "rgba(255, 255, 255, 0.4)";
    }

    return base;
  }, [colors.backdrop, colors.text, theme.dark]);

  const renderCustomTabBar = useCallback(
    (props: BottomTabBarProps, focusedRouteName: string) => (
      <SafeAreaView
        edges={["bottom"]}
        style={styles.customTabSafeArea}
        pointerEvents="box-none"
      >
        <View style={[styles.customTabWrapper, elevatedWrapperStyle]}>
          {TAB_ITEMS.map((tab) => {
            const isActive = tab.routeName === focusedRouteName;
            const badgeKey = tab.routeName ?? tab.name ?? tab.route;
            const badgeCount = badgeKey ? (tabBadges[badgeKey] ?? 0) : 0;
            return (
              <Pressable
                key={tab.route}
                style={[
                  styles.customTabItem,
                  isActive && styles.customTabItemActive,
                ]}
                onPress={() => {
                  if (tab.routeName) {
                    props.navigation.navigate(tab.routeName as never);
                  } else {
                    props.navigation.navigate(tab.route as never);
                  }
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={styles.iconWrapper}>
                  <IconSymbol
                    name={isActive ? tab.icon : (tab.inactiveIcon ?? tab.icon)}
                    size={24}
                    color={isActive ? colors.primary : colors.muted}
                  />
                  {badgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.customTabLabel,
                    { color: isActive ? colors.primary : colors.muted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    ),
    [colors.muted, colors.primary, elevatedWrapperStyle, tabBadges, TAB_ITEMS],
  );

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => {
      const focusedRouteName = props.state.routeNames[props.state.index];

      if (
        focusedRouteName === "(home)" ||
        focusedRouteName === "profile" ||
        focusedRouteName === "messages" ||
        focusedRouteName === "documents" ||
        focusedRouteName === "cases" ||
        focusedRouteName === "/(tabs)/cases"
      ) {
        return renderCustomTabBar(props, focusedRouteName);
      }

      return (
        <FloatingTabBar
          tabs={TAB_ITEMS}
          containerWidth={Dimensions.get("window").width - 40}
          activeRouteName={focusedRouteName}
          badges={tabBadges}
          onTabPress={(tab) => {
            if (tab.routeName) {
              props.navigation.navigate(tab.routeName as never);
            } else {
              props.navigation.navigate(tab.route as never);
            }
          }}
        />
      );
    },
    [renderCustomTabBar, tabBadges, TAB_ITEMS],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.hiddenTabBar,
        tabBarIconStyle: styles.tabIcon,
      }}
      tabBar={renderTabBar}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t("home.title"),
          tabBarLabel: t("home.title"),
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={
                focused
                  ? TAB_ITEMS[0].icon
                  : (TAB_ITEMS[0].inactiveIcon ?? TAB_ITEMS[0].icon)
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: t("cases.title"),
          tabBarLabel: t("cases.title"),
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={
                focused
                  ? TAB_ITEMS[1].icon
                  : (TAB_ITEMS[1].inactiveIcon ?? TAB_ITEMS[1].icon)
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("messages.title"),
          tabBarLabel: t("messages.title"),
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={
                focused
                  ? TAB_ITEMS[2].icon
                  : (TAB_ITEMS[2].inactiveIcon ?? TAB_ITEMS[2].icon)
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t("documents.title"),
          tabBarLabel: t("documents.title"),
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={
                focused
                  ? TAB_ITEMS[3].icon
                  : (TAB_ITEMS[3].inactiveIcon ?? TAB_ITEMS[3].icon)
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarLabel: t("profile.title"),
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={
                focused
                  ? TAB_ITEMS[4].icon
                  : (TAB_ITEMS[4].inactiveIcon ?? TAB_ITEMS[4].icon)
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  customTabSafeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: Platform.OS === "android" ? 4 : 0,
  },
  customTabWrapper: {
    width: Dimensions.get("window").width - 32,
  },
  customTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 20,
  },
  customTabItemActive: {
    transform: [{ translateY: -2 }],
  },
  customTabLabel: {
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "transparent",
  },
  iconWrapper: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Platform.OS === "android" ? 4 : 0,
    backgroundColor: "transparent",
  },
  tabItem: {
    paddingVertical: 4,
  },
  hiddenTabBar: {
    position: "absolute",
    opacity: 0,
    height: 0,
  },
  tabIcon: {
    marginBottom: -2,
  },
});

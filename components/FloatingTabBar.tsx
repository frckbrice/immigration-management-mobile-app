import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import { useTheme } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  withTiming,
} from 'react-native-reanimated';
import { useScrollContext } from '@/contexts/ScrollContext';

const { width: screenWidth } = Dimensions.get('window');

export interface TabBarItem {
  name: string;
  route: string;
  icon: string;
  label: string;
  routeName?: string;
  inactiveIcon?: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
  activeRouteName?: string;
  badges?: Record<string, number>;
  onTabPress?: (tab: TabBarItem) => void;
}

const normalizeRoute = (value: string) => value.replace(/\/+$/, '');

export default function FloatingTabBar({
  tabs,
  containerWidth = 240,
  borderRadius = 25,
  bottomMargin,
  activeRouteName,
  badges,
  onTabPress,
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const animatedValue = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Get scroll context to determine visibility
  const { shouldShowTabBar, isScrollingDown, isAtBottom } = useScrollContext();

  console.log('[TabBar] Current pathname:', pathname);
  console.log('[TabBar] Should show:', shouldShowTabBar);
  console.log('[TabBar] isScrollingDown:', isScrollingDown, 'isAtBottom:', isAtBottom);

  // Improved active tab detection with better path matching
  const activeTabIndex = React.useMemo(() => {
    if (activeRouteName) {
      const matchIndex = tabs.findIndex((tab) => tab.routeName === activeRouteName);
      if (matchIndex >= 0) {
        return matchIndex;
      }
    }

    // Find the best matching tab based on the current pathname
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;

      // Exact route match gets highest score
      if (pathname === tab.route) {
        score = 100;
      }
      // Check if pathname starts with tab route (for nested routes)
      else if (pathname.startsWith(tab.route)) {
        score = 80;
      }
      // Check if pathname contains the tab name
      else if (pathname.includes(tab.name)) {
        score = 60;
      }
      // Check for partial matches in the route
      else if (tab.route.includes('/(tabs)/') && pathname.includes(tab.route.split('/(tabs)/')[1])) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    // Default to first tab if no match found
    return bestMatch >= 0 ? bestMatch : 0;
  }, [activeRouteName, pathname, tabs]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = withSpring(activeTabIndex, {
        damping: 20,
        stiffness: 120,
        mass: 1,
      });
    }
  }, [activeTabIndex, animatedValue]);

  // Animate tab bar visibility based on scroll
  const opacity = useSharedValue(1);

  // Initialize tab bar as visible
  React.useEffect(() => {
    translateY.value = 0;
    opacity.value = 1;
  }, []);

  React.useEffect(() => {
    translateY.value = withTiming(shouldShowTabBar ? 0 : 100, {
      duration: 300,
    });
    opacity.value = withTiming(shouldShowTabBar ? 1 : 0, {
      duration: 300,
    });
  }, [shouldShowTabBar, translateY, opacity]);

  const handleTabPress = (tab: TabBarItem) => {
    if (onTabPress) {
      onTabPress(tab);
      return;
    }
    router.push(tab.route as Href);
  };

  // Remove unnecessary tabBarStyle animation to prevent flickering

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (containerWidth - 16) / tabs.length; // Account for container padding (8px on each side)
    const indicatorWidth = tabWidth - 6; // Subtract 3% equivalent (6px for 240px container)
    return {
      width: indicatorWidth,
      transform: [
        {
          translateX: interpolate(
            animatedValue.value,
            [0, tabs.length - 1],
            [0, tabWidth * (tabs.length - 1)]
          ),
        },
      ],
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const activeTab = tabs[activeTabIndex];
  const isTransparentTabActive = React.useMemo(() => {
    if (!activeTab) return false;
    const normalizedRoute = normalizeRoute(activeTab.route);
    return (
      normalizedRoute.endsWith('/(home)') ||
      normalizedRoute.includes('(home)') ||
      normalizedRoute.endsWith('/profile') ||
      normalizedRoute.includes('/profile')
    );
  }, [activeTab]);

  // Dynamic styles based on theme
  const dynamicStyles = {
    blurContainer: {
      ...styles.blurContainer,
      ...Platform.select({
        ios: {
          backgroundColor: isTransparentTabActive
            ? 'transparent'
            : theme.dark
              ? 'rgba(28, 28, 30, 0.8)'
              : 'rgba(255, 255, 255, 0.8)',
        },
        android: {
          backgroundColor: isTransparentTabActive
            ? 'transparent'
            : theme.dark
              ? 'rgba(28, 28, 30, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
          elevation: 8,
        },
        web: {
          backgroundColor: isTransparentTabActive
            ? 'transparent'
            : theme.dark
              ? 'rgba(28, 28, 30, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: theme.dark
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
        },
      }),
    },
    background: {
      ...styles.background,
      backgroundColor: isTransparentTabActive
        ? 'transparent'
        : theme.dark
          ? (Platform.OS === 'ios' ? 'transparent' : 'rgba(28, 28, 30, 0.1)')
          : (Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.1)'),
    },
    indicator: {
      ...styles.indicator,
      backgroundColor: theme.dark
        ? 'rgba(255, 255, 255, 0.08)' // Subtle white overlay in dark mode
        : 'rgba(0, 0, 0, 0.04)', // Subtle black overlay in light mode
      // Width is handled in animated style
    },
  };

  // Don't show tab bar on onboarding/login screens or any non-tab routes
  const normalizedPathname = normalizeRoute(pathname || '');
  const hideTabBarRoutes = ['/onboarding', '/login', '/register', '/', '/index'];
  const shouldHide = hideTabBarRoutes.some((route) => {
    const normalizedRoute = normalizeRoute(route);
    return (
      normalizedPathname === normalizedRoute ||
      normalizedPathname.startsWith(`${normalizedRoute}/`)
    );
  });

  const isTabRoute = normalizedPathname.startsWith('/(tabs)');
  const mainTabRoutes = React.useMemo(
    () =>
      tabs.flatMap((tab) => {
        const normalized = normalizeRoute(tab.route);
        return [normalized, `${normalized}/index`];
      }),
    [tabs]
  );

  const isMainTabRoute = mainTabRoutes.includes(normalizedPathname);
  const isSubPageWithinTabs = isTabRoute && !isMainTabRoute;

  if (shouldHide || !isTabRoute || isSubPageWithinTabs) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Animated.View style={[
        styles.container,
        containerAnimatedStyle,
        {
          width: containerWidth,
          marginBottom: bottomMargin ?? (Platform.OS === 'ios' ? 10 : 20)
        }
      ]}>
        <BlurView
          intensity={Platform.OS === 'web' ? 0 : 80}
          style={[dynamicStyles.blurContainer, { borderRadius }]}
        >
          <View style={dynamicStyles.background} />
          <Animated.View style={[dynamicStyles.indicator, indicatorStyle]} />
          <View style={styles.tabsContainer}>
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index;
              const badgeKey = tab.routeName ?? tab.name ?? tab.route;
              const badgeCount = (badgeKey && badges?.[badgeKey]) || 0;

              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tab}
                  onPress={() => handleTabPress(tab)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <View style={styles.iconWrapper}>
                      <IconSymbol
                        name={isActive ? tab.icon : tab.inactiveIcon ?? tab.icon}
                        size={24}
                        color={isActive ? theme.colors.primary : (theme.dark ? '#98989D' : '#8E8E93')}
                      />
                      {badgeCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: theme.dark ? '#98989D' : '#8E8E93' },
                        isActive && { color: theme.colors.primary, fontWeight: '600' },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center', // Center the content
  },
  container: {
    marginHorizontal: 20,
    alignSelf: 'center',
    // width and marginBottom handled dynamically via props
  },
  blurContainer: {
    overflow: 'hidden',
    // borderRadius and other styling applied dynamically
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    // Dynamic styling applied in component
  },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    bottom: 8,
    borderRadius: 17,
    width: `${(100 / 2) - 3}%`, // Default for 2 tabs, will be overridden by dynamic styles
    // Dynamic styling applied in component
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrapper: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    backgroundColor: 'transparent',
    // Dynamic styling applied in component
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

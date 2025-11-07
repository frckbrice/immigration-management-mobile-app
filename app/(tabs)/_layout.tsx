
import React, { useMemo, useCallback } from 'react';
import { Platform, Dimensions, StyleSheet, View, Text, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { IconSymbol } from '@/components/IconSymbol';

const TAB_ITEMS: TabBarItem[] = [
  {
    name: 'Home',
    label: 'Home',
    icon: 'house.fill',
    inactiveIcon: 'house',
    route: '/(tabs)/(home)',
    routeName: '(home)'
  },
  {
    name: 'Cases',
    label: 'Cases',
    icon: 'folder.fill',
    inactiveIcon: 'folder',
    route: '/(tabs)/cases',
    routeName: 'cases'
  },
  {
    name: 'Messages',
    label: 'Messages',
    icon: 'message.fill',
    inactiveIcon: 'message',
    route: '/(tabs)/messages',
    routeName: 'messages'
  },
  {
    name: 'Documents',
    label: 'Documents',
    icon: 'doc.fill',
    inactiveIcon: 'doc',
    route: '/(tabs)/documents',
    routeName: 'documents'
  },
  {
    name: 'Profile',
    label: 'Profile',
    icon: 'person.fill',
    inactiveIcon: 'person',
    route: '/(tabs)/profile',
    routeName: 'profile'
  },
];

export default function TabLayout() {
  const theme = useTheme();

  const homeWrapperStyle = useMemo(() => ({
    backgroundColor: theme.dark ? 'rgba(28,28,30,0.92)' : '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: theme.dark ? 0.35 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: Platform.OS === 'android' ? 10 : 0,
  }), [theme.dark]);

  const renderTabBar = useCallback((props: BottomTabBarProps) => {
    const focusedRouteName = props.state.routeNames[props.state.index];
    const isHome = focusedRouteName === '(home)';

    if (isHome) {
      return (
        <SafeAreaView edges={['bottom']} style={styles.homeTabSafeArea} pointerEvents="box-none">
          <View style={[styles.homeTabWrapper, homeWrapperStyle]}>
            {TAB_ITEMS.map((tab) => {
              const isActive = tab.routeName === focusedRouteName;
              return (
                <Pressable
                  key={tab.route}
                  style={[styles.homeTabItem, isActive && styles.homeTabItemActive]}
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
                  <IconSymbol
                    name={isActive ? tab.icon : tab.inactiveIcon ?? tab.icon}
                    size={24}
                    color={isActive ? theme.colors.primary : theme.dark ? '#98989D' : '#8E8E93'}
                  />
                  <Text
                    style={[styles.homeTabLabel, { color: isActive ? theme.colors.primary : theme.dark ? '#98989D' : '#8E8E93' }]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      );
    }

    return (
      <FloatingTabBar
        tabs={TAB_ITEMS}
        containerWidth={Dimensions.get('window').width - 40}
        activeRouteName={focusedRouteName}
        onTabPress={(tab) => {
          if (tab.routeName) {
            props.navigation.navigate(tab.routeName as never);
          } else {
            props.navigation.navigate(tab.route as never);
          }
        }}
      />
    );
  }, [homeWrapperStyle]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.dark ? '#98989D' : '#8E8E93',
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
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={focused ? TAB_ITEMS[0].icon : TAB_ITEMS[0].inactiveIcon ?? TAB_ITEMS[0].icon}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Cases',
          tabBarLabel: 'Cases',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={focused ? TAB_ITEMS[1].icon : TAB_ITEMS[1].inactiveIcon ?? TAB_ITEMS[1].icon}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={focused ? TAB_ITEMS[2].icon : TAB_ITEMS[2].inactiveIcon ?? TAB_ITEMS[2].icon}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarLabel: 'Documents',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={focused ? TAB_ITEMS[3].icon : TAB_ITEMS[3].inactiveIcon ?? TAB_ITEMS[3].icon}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              name={focused ? TAB_ITEMS[4].icon : TAB_ITEMS[4].inactiveIcon ?? TAB_ITEMS[4].icon}
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
  homeTabSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'android' ? 2 : 0,
    alignItems: 'center',
  },
  homeTabWrapper: {
    flexDirection: 'row',
    width: Dimensions.get('window').width - 32,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  homeTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  homeTabItemActive: {
    transform: [{ translateY: -2 }],
  },
  homeTabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Platform.OS === 'android' ? 4 : 0,
  },
  tabItem: {
    paddingVertical: 4,
  },
  hiddenTabBar: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  tabIcon: {
    marginBottom: -2,
  },
});

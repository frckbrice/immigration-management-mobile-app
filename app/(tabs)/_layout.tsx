
import React from 'react';
import { Platform } from 'react-native';
import FloatingTabBar from '@/components/FloatingTabBar';

export default function TabLayout() {
  const tabs = [
    {
      name: 'Home',
      label: 'Home',
      icon: 'house.fill',
      route: '/(tabs)/(home)',
    },
    {
      name: 'Cases',
      label: 'Cases',
      icon: 'folder.fill',
      route: '/(tabs)/cases',
    },
    {
      name: 'Messages',
      label: 'Messages',
      icon: 'message.fill',
      route: '/(tabs)/messages',
    },
    {
      name: 'Documents',
      label: 'Documents',
      icon: 'doc.fill',
      route: '/(tabs)/documents',
    },
    {
      name: 'Profile',
      label: 'Profile',
      icon: 'person.fill',
      route: '/(tabs)/profile',
    },
  ];

  return (
    <>
      {Platform.OS !== 'web' && <FloatingTabBar tabs={tabs} />}
    </>
  );
}

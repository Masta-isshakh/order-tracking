import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';

/**
 * Staff shell. Admins and supervisors share it; the Team tab (supervisor
 * management) is the only admin-only surface, so it is hidden rather than
 * disabled for supervisors.
 */
export default function StaffTabs() {
  const palette = usePalette();
  const { d } = useI18n();
  const { user, status } = useAuth();

  // Guard: anyone who is not staff is sent back to the storefront. Group
  // membership is also enforced server-side by the AppSync auth rules.
  if (status === 'loading') return null;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) {
    return <Redirect href="/(tabs)/home" />;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: palette.bg },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: d.tabs.orders,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: d.tabs.catalog,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pricetags' : 'pricetags-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: d.tabs.team,
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: d.tabs.settings,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

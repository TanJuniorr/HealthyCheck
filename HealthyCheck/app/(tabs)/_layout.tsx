import { useTranslation } from 'react-i18next';
import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Layout } from '../../src/constants/spacing';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TabLayout() {
  const { t } = useTranslation();
  useTheme();

  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBg,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          height: Layout.tabBarHeight + bottomInset,
          paddingBottom: bottomInset > 0 ? bottomInset : 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...Typography.tabLabel,
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.overview"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("navigation.explore"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('navigation.scan'),
          tabBarLabelStyle: { ...Typography.tabLabel, fontSize: 10, fontWeight: '600' },
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                marginTop: -15,
                marginBottom: -2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: Colors.primary,
                borderWidth: 3,
                borderColor: Colors.tabBarBg,
                elevation: focused ? 7 : 4,
                shadowColor: Colors.primaryDark,
                shadowOpacity: 0.22,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <Ionicons name={focused ? 'scan' : 'scan-outline'} size={25} color={Colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: t("navigation.healthyAI"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'sparkles' : 'sparkles-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sharing"
        options={{
          title: t("navigation.sharing"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}

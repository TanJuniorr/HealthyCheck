import { useTranslation } from 'react-i18next';
import React from 'react';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { SleepReminderProvider } from '../src/contexts/SleepReminderContext';
import { StepSensorProvider } from '../src/contexts/StepSensorContext';
import { NotificationInboxProvider } from '../src/contexts/NotificationInboxContext';
import { Colors } from '../src/constants/colors';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { authGate, gateDestination } from '../src/lib/authGate';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export function AuthNavigator() {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const gate=authGate(useAuth()),destination=gateDestination(gate);
  if (gate==='restoring') return <View style={{ flex: 1, backgroundColor: isDark ? Colors.background : Colors.white, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} accessibilityLabel={t("auth.restoring")} /></View>;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin" />
      <Stack.Protected guard={gate==='guest'} redirectTo={destination}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Protected guard={gate==='checking'||gate==='error'} redirectTo={destination}>
        <Stack.Screen name="auth/profile-check" />
      </Stack.Protected>
      <Stack.Protected guard={gate==='onboarding'} redirectTo={destination}>
        <Stack.Screen name="health-onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={gate==='ready'} redirectTo={destination}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="health" />
        <Stack.Screen name="article" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="meals" />
        <Stack.Screen name="sharing-setup" />
        <Stack.Screen name="sleep-schedule" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notifications/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return <SafeAreaProvider><ThemeProvider><LanguageProvider><ThemedStatusBar /><AuthProvider><NotificationInboxProvider><SleepReminderProvider><StepSensorProvider><AuthNavigator /></StepSensorProvider></SleepReminderProvider></NotificationInboxProvider></AuthProvider></LanguageProvider></ThemeProvider></SafeAreaProvider>;
}

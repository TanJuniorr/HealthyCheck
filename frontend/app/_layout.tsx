import { useTranslation } from 'react-i18next';
import React from 'react';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/constants/colors';

function AuthNavigator() {
  const { t } = useTranslation();

  const { isLoading, isAuthenticated, isRecovery } = useAuth();
  if (isLoading) return <View style={{ flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} accessibilityLabel={t("auth.restoring")} /></View>;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated} redirectTo={isRecovery ? '/reset-password' : '/(tabs)'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Protected guard={isAuthenticated && !isRecovery} redirectTo={isRecovery ? '/reset-password' : '/login'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="health" />
        <Stack.Screen name="article" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="meals" />
        <Stack.Screen name="sharing-setup" />
        <Stack.Screen name="sleep-schedule" />
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return <SafeAreaProvider><LanguageProvider><StatusBar style="dark" /><AuthProvider><AuthNavigator /></AuthProvider></LanguageProvider></SafeAreaProvider>;
}

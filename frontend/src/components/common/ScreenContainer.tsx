import React, { ReactNode } from 'react';
import { View, ScrollView, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { useTheme } from '../../contexts/ThemeContext';

interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  backgroundColor?: string;
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scrollable = true,
  backgroundColor = Colors.background,
  padded = true,
  style,
  contentContainerStyle,
}: ScreenContainerProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const contentStyle: ViewStyle = {
    paddingHorizontal: padded ? Spacing.screenPadding : 0,
    paddingBottom: insets.bottom + 20,
    ...contentContainerStyle,
  };

  if (scrollable) {
    return (
      <View style={[containerStyle, style]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, { paddingHorizontal: padded ? Spacing.screenPadding : 0 }, style]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

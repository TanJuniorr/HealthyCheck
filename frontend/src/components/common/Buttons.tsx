import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Radius, Spacing } from '../../constants/spacing';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'default' | 'small';
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  size = 'default',
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        size === 'small' && styles.buttonSmall,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <Text style={[styles.text, size === 'small' && styles.textSmall, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function SecondaryButton({ title, onPress, style, textStyle }: SecondaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.secondaryButton, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.secondaryText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

interface TextButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function TextButton({ title, onPress, color = Colors.primary, style }: TextButtonProps) {
  return (
    <TouchableOpacity style={[styles.textButton, style]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.textButtonLabel, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonSmall: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
  },
  disabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.6,
  },
  text: {
    ...Typography.button,
    color: Colors.white,
  },
  textSmall: {
    ...Typography.buttonSmall,
  },
  secondaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  secondaryText: {
    ...Typography.button,
    color: Colors.primary,
  },
  textButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  textButtonLabel: {
    ...Typography.buttonSmall,
    color: Colors.primary,
  },
});

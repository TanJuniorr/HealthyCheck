
import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Radius, Spacing } from '../../constants/spacing';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({
  title,
  onPress,
  style,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const isBusy = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: isBusy,
        busy: loading,
      }}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isBusy}
      style={[
        styles.primaryButton,
        isBusy && styles.disabledButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={Colors.white}
          style={styles.spinner}
        />
      ) : null}

      <Text style={styles.buttonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  spinner: {
    marginRight: Spacing.sm,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export function TextButton({ title, onPress, style, color = Colors.primary, disabled = false, loading = false }: PrimaryButtonProps & { color?: string }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress} style={[{ padding: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: disabled ? 0.6 : 1 }, style]}>
    {loading ? <ActivityIndicator color={color} style={{ marginRight: Spacing.sm }} /> : null}
    <Text style={{ ...Typography.button, color }}>{title}</Text>
  </TouchableOpacity>;
}

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useThemedStyles } from '../../contexts/ThemeContext';

interface MockAvatarProps {
  initials: string;
  size?: number;
  backgroundColor?: string;
}

export function MockAvatar({
  initials,
  size = 44,
  backgroundColor = Colors.primaryLight,
}: MockAvatarProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: size * 0.36,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...Typography.cardTitle,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

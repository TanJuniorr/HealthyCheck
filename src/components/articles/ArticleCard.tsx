import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, Radius, Shadows } from '../../constants/spacing';

interface ArticleCardProps {
  id: string;
  title: string;
  description?: string;
  category: string;
  readTime: string;
  featured?: boolean;
}

export function ArticleCard({
  id,
  title,
  description,
  category,
  readTime,
  featured = false,
}: ArticleCardProps) {
  const router = useRouter();

  if (featured) {
    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() => router.push(`/article/${id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.featuredImagePlaceholder}>
          <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.imagePlaceholderText}>Featured Article</Text>
        </View>
        <View style={styles.featuredContent}>
          <View style={styles.metaRow}>
            <Text style={styles.categoryBadge}>{category}</Text>
            <Text style={styles.readTime}>{readTime}</Text>
          </View>
          <Text style={styles.featuredTitle} numberOfLines={2}>
            {title}
          </Text>
          {description && (
            <Text style={styles.featuredDescription} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/article/${id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardImagePlaceholder}>
        <Ionicons name="document-text-outline" size={20} color={Colors.textMuted} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.metaRow}>
          <Text style={styles.categoryBadgeSmall}>{category}</Text>
          <Text style={styles.readTime}>{readTime}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Featured card
  featuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  featuredImagePlaceholder: {
    height: 180,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 4,
  },
  featuredContent: {
    padding: Spacing.lg,
  },
  featuredTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginTop: 8,
    fontSize: 17,
  },
  featuredDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryBadge: {
    ...Typography.labelSmall,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    overflow: 'hidden',
  },
  readTime: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  // Regular card
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  categoryBadgeSmall: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
  cardTitle: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginTop: 4,
  },
});

import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../../src/i18n/localize';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { articles as rawArticles } from '../../src/data/articles';
import { PrimaryButton } from '../../src/components/common/Buttons';

export default function ArticleDetailScreen() {
  const { t } = useTranslation();
  const articles = localizeStaticData(rawArticles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isBookmarked, setIsBookmarked] = useState(false);

  const article = articles.find((a) => a.id === id);

  if (!article) {
    return (
      <View style={[styles.notFoundContainer, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.notFoundIconCircle}>
          <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.notFoundTitle}>{t("articles.notFound")}</Text>
        <Text style={styles.notFoundDescription}>
          {t("articles.missing")}</Text>
        <PrimaryButton
          title={t("common.back")}
          onPress={() => router.back()}
          style={styles.backActionButton}
        />
      </View>
    );
  }

  // Get theme color by category
  const getCategoryConfig = (category: string) => {
    switch (category.toLowerCase()) {
      case 'nutrition':
        return { color: Colors.orange, bg: Colors.orangeLight, icon: 'nutrition-outline' };
      case 'fitness':
        return { color: Colors.primary, bg: Colors.primaryLight, icon: 'fitness-outline' };
      case 'sleep':
        return { color: Colors.purple, bg: Colors.purpleLight, icon: 'moon-outline' };
      case 'habits':
        return { color: Colors.coral, bg: Colors.coralLight, icon: 'checkmark-circle-outline' };
      case 'running':
        return { color: Colors.blue, bg: Colors.blueLight, icon: 'walk-outline' };
      case 'wellness':
      case 'cycle health':
        return { color: Colors.success, bg: Colors.successLight, icon: 'leaf-outline' };
      default:
        return { color: Colors.primary, bg: Colors.primaryLight, icon: 'book-outline' };
    }
  };

  const categoryConfig = getCategoryConfig(article.categoryId);

  const handleShare = async () => {
    try {
      await Share.share({
        title: article.title,
        message: t('articles.share',{ title:article.title }),
      });
    } catch {
      // Ignored for visual feedback
    }
  };

  // Split and render markdown-like content blocks
  const contentBlocks = article.content.split('\n\n');

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.huge }}
      >
        {/* Header Hero Image Placeholder */}
        <View style={[styles.heroPlaceholder, { backgroundColor: categoryConfig.bg }]}>
          {/* Decorative shapes */}
          <View style={[styles.heroCircleOuter, { borderColor: categoryConfig.color + '20' }]}>
            <View style={[styles.heroCircleInner, { backgroundColor: categoryConfig.color + '15' }]}>
              <Ionicons
                name={categoryConfig.icon as any}
                size={54}
                color={categoryConfig.color}
              />
            </View>
          </View>

          {/* Floating Top Navigation Overlay */}
          <View style={[styles.topBarOverlay, { top: insets.top + Spacing.xs }]}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.back()}
              accessibilityLabel={t("articles.back")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setIsBookmarked(!isBookmarked)}
                accessibilityLabel={t(isBookmarked ? "articles.removeBookmark" : "articles.bookmark")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isBookmarked ? Colors.primary : Colors.textPrimary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navButton}
                onPress={handleShare}
                accessibilityLabel={t("articles.shareLabel")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-social-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Article Metadata & Content Body */}
        <View style={styles.articleBody}>
          {/* Category & Read Time Row */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.bg }]}>
              <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                {article.category}
              </Text>
            </View>
            <View style={styles.readTimeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.readTimeText}>{article.readTime}</Text>
            </View>
          </View>

          {/* Article Title */}
          <Text style={styles.articleTitle}>{article.title}</Text>

          {/* Author & Date Card */}
          <View style={styles.authorCard}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitials}>
                {article.author
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{article.author}</Text>
              <Text style={styles.articleDate}>{article.date}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Content Blocks */}
          <View style={styles.contentContainer}>
            {contentBlocks.map((block, index) => {
              const trimmed = block.trim();

              // Heading 2
              if (trimmed.startsWith('## ')) {
                const headingText = trimmed.replace('## ', '');
                return (
                  <Text key={index} style={styles.contentH2}>
                    {headingText}
                  </Text>
                );
              }

              // Disclaimer / Italic note
              if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
                const noteText = trimmed.slice(1, -1);
                return (
                  <View key={index} style={styles.disclaimerBox}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={Colors.primary}
                      style={styles.disclaimerIcon}
                    />
                    <Text style={styles.disclaimerText}>{noteText}</Text>
                  </View>
                );
              }

              // Standard Paragraph
              return (
                <Text key={index} style={styles.paragraph}>
                  {trimmed}
                </Text>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  heroPlaceholder: {
    height: 220,
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroCircleOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarOverlay: {
    position: 'absolute',
    left: Spacing.screenPadding,
    right: Spacing.screenPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  articleBody: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  categoryText: {
    ...Typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  readTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeText: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  articleTitle: {
    ...Typography.largeTitle,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  authorInitials: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  authorInfo: {
    justifyContent: 'center',
  },
  authorName: {
    ...Typography.cardTitle,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  articleDate: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.xl,
  },
  contentContainer: {
    gap: Spacing.md,
  },
  contentH2: {
    ...Typography.sectionTitle,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    ...Typography.body,
    lineHeight: 24,
    color: Colors.textPrimary,
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  // Not found state
  notFoundContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  notFoundTitle: {
    ...Typography.largeTitle,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  notFoundDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    maxWidth: 280,
  },
  backActionButton: {
    minWidth: 160,
  },
});

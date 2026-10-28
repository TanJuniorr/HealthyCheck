import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../../src/i18n/localize';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Layout } from '../../src/constants/spacing';
import { CategoryChip } from '../../src/components/health/HealthComponents';
import { SectionHeader } from '../../src/components/common/AppHeader';
import { ArticleCard } from '../../src/components/articles/ArticleCard';
import { articles as rawArticles, featuredArticle as rawFeaturedArticle, exploreCategories as rawExploreCategories } from '../../src/data/articles';
import { useThemedStyles } from '../../src/contexts/ThemeContext';

export default function ExploreScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const articles = localizeStaticData(rawArticles);
  const featuredArticle = localizeStaticData(rawFeaturedArticle);
  const exploreCategories = localizeStaticData(rawExploreCategories);

  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter recent articles based on selected category and search query
  const filteredArticles = articles.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      item.categoryId === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    // When showing 'all' without search, avoid duplicating the featured article immediately below
    if (selectedCategory === 'all' && searchQuery.trim() === '' && item.id === featuredArticle.id) {
      return false;
    }

    return matchesCategory && matchesSearch;
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Layout.tabBarHeight + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Header with Title & Search Input */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>{t("navigation.explore")}</Text>
          <Text style={styles.screenSubtitle}>{t("explore.description")}</Text>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("explore.search")}
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. Categories Horizontal Scroll */}
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {exploreCategories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.label}
                icon={category.icon}
                color={category.color}
                bgColor={category.bgColor}
                selected={selectedCategory === category.id}
                onPress={() => setSelectedCategory(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.mainContent}>
          {/* 3. Featured Article */}
          {selectedCategory === 'all' && searchQuery.trim() === '' && (
            <View style={styles.featuredContainer}>
              <ArticleCard
                id={featuredArticle.id}
                title={featuredArticle.title}
                description={featuredArticle.description}
                category={featuredArticle.category}
                readTime={featuredArticle.readTime}
                featured={true}
              />
            </View>
          )}

          {/* 4. Recent Articles Section */}
          <SectionHeader title={t("explore.recent")} />

          {filteredArticles.length > 0 ? (
            <View style={styles.articlesList}>
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  description={article.description}
                  category={article.category}
                  readTime={article.readTime}
                  featured={false}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="document-text-outline" size={28} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t("explore.empty")}</Text>
              <Text style={styles.emptyDescription}>
                {t("explore.emptyHint")}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.lg,
  },
  screenTitle: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  screenSubtitle: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    paddingVertical: 0,
  },
  categoriesWrapper: {
    marginBottom: Spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  mainContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  featuredContainer: {
    marginBottom: Spacing.sm,
  },
  articlesList: {
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

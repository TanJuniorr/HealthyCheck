import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useArticleFeed } from '../../src/hooks/useArticleFeed';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { getArticleCategories } from '../../src/services/articlesService';
import { useArticleRole } from '../../src/contexts/ArticleRoleContext';
import { articleLanguage } from '../../src/lib/articleContent';
import { ArticleCard } from '../../src/components/articles/ArticleCard';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import {
  ExploreCategories,
  ArticleSkeleton,
} from '../../src/components/articles/ExploreControls';
import { AdminArticleSearch } from '../../src/components/articles/AdminDashboardParts';
import { TextButton } from '../../src/components/common/Buttons';
export default function ExploreScreen() {
  const { t, i18n } = useTranslation(),
    styles = useThemedStyles(baseStyles),
    insets = useSafeAreaInsets(),
    language = articleLanguage(i18n.resolvedLanguage ?? 'vi');
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState<string | null>(null);
  const categories = useHealthQuery(
    () => getArticleCategories(),
    'article-categories'
  );
  const role = useArticleRole();
  const latest = useArticleFeed({ language, search, category }),
    featured = useArticleFeed({ language, mode: 'featured', pageSize: 2 }),
    recommended = useArticleFeed({
      language,
      mode: 'recommended',
      pageSize: 3,
    });
  const browsing = !search.trim() && !category;
  const alternatives = recommended.data.filter(
    (a) => !featured.data.some((f) => f.id === a.id)
  );
  const recommendations = alternatives.length ? alternatives : recommended.data;
  const refresh = () => {
    void Promise.all([
      latest.refresh(),
      featured.refresh(),
      recommended.refresh(),
      categories.refresh(),
      role.refresh(),
    ]);
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={latest.data}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        onEndReached={() => {
          if (latest.hasMore && !latest.error) void latest.loadMore();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                {t('navigation.explore')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('exploreUi.menu')}
                onPress={() => setMenu(true)}
                style={styles.add}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color={Colors.primary}
                />
              </Pressable>
            </View>
            <Text style={styles.description}>{t('explore.description')}</Text>
            <AdminArticleSearch value={search} onChange={setSearch} />
            <DataFeedback {...categories} />
            <ExploreCategories
              categories={categories.data ?? []}
              value={category}
              onChange={setCategory}
            />
            {!categories.isLoading &&
            !categories.error &&
            !categories.data?.length ? (
              <Text style={styles.description}>
                {t('exploreUi.noCategories')}
              </Text>
            ) : null}
            {search.trim() || category ? (
              <TextButton
                title={t('exploreUi.clearFilters')}
                onPress={() => {
                  setSearch('');
                  setCategory(null);
                }}
              />
            ) : null}
            <TextButton title={t('exploreUi.refresh')} onPress={refresh} />
            {browsing ? (
              <>
                <Text style={styles.section} accessibilityRole="header">
                  {t('articles.featured')}
                </Text>
                <DataFeedback {...featured} />
                {featured.isLoading && !featured.data.length ? (
                  <ArticleSkeleton />
                ) : null}
                {!featured.isLoading &&
                !featured.error &&
                !featured.data.length ? (
                  <Text style={styles.description}>
                    {t('exploreUi.noFeatured')}
                  </Text>
                ) : null}
                {featured.data.map((a) => (
                  <ArticleCard key={a.id} article={a} featured />
                ))}
                <Text style={styles.section} accessibilityRole="header">
                  {t('cms.forYou')}
                </Text>
                <Text style={styles.description}>
                  {t('cms.recommendationInfo')}
                </Text>
                <DataFeedback {...recommended} />
                {recommended.isLoading && !recommended.data.length ? (
                  <ArticleSkeleton />
                ) : null}
                {!recommended.isLoading &&
                !recommended.error &&
                !recommendations.length ? (
                  <Text style={styles.description}>
                    {t('exploreUi.noRecommended')}
                  </Text>
                ) : null}
                {recommendations.map((a) => (
                  <ArticleCard key={a.id} article={a} recommendation />
                ))}
              </>
            ) : null}
            <Text style={styles.section} accessibilityRole="header">
              {t(search.trim() ? 'cms.searchResults' : 'explore.recent')}
            </Text>
            <DataFeedback {...latest} />
            {latest.isLoading && !latest.data.length ? (
              <ArticleSkeleton />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !latest.isLoading && !latest.error ? (
            <View style={styles.header}>
              <Text style={styles.section}>
                {t(
                  search.trim()
                    ? 'exploreUi.noSearch'
                    : category
                      ? 'exploreUi.noCategory'
                      : 'explore.empty'
                )}
              </Text>
              <Text style={styles.description}>{t('explore.emptyHint')}</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          latest.hasMore ? (
            <TextButton
              title={t('cms.loadMore')}
              loading={latest.loadingMore}
              onPress={latest.loadMore}
            />
          ) : undefined
        }
        refreshing={latest.isLoading}
        onRefresh={refresh}
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              <Text style={styles.section}>{t('exploreUi.menu')}</Text>
              {[
                {
                  label: 'cms.savedArticles',
                  route: '/article/saved' as const,
                },
                {
                  label: 'cms.readHistory',
                  route: '/article/history' as const,
                },
                {
                  label: 'cms.chooseInterests',
                  route: '/article/interests' as const,
                },
                ...(role.data === 'admin'
                  ? [
                      { label: 'cms.manageArticles', route: '/admin' as const },
                      {
                        label: 'cms.newArticle',
                        route: '/admin/editor/new' as const,
                      },
                    ]
                  : []),
              ].map((action) => (
                <TextButton
                  key={action.label}
                  title={t(action.label)}
                  onPress={() => {
                    setMenu(false);
                    router.push(action.route);
                  }}
                />
              ))}
              <TextButton
                title={t('common.cancel')}
                onPress={() => setMenu(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  add: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
  },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: 12, paddingTop: 16 },
  title: { fontSize: 30, fontWeight: '700', color: Colors.textPrimary },
  description: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  section: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginVertical: 12,
  },
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  search: {
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 48,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap' },
});

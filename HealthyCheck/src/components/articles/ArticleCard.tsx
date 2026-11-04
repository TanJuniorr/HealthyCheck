import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { articleLanguage, categoryName } from '../../lib/articleContent';
import type { ArticleCardRow } from '../../types/articles';
import { ArticleImage } from './ArticleImage';
import { BookmarkButton } from './BookmarkButton';
export function ArticleCard({
  article,
  featured = false,
  recommendation = false,
  onBookmarkChanged,
}: {
  article: ArticleCardRow;
  featured?: boolean;
  recommendation?: boolean;
  onBookmarkChanged?: () => void;
}) {
  const [width, setWidth] = useState(0),
    compact = !featured && width >= 600;
  const styles = useThemedStyles(baseStyles),
    { t, i18n } = useTranslation();
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.card}
    >
      <View style={styles.bookmark}>
        <BookmarkButton
          id={article.id}
          saved={article.is_bookmarked}
          onChanged={onBookmarkChanged}
        />
      </View>
      <TouchableOpacity
        style={
          compact ? { flexDirection: 'row', alignItems: 'center' } : undefined
        }
        accessibilityRole="button"
        accessibilityLabel={article.title}
        onPress={() =>
          router.push({ pathname: '/article/[id]', params: { id: article.id } })
        }
      >
        <View style={{ width: compact ? '38%' : '100%' }}>
          <ArticleImage
            path={article.cover_image_path}
            label={article.title}
            widescreen
          />
        </View>
        <View
          style={[
            styles.body,
            compact && { flex: 1, minWidth: 0, paddingRight: 58 },
          ]}
        >
          <Text style={styles.category}>
            {categoryName(article.category, i18n.resolvedLanguage ?? 'vi')} ·{' '}
            {t('articles.readTime', {
              count: article.reading_time_minutes ?? 1,
            })}
          </Text>
          <Text
            style={[styles.title, featured && { fontSize: 22, lineHeight: 30 }]}
            numberOfLines={3}
          >
            {article.title || t('cms.untitled')}
          </Text>
          <Text style={styles.summary} numberOfLines={2}>
            {article.summary}
          </Text>
          {article.language !==
          articleLanguage(i18n.resolvedLanguage ?? 'vi') ? (
            <Text style={styles.summary}>
              {t('cms.languageFallback', {
                language: t(`cms.languages.${article.language}`),
              })}
            </Text>
          ) : null}
          {recommendation ? (
            <Text style={styles.category}>
              {t(`cms.reasons.${article.reason}`)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  body: { padding: 16, gap: 8 },
  bookmark: { position: 'absolute', right: 10, top: 10, zIndex: 2 },
  category: { fontSize: 12, lineHeight: 18, color: Colors.primary },
  title: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summary: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
});

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { categoryName } from '../../lib/articleContent';
import type { ArticleCategory } from '../../types/articles';
export function ExploreCategories({
  categories,
  value,
  onChange,
}: {
  categories: ArticleCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t, i18n } = useTranslation(),
    s = useThemedStyles(styles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={s.chips}
    >
      {[
        { id: null, label: t('category.all') },
        ...categories.map((c) => ({
          id: c.id,
          label: categoryName(c, i18n.resolvedLanguage ?? 'vi'),
        })),
      ].map((c) => (
        <Pressable
          key={c.id ?? 'all'}
          accessibilityRole="button"
          accessibilityLabel={c.label}
          accessibilityState={{ selected: value === c.id }}
          onPress={() => onChange(c.id)}
          style={[s.chip, value === c.id && s.selected]}
        >
          <Text style={[s.label, value === c.id && { color: Colors.primary }]}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function ArticleSkeleton() {
  const s = useThemedStyles(styles),
    { t } = useTranslation();
  return (
    <View accessibilityLabel={t('common.loading')} style={s.skeleton}>
      <View style={s.image} />
      <View style={s.line} />
      <View style={[s.line, { width: '65%' }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  chips: { gap: 8, paddingVertical: 8 },
  chip: {
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  skeleton: {
    borderRadius: 18,
    padding: 12,
    gap: 12,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.divider,
  },
  line: {
    height: 18,
    width: '90%',
    backgroundColor: Colors.divider,
    borderRadius: 6,
  },
});

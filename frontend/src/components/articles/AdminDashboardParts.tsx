import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { categoryName } from '../../lib/articleContent';
import { formatDate, formatNumber } from '../../i18n/formatting';
import type {
  ArticleCardRow,
  ArticleStats,
  ArticleStatus,
} from '../../types/articles';
import { ArticleImage } from './ArticleImage';
import { TextButton } from '../common/Buttons';

export function AdminDashboardStats({
  data,
  wide,
}: {
  data: ArticleStats | null;
  wide: boolean;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(styles);
  return (
    <View style={s.stats}>
      {(['total', 'published', 'draft', 'archived'] as const).map((key) => (
        <View key={key} style={[s.stat, { width: wide ? '23.5%' : '48%' }]}>
          <Text style={s.note}>{t(`cms.status.${key}`)}</Text>
          <Text style={s.number}>{data ? formatNumber(data[key]) : '—'}</Text>
        </View>
      ))}
    </View>
  );
}
export function AdminArticleSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(styles);
  return (
    <View style={s.search}>
      <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
      <TextInput
        style={s.input}
        accessibilityLabel={t('cms.dashboardUi.search')}
        placeholder={t('cms.dashboardUi.search')}
        placeholderTextColor={Colors.textMuted}
        maxLength={160}
        value={value}
        onChangeText={onChange}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cms.dashboardUi.clear')}
          onPress={() => onChange('')}
          style={s.icon}
        >
          <Ionicons
            name="close-circle"
            size={22}
            color={Colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
export function AdminArticleStatusFilter({
  value,
  onChange,
}: {
  value: ArticleStatus | null;
  onChange: (s: ArticleStatus | null) => void;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(styles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
    >
      {([null, 'published', 'draft', 'archived'] as const).map((status) => (
        <Pressable
          key={status ?? 'all'}
          accessibilityRole="tab"
          accessibilityState={{ selected: status === value }}
          onPress={() => onChange(status)}
          style={[s.chip, status === value && s.active]}
        >
          <Text
            style={[
              s.note,
              status === value && { color: Colors.primary, fontWeight: '700' },
            ]}
          >
            {t(status ? `cms.status.${status}` : 'category.all')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function AdminArticleTableHeader() {
  const { t } = useTranslation(),
    s = useThemedStyles(styles);
  return (
    <View style={s.tableHeader}>
      {['article', 'category', 'status', 'updated', 'actions'].map((key, i) => (
        <Text
          key={key}
          style={[s.note, i === 0 ? s.article : i === 4 ? s.actions : s.column]}
        >
          {t(
            key === 'category'
              ? 'cms.category'
              : key === 'status'
                ? 'cms.dashboardUi.status'
                : key === 'actions'
                  ? 'cms.actions'
                  : `cms.dashboardUi.${key}`
          )}
        </Text>
      ))}
    </View>
  );
}
export const AdminArticleManagementCard = React.memo(
  function AdminArticleManagementCard({
    item,
    wide,
    onEdit,
    onPreview,
    onMore,
  }: {
    item: ArticleCardRow;
    wide: boolean;
    onEdit: () => void;
    onPreview: () => void;
    onMore: () => void;
  }) {
    const { t, i18n } = useTranslation(),
      s = useThemedStyles(styles);
    const category = categoryName(item.category, i18n.resolvedLanguage ?? 'vi');
    const information = (
      <View style={[s.info, wide && s.article]}>
        <View style={s.thumbnail}>
          <ArticleImage
            path={item.cover_image_path}
            label={item.title || t('cms.untitled')}
            thumbnail
          />
        </View>
        <View style={s.titleArea}>
          <Text numberOfLines={3} style={s.title}>
            {item.title || t('cms.untitled')}
          </Text>
          {!wide ? <Text style={s.note}>{category}</Text> : null}
          <Text style={s.note}>{t(`cms.languages.${item.language}`)}</Text>
        </View>
      </View>
    );
    const status = (
      <Text style={s.badge}>{t(`cms.status.${item.status}`)}</Text>
    );
    const actions = (
      <View style={[s.actionRow, wide && s.actions]}>
        <TextButton
          title={t('cms.preview')}
          onPress={onPreview}
          style={s.actionButton}
        />
        <TextButton
          title={t('common.edit')}
          onPress={onEdit}
          style={s.actionButton}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cms.dashboardUi.actionsFor', {
            title: item.title || t('cms.untitled'),
          })}
          onPress={onMore}
          style={s.icon}
        >
          <Ionicons
            name="ellipsis-horizontal"
            color={Colors.textPrimary}
            size={22}
          />
        </Pressable>
      </View>
    );
    return (
      <View style={[s.card, wide && s.tableRow]}>
        {information}
        {wide ? (
          <>
            <Text style={[s.note, s.column]}>{category}</Text>
            <View style={s.column}>{status}</View>
            <Text style={[s.note, s.column]}>
              {formatDate(item.updated_at)}
            </Text>
          </>
        ) : (
          <View style={s.metadata}>
            {status}
            <Text style={s.note}>{formatDate(item.updated_at)}</Text>
          </View>
        )}
        {actions}
      </View>
    );
  }
);
const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  stat: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
    minHeight: 110,
  },
  number: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  active: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    gap: 14,
  },
  info: { flexDirection: 'row', gap: 12, alignItems: 'center', minWidth: 0 },
  thumbnail: { width: 72, height: 72, overflow: 'hidden', borderRadius: 12 },
  titleArea: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  badge: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 8,
  },
  actionButton: { flex: 1, minWidth: 0, minHeight: 44 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  article: { flex: 3, minWidth: 0 },
  column: { flex: 1, minWidth: 0 },
  actions: { flex: 2, minWidth: 0, borderTopWidth: 0, paddingTop: 0 },
});

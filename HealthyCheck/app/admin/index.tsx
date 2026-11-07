import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { Colors } from '../../src/constants/colors';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { useArticleFeed } from '../../src/hooks/useArticleFeed';
import {
  getArticleStats,
  changeArticleStatus,
  deleteArticle,
} from '../../src/services/articlesService';
import { articleLanguage } from '../../src/lib/articleContent';
import {
  AdminDashboardStats,
  AdminArticleSearch,
  AdminArticleStatusFilter,
  AdminArticleTableHeader,
  AdminArticleManagementCard,
} from '../../src/components/articles/AdminDashboardParts';
import { TextButton, PrimaryButton } from '../../src/components/common/Buttons';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { dataError } from '../../src/lib/dataErrors';
import { localizeMessage } from '../../src/i18n/localize';
import type { ArticleCardRow, ArticleStatus } from '../../src/types/articles';
export default function AdminDashboard() {
  const [width, setWidth] = useState(0),
    [success, setSuccess] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const wide = width >= 1100;
  const { t, i18n } = useTranslation(),
    styles = useThemedStyles(baseStyles),
    [status, setStatus] = useState<ArticleStatus | null>(null),
    [search, setSearch] = useState('');
  const stats = useHealthQuery(getArticleStats, 'article-admin-stats'),
    feed = useArticleFeed({
      language: articleLanguage(i18n.resolvedLanguage ?? 'vi'),
      mode: 'admin',
      status,
      search,
    });
  const [selected, setSelected] = useState<ArticleCardRow | null>(null),
    [action, setAction] = useState<ArticleStatus | 'delete' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    lock = useRef(false);
  const mutate = async () => {
    if (lock.current || !selected || !action) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === 'delete')
        await deleteArticle(selected.id, selected.updated_at);
      else await changeArticleStatus(selected.id, selected.updated_at, action);
      if (!alive.current) return;
      setSelected(null);
      setAction(null);
      setSuccess(true);
      await Promise.all([stats.refresh(), feed.refresh()]);
    } catch (e) {
      if (alive.current) setError(dataError(e).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event) =>
        setWidth(Math.min(1200, event.nativeEvent.layout.width))
      }
    >
      <FlatList
        data={feed.data}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { padding: width < 600 ? 16 : 24 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={{ alignSelf: 'flex-start', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/explore');
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {t('cms.dashboard')}
            </Text>
            <DataFeedback {...stats} />
            <AdminDashboardStats data={stats.data} wide={wide} />
            <View style={styles.row}>
              <PrimaryButton
                title={t('cms.newArticle')}
                onPress={() => router.push('/admin/editor/new')}
              />
              <TextButton
                title={t('cms.categories')}
                onPress={() => router.push('/admin/categories')}
              />
              <TextButton
                title={t('monitor.title')}
                onPress={() => router.push('/admin/monitoring')}
              />
            </View>
            <AdminArticleSearch value={search} onChange={setSearch} />
            <AdminArticleStatusFilter value={status} onChange={setStatus} />
            <Text style={styles.text}>{t('cms.recentlyEdited')}</Text>
            {success ? (
              <Text accessibilityLiveRegion="polite" style={styles.note}>
                {t('cms.dashboardUi.updatedSuccess')}
              </Text>
            ) : null}
            <DataFeedback {...feed} />
            {wide ? <AdminArticleTableHeader /> : null}
          </View>
        }
        refreshing={feed.isLoading}
        onRefresh={() => {
          void Promise.all([stats.refresh(), feed.refresh()]);
        }}
        ListEmptyComponent={
          !feed.isLoading && !feed.error ? (
            <View style={styles.empty}>
              <Text style={styles.text}>
                {t(
                  search.trim()
                    ? 'cms.dashboardUi.noSearch'
                    : status
                      ? 'cms.dashboardUi.noFilter'
                      : 'cms.dashboardUi.noArticles'
                )}
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          feed.hasMore ? (
            <TextButton
              title={t('cms.loadMore')}
              loading={feed.loadingMore}
              onPress={feed.loadMore}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <AdminArticleManagementCard
            item={item}
            wide={wide}
            onPreview={() =>
              router.push({
                pathname: '/article/[id]',
                params: { id: item.id },
              })
            }
            onEdit={() =>
              router.push({
                pathname: '/admin/editor/[id]',
                params: { id: item.id },
              })
            }
            onMore={() => {
              setSelected(item);
              setAction(null);
              setError(null);
              setSuccess(false);
            }}
          />
        )}
      />
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ScrollView
              contentContainerStyle={{ gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>
                {action
                  ? t(
                      action === 'delete'
                        ? 'cms.confirmDelete'
                        : action === 'published'
                          ? 'cms.confirmPublish'
                          : 'cms.confirmStatus'
                    )
                  : selected?.title || t('cms.untitled')}
              </Text>
              <Text style={styles.text}>
                {selected?.title || t('cms.untitled')}
              </Text>
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {localizeMessage(error)}
                </Text>
              ) : null}
              {action ? (
                <>
                  <Text style={styles.note}>
                    {t(
                      action === 'published'
                        ? 'cms.missingTranslationHint'
                        : 'cms.confirmActionHint'
                    )}
                  </Text>
                  <PrimaryButton
                    title={t('cms.confirm')}
                    loading={busy}
                    onPress={mutate}
                  />
                </>
              ) : (
                <>
                  <TextButton
                    title={t('cms.preview')}
                    onPress={() => {
                      const id = selected!.id;
                      setSelected(null);
                      router.push({
                        pathname: '/article/[id]',
                        params: { id },
                      });
                    }}
                  />
                  <TextButton
                    title={t('common.edit')}
                    onPress={() => {
                      const id = selected!.id;
                      setSelected(null);
                      router.push({
                        pathname: '/admin/editor/[id]',
                        params: { id },
                      });
                    }}
                  />
                  {selected?.status !== 'published' &&
                  selected?.status !== 'archived' ? (
                    <TextButton
                      title={t('cms.publish')}
                      onPress={() => setAction('published')}
                    />
                  ) : selected?.status === 'published' ? (
                    <TextButton
                      title={t('cms.unpublish')}
                      onPress={() => setAction('draft')}
                    />
                  ) : null}
                  {selected?.status === 'archived' ? (
                    <TextButton
                      title={t('cms.editor.restoreDraft')}
                      onPress={() => setAction('draft')}
                    />
                  ) : (
                    <TextButton
                      title={t('cms.archive')}
                      onPress={() => setAction('archived')}
                    />
                  )}
                  <TextButton
                    title={t('common.delete')}
                    color={Colors.error}
                    onPress={() => setAction('delete')}
                  />
                </>
              )}
              <TextButton
                title={t('common.cancel')}
                disabled={busy}
                onPress={() => {
                  setSelected(null);
                  setAction(null);
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 16,
    gap: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  error: { color: Colors.error },
  content: {
    padding: 24,
    gap: 12,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  empty: { padding: 24, borderRadius: 16, backgroundColor: Colors.surface },
  header: { gap: 16 },
  title: { fontSize: 26, color: Colors.textPrimary, fontWeight: '700' },
  text: { fontSize: 16, lineHeight: 24, color: Colors.textPrimary },
  note: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: {
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    minWidth: 130,
    gap: 8,
    flexGrow: 1,
  },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
});

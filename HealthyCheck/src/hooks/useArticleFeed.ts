import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { getArticleFeed, type ArticleQuery } from '../services/articlesService';
import { dataError } from '../lib/dataErrors';
import type { ArticlePage } from '../types/articles';
import { subscribeArticleBookmarks } from '../lib/articleBookmarkEvents';
type State = ArticlePage & {
  key: string;
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
};
export function useArticleFeed(options: ArticleQuery) {
  const { user } = useAuth(),
    owner = user?.id ?? null;
  const {
    language,
    search = '',
    category = null,
    mode = 'latest',
    status = null,
    pageSize = 12,
  } = options;
  const query = search.normalize('NFC').trim(),
    key = JSON.stringify([
      owner,
      language,
      query,
      category,
      mode,
      status,
      pageSize,
    ]);
  const [state, setState] = useState<State>({
    key: '',
    data: [],
    total: 0,
    page: 0,
    hasMore: false,
    isLoading: false,
    loadingMore: false,
    error: null,
  });
  const generation = useRef(0),
    loading = useRef<string | null>(null);
  const pages = useRef({ key: '', count: 1 });
  const bookmarks = useRef({
    revision: 0,
    changes: new Map<string, { revision: number; saved: boolean }>(),
  });
  const reconcileBookmarks = useCallback(
    (rows: State['data'], revision: number) =>
      rows
        .map((row) => {
          const change = bookmarks.current.changes.get(owner + ':' + row.id);
          return change && change.revision > revision
            ? { ...row, is_bookmarked: change.saved }
            : row;
        })
        .filter((row) => mode !== 'bookmarks' || row.is_bookmarked),
    [owner, mode]
  );
  useEffect(
    () =>
      subscribeArticleBookmarks((change) => {
        if (change.owner !== owner) return;
        bookmarks.current.changes.set(owner + ':' + change.id, {
          revision: ++bookmarks.current.revision,
          saved: change.saved,
        });
        setState((s) => ({
          ...s,
          data:
            mode === 'bookmarks' && !change.saved
              ? s.data.filter((a) => a.id !== change.id)
              : s.data.map((a) =>
                  a.id === change.id ? { ...a, is_bookmarked: change.saved } : a
                ),
        }));
      }),
    [owner, mode]
  );
  const refresh = useCallback(async () => {
    if (!owner) return;
    const request = ++generation.current;
    const bookmarkRevision = bookmarks.current.revision;
    loading.current = null;
    setState((previous) => ({
      ...previous,
      key,
      data: previous.key === key ? previous.data : [],
      total: previous.key === key ? previous.total : 0,
      page: 0,
      hasMore: false,
      isLoading: true,
      loadingMore: false,
      error: null,
    }));
    try {
      const count =
        mode !== 'admin' && pages.current.key === key ? pages.current.count : 1;
      const results = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          getArticleFeed({
            language,
            search: query,
            category,
            mode,
            status,
            pageSize,
            page: index + 1,
          })
        )
      );
      const result = results[results.length - 1];
      if (generation.current === request) {
        pages.current = { key, count };
        setState({
          key,
          ...result,
          data: reconcileBookmarks(
            [
              ...new Map(
                results.flatMap((page) => page.data).map((a) => [a.id, a])
              ).values(),
            ],
            bookmarkRevision
          ),
          isLoading: false,
          loadingMore: false,
          error: null,
        });
      }
    } catch (error) {
      if (generation.current === request)
        setState({
          key,
          data: [],
          total: 0,
          page: 0,
          hasMore: false,
          isLoading: false,
          loadingMore: false,
          error: dataError(error).message,
        });
    }
  }, [
    owner,
    key,
    language,
    query,
    category,
    mode,
    status,
    pageSize,
    reconcileBookmarks,
  ]);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(
        () => {
          void refresh();
        },
        query ? 300 : 0
      );
      return () => {
        clearTimeout(timer);
        generation.current++;
        loading.current = null;
      };
    }, [refresh, query])
  );
  const matches = !!owner && state.key === key;
  const loadMore = useCallback(async () => {
    if (
      !matches ||
      state.isLoading ||
      state.loadingMore ||
      !state.hasMore ||
      loading.current === key
    )
      return;
    const request = generation.current;
    const bookmarkRevision = bookmarks.current.revision;
    loading.current = key;
    setState((s) => ({ ...s, loadingMore: true, error: null }));
    try {
      const result = await getArticleFeed({
        language,
        search: query,
        category,
        mode,
        status,
        pageSize,
        page: state.page + 1,
      });
      if (generation.current === request) {
        pages.current = { key, count: result.page };
        setState((s) => ({
          ...s,
          ...result,
          data: reconcileBookmarks(
            [
              ...new Map(
                [...s.data, ...result.data].map((a) => [a.id, a])
              ).values(),
            ],
            bookmarkRevision
          ),
          loadingMore: false,
          error: null,
        }));
      }
    } catch (error) {
      if (generation.current === request)
        setState((s) => ({
          ...s,
          loadingMore: false,
          error: dataError(error).message,
        }));
    } finally {
      if (generation.current === request) loading.current = null;
    }
  }, [
    matches,
    state.isLoading,
    state.loadingMore,
    state.hasMore,
    state.page,
    key,
    language,
    query,
    category,
    mode,
    status,
    pageSize,
    reconcileBookmarks,
  ]);
  return {
    data: matches ? state.data : [],
    total: matches ? state.total : 0,
    hasMore: matches && state.hasMore,
    isLoading: !!owner && (!matches || state.isLoading),
    loadingMore: matches && state.loadingMore,
    error: matches ? state.error : null,
    refresh,
    loadMore,
  };
}

import React, { useEffect, useRef, useState } from 'react';
import { Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  publishArticleBookmark,
  subscribeArticleBookmarks,
} from '../../lib/articleBookmarkEvents';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { setArticleBookmark } from '../../services/articlesService';
import { dataError } from '../../lib/dataErrors';
import { localizeMessage } from '../../i18n/localize';
import { Colors } from '../../constants/colors';
type Props = { id: string; saved: boolean; onChanged?: () => void };
export function BookmarkButton(props: Props) {
  const { user } = useAuth();
  return (
    <BookmarkControl
      key={`${user?.id}:${props.id}:${props.saved}`}
      {...props}
      owner={user?.id}
    />
  );
}
export function BookmarkControl({
  id,
  saved,
  onChanged,
  owner,
}: Props & { owner?: string }) {
  const { t } = useTranslation(),
    [value, setValue] = useState(saved),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () =>
      subscribeArticleBookmarks((change) => {
        if (change.owner === owner && change.id === id) setValue(change.saved);
      }),
    [owner, id]
  );
  const toggle = async () => {
    if (lock.current || !owner) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await setArticleBookmark(id, !value);
      if (mounted.current) {
        setValue(!value);
        publishArticleBookmark({ owner, id, saved: !value });
        onChanged?.();
      }
    } catch (e) {
      if (mounted.current) setError(dataError(e).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          value ? 'articles.removeBookmark' : 'articles.bookmark'
        )}
        accessibilityState={{ disabled: busy || !owner, busy, selected: value }}
        disabled={busy || !owner}
        onPress={(event) => {
          event.stopPropagation();
          return toggle();
        }}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 22,
          backgroundColor: Colors.primaryLight,
        }}
      >
        {busy ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Ionicons
            name={value ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={Colors.primary}
          />
        )}
      </Pressable>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: Colors.error, maxWidth: 220 }}
        >
          {localizeMessage(error)}
        </Text>
      ) : null}
    </View>
  );
}

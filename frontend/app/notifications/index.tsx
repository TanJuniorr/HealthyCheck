import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Colors } from '../../src/constants/colors';
import { Radius, Shadows, Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useNotificationInbox } from '../../src/contexts/NotificationInboxContext';
import type { InboxNotification } from '../../src/services/notificationInboxService';
import { notificationPresentation } from '../../src/services/notificationPresentation';

function formatReceivedAt(value: string, locale: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function NotificationsScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { items, refresh, markRead, remoteInboxStatus } = useNotificationInbox();

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const openItem = async (item: InboxNotification) => {
    await markRead(item.id);
    router.push({ pathname: '/notifications/[id]', params: { id: item.id } });
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('notifications.title')} />
      <ScreenContainer>
        {remoteInboxStatus === 'missing' ? (
          <Text accessibilityRole="alert" style={styles.setupWarning}>{t('notifications.shareSetupRequired')}</Text>
        ) : null}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="notifications-off-outline" size={28} color={Colors.primary} /></View>
            <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('notifications.emptyBody')}</Text>
          </View>
        ) : items.map(item => {
          const copy = notificationPresentation(item, t);
          return (
          <TouchableOpacity
            key={item.id}
            style={[styles.notificationCard, !item.readAt && styles.unreadCard]}
            onPress={() => void openItem(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${copy.title}. ${copy.body}`}
          >
            <View style={styles.notificationIcon}><Ionicons name="notifications-outline" size={20} color={Colors.primary} /></View>
            <View style={styles.notificationCopy}>
              <View style={styles.titleRow}>
              <Text style={styles.notificationTitle} numberOfLines={1}>{copy.title}</Text>
                {!item.readAt ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.notificationBody} numberOfLines={2}>{copy.body}</Text>
              <Text style={styles.notificationTime}>{formatReceivedAt(item.receivedAt, i18n.language)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  notificationCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, ...Shadows.sm,
  },
  unreadCard: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  notificationIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  notificationCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notificationTitle: { ...Typography.cardTitle, color: Colors.textPrimary, flex: 1 },
  notificationBody: { ...Typography.supporting, color: Colors.textSecondary, marginTop: 3 },
  notificationTime: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: Spacing.xs },
  setupWarning: { ...Typography.supporting, color: Colors.error, backgroundColor: '#FFF1F0', padding: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.md },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl * 2 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  emptyTitle: { ...Typography.sectionTitle, color: Colors.textPrimary, textAlign: 'center' },
  emptyBody: { ...Typography.supporting, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
});

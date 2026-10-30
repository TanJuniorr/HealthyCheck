import React, { useCallback, useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Colors } from '../../src/constants/colors';
import { Radius, Shadows, Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useNotificationInbox } from '../../src/contexts/NotificationInboxContext';
import { notificationPresentation } from '../../src/services/notificationPresentation';

function formatReceivedAt(value: string, locale: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

export default function NotificationDetailScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, markRead } = useNotificationInbox();
  const notification = useMemo(() => items.find(item => item.id === id), [id, items]);
  const copy = notification ? notificationPresentation(notification, t) : null;

  useFocusEffect(useCallback(() => {
    if (id) void markRead(id);
  }, [id, markRead]));

  return (
    <View style={styles.screen}>
      <AppHeader title={t('notifications.detailTitle')} />
      <ScreenContainer>
        {notification ? (
          <View style={styles.detailCard}>
            <View style={styles.detailIcon}><Ionicons name="notifications-outline" size={24} color={Colors.primary} /></View>
            <Text style={styles.title}>{copy?.title}</Text>
            <Text style={styles.time}>{formatReceivedAt(notification.receivedAt, i18n.language)}</Text>
            <Text style={styles.body}>{copy?.body || t('notifications.noDetails')}</Text>
          </View>
        ) : (
          <View style={styles.missingState}>
            <Text style={styles.body}>{t('notifications.notFound')}</Text>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  detailCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, marginTop: Spacing.lg, ...Shadows.sm },
  detailIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary },
  time: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: Spacing.sm },
  body: { ...Typography.body, color: Colors.textSecondary, lineHeight: 23, marginTop: Spacing.xl },
  missingState: { paddingVertical: Spacing.xxl, alignItems: 'center' },
});

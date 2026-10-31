/**
 * Màn hình "Được chia sẻ với tôi" — phía NGƯỜI NHẬN.
 * Route: /shared-with-me (file này nằm ở frontend/app/shared-with-me.tsx).
 * Muốn vào được màn này thì phải thêm <Stack.Screen name="shared-with-me" />
 * vào nhóm guard "ready" trong frontend/app/_layout.tsx (xem PATCHES.md).
 *
 * Màn này CHỈ ĐỌC, không có bất kỳ nút thêm/sửa/xóa dữ liệu nào của
 * chủ tài khoản. Khi lời mời bị tạm dừng hoặc thu hồi thì màn hình ẩn
 * số liệu ngay và chỉ còn thông báo trạng thái.
 */
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Radius, Spacing } from '../src/constants/spacing';
import { PrimaryButton, TextButton } from '../src/components/common/Buttons';
import { AppHeader } from '../src/components/common/AppHeader';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import { dataError } from '../src/lib/dataErrors';
import {
  getMySharedOwners,
  getSharedMetrics,
  subscribeSharedMetrics,
  type SharedMetrics,
  type SharedOwner,
} from '../src/services/sharedWithMeService';

function formatTime(iso: string, fallback: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function statusLabel(status: SharedOwner['status'], t: (key: string) => string): string {
  if (status === 'active') return t('sharedWithMe.statusActive');
  if (status === 'paused') return t('sharedWithMe.statusPaused');
  return t('sharedWithMe.statusRevoked');
}

export default function SharedWithMeScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [owners, setOwners] = useState<SharedOwner[]>([]);
  const [selected, setSelected] = useState<SharedOwner | null>(null);
  const [metrics, setMetrics] = useState<SharedMetrics | null>(null);
  const [isLoadingOwners, setIsLoadingOwners] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [metricsError, setMetricsError] = useState('');

  const translateError = useCallback(
    (err: unknown): string => {
      const message = dataError(err).message;
      return message.startsWith('sharedWithMe.') ? t(message) : message;
    },
    [t],
  );

  const fetchOwners = useCallback(async () => {
    setIsLoadingOwners(true);
    setLoadError('');
    try {
      const data = await getMySharedOwners();
      setOwners(data);
      setSelected((current) => {
        if (!current) return null;
        return data.find((item) => item.inviteId === current.inviteId) ?? null;
      });
    } catch (err) {
      setLoadError(translateError(err));
    } finally {
      setIsLoadingOwners(false);
    }
  }, [translateError]);

  useFocusEffect(
    useCallback(() => {
      void fetchOwners();
    }, [fetchOwners]),
  );

  const fetchMetrics = useCallback(
    async (owner: SharedOwner) => {
      setIsLoadingMetrics(true);
      setMetricsError('');
      try {
        const data = await getSharedMetrics(owner);
        setMetrics(data);
      } catch (err) {
        setMetrics(null);
        setMetricsError(translateError(err));
      } finally {
        setIsLoadingMetrics(false);
      }
    },
    [translateError],
  );

  // Khi chọn 1 chủ tài khoản đang active: tải số liệu + đăng ký Realtime.
  // Khi chủ tài khoản đó bị tạm dừng/thu hồi: hủy đăng ký, ẩn số liệu.
  useEffect(() => {
    if (!selected || selected.status !== 'active') {
      return undefined;
    }
    void Promise.resolve().then(() => fetchMetrics(selected));
const unsubscribe = subscribeSharedMetrics(
      selected.ownerId,
      () => {
        void fetchMetrics(selected);
      },
      () => {
        void (async () => {
          const fresh = await getMySharedOwners().catch(() => null);
          if (!fresh) return;
          setOwners(fresh);
          const updated = fresh.find((item) => item.inviteId === selected.inviteId) ?? null;
          setSelected(updated);
          if (!updated || updated.status !== 'active') setMetrics(null);
        })();
      },
    );
    return unsubscribe;
  }, [selected, fetchMetrics]);

  const ownerName = (owner: SharedOwner): string =>
    owner.ownerName?.trim() || t('sharedWithMe.unknownOwner');

  const renderMetricCard = (icon: string, label: string, value: string, hint: string) => (
    <View style={styles.metricCard} key={label}>
      <Ionicons name={icon as never} size={26} color={Colors.primary} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <AppHeader title={t('sharedWithMe.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.noteText}>{t('sharedWithMe.viewOnlyNote')}</Text>
        </View>

        {isLoadingOwners ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : loadError ? (
          <View>
            <Text style={styles.errorText}>{loadError}</Text>
            <PrimaryButton title={t('sharedWithMe.retry')} onPress={() => void fetchOwners()} />
          </View>
        ) : owners.length === 0 ? (
          <Text style={styles.emptyText}>{t('sharedWithMe.empty')}</Text>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>{t('sharedWithMe.ownersTitle')}</Text>
            {owners.map((owner) => {
              const isSelected = selected?.inviteId === owner.inviteId;
              return (
                <TouchableOpacity
                  key={owner.inviteId}
                  style={[styles.ownerCard, isSelected && styles.ownerCardSelected]}
                  onPress={() => setSelected(owner)}
                  accessibilityRole="button"
                  accessibilityLabel={ownerName(owner)}
                >
                  <View style={styles.ownerRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {ownerName(owner).slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.ownerInfo}>
                      <Text style={styles.ownerName}>{ownerName(owner)}</Text>
                      <Text style={styles.ownerMeta}>
                        {owner.shareSteps ? ` ${t('sharedWithMe.steps')}` : ''}
                        {owner.shareSleep ? ` ${t('sharedWithMe.sleep')}` : ''}
                        {owner.shareNutrition ? ` ${t('sharedWithMe.nutrition')}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statusBadge,
                        owner.status === 'active' && styles.statusActive,
                        owner.status === 'paused' && styles.statusPaused,
                        owner.status === 'revoked' && styles.statusRevoked,
                      ]}
                    >
                      {statusLabel(owner.status, t)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selected && selected.status !== 'active' && (
          <View style={styles.notActiveBox}>
            <Text style={styles.notActiveText}>
              {selected.status === 'paused'
                ? t('sharedWithMe.pausedNotice')
                : t('sharedWithMe.revokedNotice')}
            </Text>
          </View>
        )}

        {selected && selected.status === 'active' && (
          <View>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {t('sharedWithMe.live')}
                {metrics ? ` • ${t('sharedWithMe.updatedAt')} ${formatTime(metrics.updatedAt, '')}` : ''}
              </Text>
            </View>

            {isLoadingMetrics && !metrics ? (
              <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            ) : metricsError ? (
              <View>
                <Text style={styles.errorText}>{metricsError}</Text>
                <PrimaryButton
                  title={t('sharedWithMe.retry')}
                  onPress={() => void fetchMetrics(selected)}
                />
              </View>
            ) : metrics ? (
              <View style={styles.metricsGrid}>
                {selected.shareSteps &&
                  renderMetricCard(
                    'footsteps-outline',
                    t('sharedWithMe.stepsToday'),
                    metrics.stepsToday === null ? '—' : String(metrics.stepsToday),
                    t('sharedWithMe.stepsTodayHint'),
                  )}
                {selected.shareSleep &&
                  renderMetricCard(
                    'moon-outline',
                    t('sharedWithMe.sleepLast'),
                    metrics.sleepLastHours === null ? '—' : `${metrics.sleepLastHours} ${t('sharedWithMe.hours')}`,
                    metrics.sleepLastDate
                      ? `${t('sharedWithMe.sleepDate')} ${metrics.sleepLastDate}`
                      : t('sharedWithMe.noSleepData'),
                  )}
                {selected.shareNutrition &&
                  renderMetricCard(
                    'nutrition-outline',
                    t('sharedWithMe.nutritionToday'),
                    metrics.nutritionTodayKcal === null ? '—' : `${metrics.nutritionTodayKcal} kcal`,
                    metrics.mealsToday === null
                      ? t('sharedWithMe.noNutritionData')
                      : `${metrics.mealsToday} ${t('sharedWithMe.meals')}`,
                  )}
              </View>
            ) : null}

            <TextButton
              title={t('sharedWithMe.reload')}
              onPress={() => void fetchMetrics(selected)}
            />
            <Text style={styles.viewOnlyText}>{t('sharedWithMe.viewOnlyNote')}</Text>
            <Text style={styles.viewOnlyText}>{t('sharedWithMe.notSharedNote')}</Text>
          </View>
        )}

        {selected && (
          <PrimaryButton
            title={t('sharedWithMe.backToList')}
            onPress={() => {
              setSelected(null);
              setMetrics(null);
            }}
          />
        )}

        <TextButton title={t('sharedWithMe.backToSharing')} onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screenPadding, paddingBottom: Spacing.xxl },
  loader: { marginTop: Spacing.xxl },
  noteBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  noteText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1, lineHeight: 19 },
  sectionTitle: { ...Typography.cardTitle, color: Colors.textPrimary, marginBottom: Spacing.md },
  ownerCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  ownerCardSelected: { borderColor: Colors.primary, borderWidth: 2 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.cardTitle, color: Colors.primary },
  ownerInfo: { flex: 1 },
  ownerName: { ...Typography.cardTitle, color: Colors.textPrimary },
  ownerMeta: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { ...Typography.labelSmall, color: Colors.textMuted },
  statusActive: { color: Colors.success },
  statusPaused: { color: Colors.warning },
  statusRevoked: { color: Colors.error },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xxl },
  errorText: { ...Typography.body, color: Colors.error, textAlign: 'center', marginVertical: Spacing.lg },
  notActiveBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  notActiveText: { ...Typography.body, color: Colors.textPrimary, textAlign: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  liveText: { ...Typography.bodySmall, color: Colors.textSecondary },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.lg },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 4,
  },
  metricLabel: { ...Typography.labelSmall, color: Colors.primary, marginTop: Spacing.sm },
  metricValue: { ...Typography.cardTitle, color: Colors.textPrimary },
  metricHint: { ...Typography.bodySmall, color: Colors.textSecondary },
  viewOnlyText: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});

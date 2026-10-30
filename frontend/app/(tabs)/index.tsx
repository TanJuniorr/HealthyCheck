import { useTranslation } from 'react-i18next';
import { formatNumber,formatDate,formatDuration } from '../../src/i18n/formatting';
import { localizeStaticData } from '../../src/i18n/localize';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Layout } from '../../src/constants/spacing';
import { ProgressRing } from '../../src/components/charts/ProgressRing';
import { HealthMetricCard, StatPill } from '../../src/components/health/HealthComponents';
import { SectionHeader } from '../../src/components/common/AppHeader';
import { ArticleCard } from '../../src/components/articles/ArticleCard';
import { MockAvatar } from '../../src/components/common/MockAvatar';
import { dailyHighlights as rawHighlightDefinitions } from '../../src/data/health';
import { useArticleFeed } from '../../src/hooks/useArticleFeed';
import { articleLanguage } from '../../src/lib/articleContent';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWeeklyOverview } from '../../src/hooks/healthHooks';
import { toLocalDateKey } from '../../src/lib/dateUtils';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { displayName, initials, profileText } from '../../src/lib/profileRepository';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { createAvatarSignedUrl } from '../../src/services/avatarService';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useNotificationInbox } from '../../src/contexts/NotificationInboxContext';
import { calculateHealthScore, HEALTH_SCORE_LOW_NOTIFICATION_MINIMUM_METRICS, HEALTH_SCORE_LOW_THRESHOLD, HEALTH_SCORE_MINIMUM_METRICS } from '../../src/lib/healthScore';
import { notifyLowHealthScore } from '../../src/services/healthNotifications';
import { getCyclePrediction } from '../../src/lib/menstrualCycleCalculations';
import { getMyMenstrualCycleSettings } from '../../src/services/menstrualCycleService';

export default function OverviewScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t,i18n } = useTranslation();
  const highlightDefinitions = localizeStaticData(rawHighlightDefinitions);
  const articleQuery = useArticleFeed({language:articleLanguage(i18n.resolvedLanguage??'vi'),mode:'featured',pageSize:1});

  const router = useRouter();
  const { user, profile } = useAuth();
  const { unreadCount, notificationsEnabled } = useNotificationInbox();
  const [clockTime, setClockTime] = useState(() => new Date());
  const avatarPath = profileText(profile,'avatar_url');
  const avatarQuery = useHealthQuery(async () => {
    if (!avatarPath) return null;
    return /^https:\/\//i.test(avatarPath) ? avatarPath : createAvatarSignedUrl(avatarPath);
  },'overview-avatar:'+String(user?.id ?? 'signed-out')+':'+String(avatarPath ?? 'none'));
  const [failedAvatarUrl,setFailedAvatarUrl] = useState<string | null>(null);
  const hasName = Boolean(profile?.full_name?.trim() || (typeof user?.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()));
  const name = hasName ? displayName(user,profile) : t('profile.member');
  const greetingNameParts = name.trim().split(/\s+/).filter(Boolean);
  const greetingName = greetingNameParts[greetingNameParts.length - 1] || t('profile.member');
  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const hour = clockTime.getHours();
  const greetingKey = hour >= 5 && hour < 12
    ? 'overview.greetingMorning'
    : hour >= 12 && hour < 18
      ? 'overview.greetingAfternoon'
      : 'overview.greetingEvening';
  const insets = useSafeAreaInsets();
  const today = toLocalDateKey();
  const cycleSettingsQuery = useHealthQuery(
    () => profile?.gender === 'female' ? getMyMenstrualCycleSettings() : Promise.resolve(null),
    `overview-cycle:${profile?.gender ?? 'unknown'}`,
  );
  const cyclePrediction = profile?.gender === 'female' ? getCyclePrediction(today, cycleSettingsQuery.data) : null;
  const week = useWeeklyOverview(today); const query = week; const summary = week.data?.find(day => day.date === today) ?? null;
  const healthScoreResult = calculateHealthScore(summary);
  const scoreBand = healthScoreResult.score === null ? null
    : healthScoreResult.score < HEALTH_SCORE_LOW_THRESHOLD ? 'low'
      : healthScoreResult.score < 60 ? 'building'
        : healthScoreResult.score < 80 ? 'good' : 'excellent';
  const healthScore = {
    score: healthScoreResult.score === null ? '—' : String(healthScoreResult.score),
    progress: healthScoreResult.score === null ? 0 : healthScoreResult.score / 100,
    status: scoreBand ? t(`overview.scoreStatus.${scoreBand}`) : t('common.notAvailable'),
    description: healthScoreResult.score === null
      ? t('overview.scoreInsufficientData', { minimum: HEALTH_SCORE_MINIMUM_METRICS, total: healthScoreResult.totalMetricCount })
      : t('overview.scoreCoverage', { count: healthScoreResult.availableMetricCount, total: healthScoreResult.totalMetricCount }),
  };
  useEffect(() => {
    const score = healthScoreResult.score;
    if (!user?.id || score === null || score >= HEALTH_SCORE_LOW_THRESHOLD || healthScoreResult.availableMetricCount < HEALTH_SCORE_LOW_NOTIFICATION_MINIMUM_METRICS) return;
    void notifyLowHealthScore(
      user.id,
      score,
      t('notifications.lowHealthScoreTitle'),
      t('notifications.lowHealthScoreBody', { score }),
    );
  }, [user?.id, notificationsEnabled, healthScoreResult.score, healthScoreResult.availableMetricCount, t]);
  const dailyHighlights = highlightDefinitions
    .filter(item => item.id !== 'cycle' || profile?.gender === 'female')
    .map(item => {
      const stepsGoal = summary?.steps.goal;
      const caloriesGoal = summary?.nutrition.calorieGoal;
      const waterGoal = summary?.water.goalMl;
      const ratio = (current: number | null | undefined, goal: number | null | undefined, digits = 0) => `${formatNumber(current, digits)}/${formatNumber(goal, digits)}`;
      const progress = (current: number | null | undefined, goal: number | null | undefined) => goal != null && goal > 0 && current != null ? current / goal * 100 : undefined;
      const cycleValue = cycleSettingsQuery.error
        ? t('common.unavailable')
        : cyclePrediction ? t('cycle.daysUntil', { count: cyclePrediction.daysUntilNextPeriod }) : t('cycle.notSet');
      return {
        ...item,
        detail:undefined,
        progressPercent:item.id === 'steps' ? progress(summary?.steps.total, stepsGoal)
          : item.id === 'nutrition' ? progress(summary?.nutrition.calories, caloriesGoal)
            : item.id === 'water' ? progress(summary?.water.totalMl, waterGoal) : undefined,
        value:item.id === 'steps' ? summary ? ratio(summary.steps.total, stepsGoal) : '—'
          : item.id === 'water' ? summary ? ratio(summary.water.totalMl, waterGoal) : '—'
            : item.id === 'nutrition' ? summary ? ratio(summary.nutrition.calories, caloriesGoal) : '—'
              : item.id === 'sleep' ? summary?.sleep.minutes != null ? formatDuration(summary.sleep.minutes) : '—'
                : item.id === 'cycle' ? cycleValue : t('common.comingSoon'),
        unit:item.id === 'cycle' ? '' : item.unit,
      };
    });
  const weeklyStats = [
    { label:t("overview.totalSteps"),value:week.data ? formatNumber(week.data.reduce((sum,day) => sum + day.steps.total,0)) : '—',icon:'footsteps-outline' },
    { label:t("overview.caloriesEaten"),value:week.data ? formatNumber(week.data.reduce((sum,day) => sum + day.nutrition.calories,0),0)+' kcal' : '—',icon:'restaurant-outline' },
    { label:t("health.water"),value:week.data ? formatNumber((week.data.reduce((sum,day) => sum + day.water.totalMl,0)/1000),1)+' L' : '—',icon:'water-outline' },
    { label:t("overview.recordedSleep"),value:week.data ? t('units.hourValue',{value:formatNumber((week.data.reduce((sum,day) => sum + (day.sleep.minutes ?? 0),0)/60),1)}) : '—',icon:'moon-outline' },
  ];
  const recentActivity = summary ? [
    { id:'steps',title:t("overview.recordedSteps"),subtitle:summary.steps.hasRecords ? t('units.stepCount',{count:summary.steps.total,value:formatNumber(summary.steps.total)}) : t("common.noRecords"),time:t("period.today"),icon:'walk-outline',color:Colors.primary },
    { id:'water',title:t("overview.waterIntake"),subtitle:summary.water.hasRecords ? `${formatNumber(summary.water.totalMl)} ml` : t("common.noRecords"),time:t("period.today"),icon:'water-outline',color:Colors.blue },
    { id:'sleep',title:t("overview.sleepSessions"),subtitle:summary.sleep.minutes === null ? t("common.noRecords") : formatDuration(summary.sleep.minutes),time:'',icon:'moon-outline',color:Colors.purple },
  ] : [];
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Layout.tabBarHeight + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateLabel}>{formatDate(new Date())}</Text>
            <Text style={styles.greetingTitle}>{t(greetingKey,{name:greetingName})}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.notificationsButton}
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={unreadCount ? t('notifications.openWithUnread',{count:unreadCount}) : t('notifications.open')}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
              {unreadCount > 0 ? (
                <View style={styles.notificationCountBadge}>
                  <Text style={styles.notificationCountText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/profile' as any)}
              activeOpacity={0.8}
              accessibilityLabel={t("overview.viewProfile")}
            >
              {avatarQuery.data && failedAvatarUrl !== avatarQuery.data ? (
                <Image source={{ uri:avatarQuery.data }} style={{ width:44,height:44,borderRadius:22 }} onError={() => setFailedAvatarUrl(avatarQuery.data)} accessibilityLabel={t('profile.avatar')} />
              ) : <MockAvatar initials={initials(name)} size={44} />}
            </TouchableOpacity>
          </View>
        </View>

        <DataFeedback {...query} />
        {/* 2. Health Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardContent}>
            <View style={styles.ringWrapper}>
              <ProgressRing
                progress={healthScore.progress}
                size={118}
                strokeWidth={10}
                color={Colors.primary}
                trackColor="rgba(14, 165, 164, 0.16)"
              >
                <Text style={styles.scoreValue}>{healthScore.score}</Text>
                <Text style={styles.scoreInnerLabel}>{t("overview.healthScore")}</Text>
              </ProgressRing>
            </View>

            <View style={styles.scoreDetails}>
              <View style={styles.statusBadge}>
                <Ionicons name="sparkles" size={13} color={Colors.primaryDark} />
                <Text style={styles.statusBadgeText}>{healthScore.status}</Text>
              </View>
              <Text style={styles.scoreDescription}>{healthScore.description}</Text>
            </View>
          </View>
        </View>

        {/* 3. Daily Highlights (2x2 grid) */}
        <SectionHeader title={t("overview.highlights")} />
        <View style={styles.highlightsGrid}>
          {dailyHighlights.map((item) => (
            <View key={item.id} style={styles.gridCol}>
              <HealthMetricCard
                detail={item.detail}
                progressPercent={item.progressPercent}
                category={item.category}
                value={item.value}
                unit={item.unit}
                icon={item.icon}
                color={item.color}
                bgColor={item.bgColor}
                route={item.route}
              />
            </View>
          ))}
        </View>

        {/* 4. Weekly Summary Section */}
        <SectionHeader title={t("period.thisWeek")} />
        <View style={styles.weeklyGrid}>
          {weeklyStats.map((item, index) => (
            <View key={index} style={styles.gridCol}>
              <StatPill label={item.label} value={item.value} icon={item.icon} />
            </View>
          ))}
        </View>

        {/* 5. Recent Activity Section */}
        <SectionHeader title={t("overview.recordedToday")} />
        <View style={styles.activityContainer}>
          {recentActivity.map((activity, index) => (
            <View
              key={activity.id}
              style={[
                styles.activityRow,
                index < recentActivity.length - 1 && styles.activityBorderBottom,
              ]}
            >
              <View
                style={[
                  styles.activityIconCircle,
                  { backgroundColor: `${activity.color}15` },
                ]}
              >
                <Ionicons name={activity.icon as any} size={20} color={activity.color} />
              </View>

              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>

              {activity.time ? <Text style={styles.activityTime}>{activity.time}</Text> : null}
            </View>
          ))}
        </View>

        {/* 6. Health Tip Section */}
        <SectionHeader
          title={t("overview.forYou")}
          actionText={t("overview.seeAll")}
          onAction={() => router.push('/explore' as any)}
        />
        <DataFeedback {...articleQuery}/>
        {articleQuery.data.map(article=><ArticleCard key={article.id} article={article} featured/>)}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  dateLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  greetingTitle: {
    ...Typography.screenTitle,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notificationsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCountBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.background,
  },
  notificationCountText: {
    ...Typography.labelSmall,
    color: Colors.white,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  // Health Score Card
  scoreCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D4EFEB',
  },
  scoreCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  scoreValue: {
    ...Typography.statLarge,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  scoreInnerLabel: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  scoreDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14, 165, 164, 0.14)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: 5,
    marginBottom: Spacing.sm,
  },
  statusBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  scoreDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // Highlights & Weekly Grid
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  weeklyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
  },
  gridCol: {
    width: '48%',
  },
  // Recent Activity
  activityContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  activityBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  activitySubtitle: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
});

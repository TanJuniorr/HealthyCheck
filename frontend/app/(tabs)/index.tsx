import { useTranslation } from 'react-i18next';
import { formatNumber,formatDate,formatDuration } from '../../src/i18n/formatting';
import { localizeStaticData } from '../../src/i18n/localize';
import React, { useState } from 'react';
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
import { featuredArticle as rawFeaturedArticle } from '../../src/data/articles';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWeeklyOverview } from '../../src/hooks/healthHooks';
import { toLocalDateKey } from '../../src/lib/dateUtils';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { displayName, initials, profileText } from '../../src/lib/profileRepository';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { createAvatarSignedUrl } from '../../src/services/avatarService';
import { useThemedStyles } from '../../src/contexts/ThemeContext';

export default function OverviewScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const highlightDefinitions = localizeStaticData(rawHighlightDefinitions);
  const featuredArticle = localizeStaticData(rawFeaturedArticle);

  const router = useRouter();
  const { user, profile } = useAuth();
  const avatarPath = profileText(profile,'avatar_url');
  const avatarQuery = useHealthQuery(async () => {
    if (!avatarPath) return null;
    return /^https:\/\//i.test(avatarPath) ? avatarPath : createAvatarSignedUrl(avatarPath);
  },'overview-avatar:'+String(user?.id ?? 'signed-out')+':'+String(avatarPath ?? 'none'));
  const [failedAvatarUrl,setFailedAvatarUrl] = useState<string | null>(null);
  const hasName = Boolean(profile?.full_name?.trim() || (typeof user?.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()));
  const name = hasName ? displayName(user,profile) : t('profile.member');
  const insets = useSafeAreaInsets();
  const today = toLocalDateKey();
  const week = useWeeklyOverview(today); const query = week; const summary = week.data?.find(day => day.date === today) ?? null;
  const healthScore = { score:'—',maxScore:100,status:t("common.notAvailable"),description:t("overview.scoreUnavailable") };
  const dailyHighlights = highlightDefinitions.map(item => ({ ...item,detail:item.id === 'water' ? t('water.goal',{value:formatNumber(summary?.water.goalMl)}) : undefined,progressPercent:item.id === 'water' && summary?.water.goalMl && summary.water.goalMl>0 ? summary.water.totalMl/summary.water.goalMl*100 : undefined,value:item.id === 'water' ? summary ? formatNumber(summary.water.totalMl) : '—' : item.id === 'steps' ? summary ? formatNumber(summary.steps.total) : '—' : item.id === 'sleep' ? summary?.sleep.minutes != null ? formatDuration(summary.sleep.minutes) : '—' : item.id === 'nutrition' ? summary ? formatNumber(summary.nutrition.calories,0) : '—' : t("common.comingSoon"),unit:item.id === 'cycle' ? '' : item.unit }));
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
            <Text style={styles.greetingTitle}>{t('overview.greeting',{name})}</Text>
          </View>
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

        <DataFeedback {...query} />
        {/* 2. Health Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardContent}>
            <View style={styles.ringWrapper}>
              <ProgressRing
                progress={0}
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
        <ArticleCard
          id={featuredArticle.id}
          title={featuredArticle.title}
          description={featuredArticle.description}
          category={featuredArticle.category}
          readTime={featuredArticle.readTime}
          featured={true}
        />
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

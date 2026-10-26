import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
import { healthScore, dailyHighlights, weeklyStats, recentActivity } from '../../src/data/health';
import { featuredArticle } from '../../src/data/articles';
import { mockUser } from '../../src/data/user';

export default function OverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            <Text style={styles.dateLabel}>Monday, Oct 26</Text>
            <Text style={styles.greetingTitle}>Good morning, {mockUser.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.8}
            accessibilityLabel="View profile"
          >
            <MockAvatar initials={mockUser.avatarInitials} size={44} />
          </TouchableOpacity>
        </View>

        {/* 2. Health Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardContent}>
            <View style={styles.ringWrapper}>
              <ProgressRing
                progress={healthScore.score / healthScore.maxScore}
                size={118}
                strokeWidth={10}
                color={Colors.primary}
                trackColor="rgba(14, 165, 164, 0.16)"
              >
                <Text style={styles.scoreValue}>{healthScore.score}</Text>
                <Text style={styles.scoreInnerLabel}>Health Score</Text>
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
        <SectionHeader title="Daily Highlights" />
        <View style={styles.highlightsGrid}>
          {dailyHighlights.map((item) => (
            <View key={item.id} style={styles.gridCol}>
              <HealthMetricCard
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
        <SectionHeader title="This Week" />
        <View style={styles.weeklyGrid}>
          {weeklyStats.map((item, index) => (
            <View key={index} style={styles.gridCol}>
              <StatPill label={item.label} value={item.value} icon={item.icon} />
            </View>
          ))}
        </View>

        {/* 5. Recent Activity Section */}
        <SectionHeader title="Recent Activity" />
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

              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
          ))}
        </View>

        {/* 6. Health Tip Section */}
        <SectionHeader
          title="For You"
          actionText="See all"
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

const styles = StyleSheet.create({
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

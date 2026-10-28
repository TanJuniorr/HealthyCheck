import { useTranslation } from 'react-i18next';
import { formatNumber,formatDayLabel } from '../../src/i18n/formatting';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ProgressRing, ProgressBar } from '../../src/components/charts/ProgressRing';
import { WeeklyBarChart } from '../../src/components/charts/WeeklyBarChart';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

import { useNutrition, useHealthGoals } from '../../src/hooks/healthHooks';
import { getWeekRange, toLocalDateKey } from '../../src/lib/dateUtils';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { useThemedStyles } from '../../src/contexts/ThemeContext';

export default function CaloriesScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();

  const today = toLocalDateKey(); const query = useNutrition(getWeekRange(today));
  const goals = useHealthGoals(today);
  const day = query.data?.daily.find(item => item.date === today);
  const current = day?.calories ?? null;
  const goal = goals.data?.daily_calories ?? null;
  const progress = current !== null && goal && goal > 0 ? Math.min(1,current/goal) : 0;
  const weeklyCalorieData = (query.data?.daily ?? []).filter(item => item.hasRecords).map(item => ({ label:formatDayLabel(item.date),value:item.calories }));

  return (
    <View style={styles.container}>
      <AppHeader title={t("calories.eaten")} showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        <DataFeedback {...query} empty={!query.data?.hasRecords} />
        {/* Main Progress Hero Card */}
        <View style={styles.heroCard}>
          <ProgressRing
            size={180}
            strokeWidth={14}
            progress={progress}
            color={Colors.orange}
            trackColor="#FFF2E6"
          >
            <View style={styles.ringCenter}>
              <View style={styles.ringIconBg}>
                <Ionicons name="flame" size={24} color={Colors.orange} />
              </View>
              <Text style={styles.ringStat}>{(current == null ? undefined : formatNumber(current,0)) ?? '—'}</Text>
              <Text style={styles.ringUnit}>kcal</Text>
              <Text style={styles.ringLabel}>{t('calories.goal',{value:formatNumber(goal)})}</Text>
            </View>
          </ProgressRing>

          {/* Quick Stats Summary */}
          <View style={styles.quickSummaryRow}>
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>{t("nutrition.remaining")}</Text>
              <Text style={styles.quickSummaryValue}>{goal !== null && current !== null ? formatNumber(Math.max(0,goal-current),0) : '—'} <Text style={styles.quickSummaryUnit}>kcal</Text></Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>{t("calories.progress")}</Text>
              <Text style={[styles.quickSummaryValue, { color: Colors.orange }]}>
                {goal !== null && goal > 0 ? `${formatNumber(Math.round(progress*100))}%` : '—'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>{t("calories.average")}</Text>
              <Text style={styles.quickSummaryValue}>{query.data ? formatNumber((query.data.calories/query.data.daily.length),0) : '—'} <Text style={styles.quickSummaryUnit}>kcal</Text></Text>
            </View>
          </View>
        </View>

        {/* Activity Breakdown Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{t("calories.breakdown")}</Text>
          <Text style={styles.cardSubtitle}>{t("calories.expenditureUnsupported")}</Text>

          <View style={styles.barsContainer}>
            {/* Active Calories */}
            <View style={styles.barItem}>
              <ProgressBar
                progress={0}
                color={Colors.orange}
                trackColor="#F5EFEA"
                height={10}
                label={t("calories.active")}
                value={t("common.unavailable")}
              />
              <Text style={styles.barDescription}>
                {t("calories.activeHint")}</Text>
            </View>

            {/* Resting Calories */}
            <View style={styles.barItem}>
              <ProgressBar
                progress={0}
                color={Colors.blue}
                trackColor="#EEF4FF"
                height={10}
                label={t("calories.resting")}
                value={t("common.unavailable")}
              />
              <Text style={styles.barDescription}>
                {t("calories.restingHint")}</Text>
            </View>
          </View>
        </View>

        {/* Weekly Bar Chart */}
        <View style={styles.sectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.cardTitle}>{t("calories.weekly")}</Text>
              <Text style={styles.cardSubtitle}>{t("calories.intake")}</Text>
            </View>
            <View style={styles.chartLegend}>
              <View style={[styles.chartDot, { backgroundColor: '#E76F51' }]} />
              <Text style={styles.chartLegendText}>{t("period.today")}</Text>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <WeeklyBarChart
              data={weeklyCalorieData}
              maxValue={Math.max(1,...weeklyCalorieData.map(row => row.value))}
              color={Colors.orange}
              highlightColor="#E76F51"
              height={170}
              barWidth={26}
              showValues={true}
              unit=""
            />
          </View>
        </View>

        {/* Informational Disclaimer Note */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Colors.textSecondary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            {t("calories.notice")}</Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  ringStat: {
    ...Typography.statLarge,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.textPrimary,
  },
  ringUnit: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: -2,
  },
  ringLabel: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  quickSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.xxl,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickSummaryLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  quickSummaryValue: {
    ...Typography.cardTitle,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quickSummaryUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.divider,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  barsContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.lg,
  },
  barItem: {
    width: '100%',
  },
  barDescription: {
    ...Typography.supporting,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orangeLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLegendText: {
    ...Typography.labelSmall,
    color: Colors.orange,
    fontWeight: '600',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F6',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: {
    marginRight: Spacing.sm,
  },
  infoText: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});

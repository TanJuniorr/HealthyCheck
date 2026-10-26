import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ProgressRing } from '../../src/components/charts/ProgressRing';
import { WeeklyBarChart } from '../../src/components/charts/WeeklyBarChart';
import { TrendLineChart } from '../../src/components/charts/TrendLineChart';
import { stepsData, stepsWeekly, stepsHourly, stepsMonthly } from '../../src/data/steps';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

type Period = 'Today' | 'Week' | 'Month';

export default function StepsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('Today');

  // Chart data adaptations
  const todayChartData = stepsHourly.map((item) => ({
    label: item.hour,
    value: item.steps,
  }));

  const weekChartData = stepsWeekly.map((item) => ({
    label: item.day,
    value: item.steps,
    highlighted: item.day === 'Sun',
  }));

  const monthChartData = stepsMonthly.map((item) => ({
    label: item.week,
    value: item.avg,
  }));

  return (
    <View style={styles.container}>
      <AppHeader
        title="Steps"
        showBack={true}
        rightIcon="calendar-outline"
        onRightPress={() => {}}
      />
      <ScreenContainer scrollable={true} padded={true}>
        {/* Ring Hero Card */}
        <View style={styles.heroCard}>
          <ProgressRing
            size={180}
            strokeWidth={14}
            progress={stepsData.progress}
            color={Colors.primary}
            trackColor="#EAF8F7"
          >
            <View style={styles.ringCenter}>
              <View style={styles.ringIconBg}>
                <Ionicons name="walk" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.ringStat}>
                {stepsData.current.toLocaleString()}
              </Text>
              <Text style={styles.ringLabel}>
                of {stepsData.goal.toLocaleString()} steps
              </Text>
            </View>
          </ProgressRing>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Calories */}
            <View style={styles.statPill}>
              <View style={[styles.statIconCircle, { backgroundColor: Colors.orangeLight }]}>
                <Ionicons name="flame" size={16} color={Colors.orange} />
              </View>
              <Text style={styles.statPillValue}>{stepsData.calories}</Text>
              <Text style={styles.statPillUnit}>kcal</Text>
            </View>

            {/* Distance */}
            <View style={styles.statPill}>
              <View style={[styles.statIconCircle, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="navigate" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statPillValue}>{stepsData.distance}</Text>
              <Text style={styles.statPillUnit}>km</Text>
            </View>

            {/* Active Minutes */}
            <View style={styles.statPill}>
              <View style={[styles.statIconCircle, { backgroundColor: Colors.blueLight }]}>
                <Ionicons name="timer-outline" size={16} color={Colors.blue} />
              </View>
              <Text style={styles.statPillValue}>{stepsData.activeMinutes}</Text>
              <Text style={styles.statPillUnit}>min</Text>
            </View>
          </View>
        </View>

        {/* Time Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['Today', 'Week', 'Month'] as Period[]).map((period) => {
            const isSelected = selectedPeriod === period;
            return (
              <TouchableOpacity
                key={period}
                style={[styles.filterTab, isSelected && styles.filterTabActive]}
                onPress={() => setSelectedPeriod(period)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isSelected && styles.filterTabTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Chart Section */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {selectedPeriod === 'Today' && 'Hourly Activity'}
              {selectedPeriod === 'Week' && 'Weekly Breakdown'}
              {selectedPeriod === 'Month' && '4-Week Average'}
            </Text>
            <Text style={styles.chartSubtitle}>
              {selectedPeriod === 'Today' && 'Steps per hour today'}
              {selectedPeriod === 'Week' && 'Daily progress towards 15k goal'}
              {selectedPeriod === 'Month' && 'Weekly average step count'}
            </Text>
          </View>

          <View style={styles.chartContent}>
            {selectedPeriod === 'Today' && (
              <TrendLineChart
                data={todayChartData}
                color={Colors.primary}
                height={170}
                showDots={true}
                showGrid={true}
              />
            )}
            {selectedPeriod === 'Week' && (
              <WeeklyBarChart
                data={weekChartData}
                maxValue={16000}
                color={Colors.primary}
                highlightColor={Colors.primaryDark}
                height={170}
                barWidth={26}
                showValues={true}
              />
            )}
            {selectedPeriod === 'Month' && (
              <TrendLineChart
                data={monthChartData}
                color={Colors.primary}
                height={170}
                showDots={true}
                showGrid={true}
              />
            )}
          </View>
        </View>

        {/* Motivational Card */}
        <View style={styles.motivationCard}>
          <View style={styles.motivationIconBg}>
            <Ionicons name="sparkles" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.motivationText}>
            You're 79% of the way to your daily goal. Keep it up!
          </Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ringStat: {
    ...Typography.statLarge,
    fontSize: 26,
    lineHeight: 32,
    color: Colors.textPrimary,
  },
  ringLabel: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statPillValue: {
    ...Typography.cardTitle,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statPillUnit: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDF1F3',
    borderRadius: Radius.full,
    padding: 4,
    marginVertical: Spacing.lg,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    minHeight: 44,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  filterTabText: {
    ...Typography.buttonSmall,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  filterTabTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  chartHeader: {
    marginBottom: Spacing.md,
  },
  chartTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  chartSubtitle: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chartContent: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  motivationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  motivationIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  motivationText: {
    ...Typography.bodySmall,
    color: Colors.primaryDark,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
});

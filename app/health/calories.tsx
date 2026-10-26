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

const weeklyCalorieData = [
  { label: 'Mon', value: 520 },
  { label: 'Tue', value: 430 },
  { label: 'Wed', value: 580 },
  { label: 'Thu', value: 490 },
  { label: 'Fri', value: 510 },
  { label: 'Sat', value: 620 },
  { label: 'Sun', value: 487, highlighted: true },
];

export default function CaloriesScreen() {
  const current = 487;
  const goal = 600;
  const progress = 487 / 600; // ~0.81

  return (
    <View style={styles.container}>
      <AppHeader title="Calories Burned" showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
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
              <Text style={styles.ringStat}>{current}</Text>
              <Text style={styles.ringUnit}>kcal</Text>
              <Text style={styles.ringLabel}>of {goal} kcal goal</Text>
            </View>
          </ProgressRing>

          {/* Quick Stats Summary */}
          <View style={styles.quickSummaryRow}>
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>Remaining</Text>
              <Text style={styles.quickSummaryValue}>{goal - current} <Text style={styles.quickSummaryUnit}>kcal</Text></Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>Progress</Text>
              <Text style={[styles.quickSummaryValue, { color: Colors.orange }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.quickSummaryItem}>
              <Text style={styles.quickSummaryLabel}>Daily Avg</Text>
              <Text style={styles.quickSummaryValue}>520 <Text style={styles.quickSummaryUnit}>kcal</Text></Text>
            </View>
          </View>
        </View>

        {/* Activity Breakdown Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Activity Breakdown</Text>
          <Text style={styles.cardSubtitle}>Total energy expenditure distribution</Text>

          <View style={styles.barsContainer}>
            {/* Active Calories */}
            <View style={styles.barItem}>
              <ProgressBar
                progress={340 / goal}
                color={Colors.orange}
                trackColor="#F5EFEA"
                height={10}
                label="Active Calories"
                value="340 kcal"
              />
              <Text style={styles.barDescription}>
                Energy burned through intentional movements, steps, and exercise
              </Text>
            </View>

            {/* Resting Calories */}
            <View style={styles.barItem}>
              <ProgressBar
                progress={147 / goal}
                color={Colors.blue}
                trackColor="#EEF4FF"
                height={10}
                label="Resting Calories"
                value="147 kcal"
              />
              <Text style={styles.barDescription}>
                Energy expended by your body at rest to maintain essential vitals
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly Bar Chart */}
        <View style={styles.sectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.cardTitle}>Weekly Calories Burned</Text>
              <Text style={styles.cardSubtitle}>Daily active output vs target</Text>
            </View>
            <View style={styles.chartLegend}>
              <View style={[styles.chartDot, { backgroundColor: '#E76F51' }]} />
              <Text style={styles.chartLegendText}>Today</Text>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <WeeklyBarChart
              data={weeklyCalorieData}
              maxValue={700}
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
            Calorie estimates are approximate and for tracking purposes only.
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

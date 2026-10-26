import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ProgressRing } from '../../src/components/charts/ProgressRing';
import { TrendLineChart } from '../../src/components/charts/TrendLineChart';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

const weeklyHeartData = [
  { label: 'Mon', value: 68 },
  { label: 'Tue', value: 72 },
  { label: 'Wed', value: 70 },
  { label: 'Thu', value: 75 },
  { label: 'Fri', value: 69 },
  { label: 'Sat', value: 82 },
  { label: 'Sun', value: 72 },
];

export default function HeartRateScreen() {
  return (
    <View style={styles.container}>
      <AppHeader title="Heart Rate" showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        {/* Main Display Card */}
        <View style={styles.heroCard}>
          <ProgressRing
            size={180}
            strokeWidth={14}
            progress={0.45}
            color={Colors.coral}
            trackColor="#FFF0F0"
          >
            <View style={styles.ringCenter}>
              <View style={styles.ringIconBg}>
                <Ionicons name="heart" size={24} color={Colors.coral} />
              </View>
              <View style={styles.bpmRow}>
                <Text style={styles.bpmValue}>72</Text>
                <Text style={styles.bpmUnit}>bpm</Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.statusText}>Normal</Text>
              </View>
            </View>
          </ProgressRing>

          {/* Range Info (3 items in a row) */}
          <View style={styles.rangeRow}>
            {/* Resting */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Resting</Text>
              <Text style={styles.rangeValue}>62 <Text style={styles.rangeUnit}>bpm</Text></Text>
            </View>

            <View style={styles.rangeDivider} />

            {/* Average */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Average</Text>
              <Text style={styles.rangeValue}>72 <Text style={styles.rangeUnit}>bpm</Text></Text>
            </View>

            <View style={styles.rangeDivider} />

            {/* Peak */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Peak</Text>
              <Text style={[styles.rangeValue, { color: Colors.coral }]}>
                145 <Text style={styles.rangeUnit}>bpm</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly Trend Chart */}
        <View style={styles.sectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.cardTitle}>7-Day Heart Rate Trend</Text>
              <Text style={styles.cardSubtitle}>Resting & daily average values</Text>
            </View>
            <View style={styles.trendBadge}>
              <Ionicons name="pulse" size={14} color={Colors.coral} />
              <Text style={styles.trendBadgeText}>Avg 72</Text>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <TrendLineChart
              data={weeklyHeartData}
              color={Colors.coral}
              height={170}
              showDots={true}
              showGrid={true}
              yAxisSuffix=""
            />
          </View>
        </View>

        {/* Heart Rate Zones Reference */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Heart Rate Zones</Text>
          <Text style={styles.cardSubtitle}>Based on age and resting heart rate</Text>

          <View style={styles.zonesList}>
            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.success }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>Resting Zone</Text>
                <Text style={styles.zoneDesc}>Normal rhythm while at rest</Text>
              </View>
              <Text style={styles.zoneRange}>60 - 75 bpm</Text>
            </View>

            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.blue }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>Moderate / Fat Burn</Text>
                <Text style={styles.zoneDesc}>Brisk walking & light aerobic</Text>
              </View>
              <Text style={styles.zoneRange}>95 - 125 bpm</Text>
            </View>

            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.coral }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>Cardio / Peak</Text>
                <Text style={styles.zoneDesc}>Running & high-intensity exercise</Text>
              </View>
              <Text style={styles.zoneRange}>126 - 165 bpm</Text>
            </View>
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Colors.textSecondary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            Heart rate data shown is for demonstration purposes only.
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
    backgroundColor: Colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bpmValue: {
    ...Typography.statLarge,
    color: Colors.textPrimary,
    fontSize: 32,
    lineHeight: 38,
  },
  bpmUnit: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  statusText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: '600',
  },
  rangeRow: {
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
  rangeItem: {
    flex: 1,
    alignItems: 'center',
  },
  rangeLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  rangeValue: {
    ...Typography.cardTitle,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rangeUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  rangeDivider: {
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.coralLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  trendBadgeText: {
    ...Typography.labelSmall,
    color: Colors.coral,
    fontWeight: '600',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zonesList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  zoneIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  zoneDesc: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 1,
  },
  zoneRange: {
    ...Typography.labelSmall,
    fontWeight: '600',
    color: Colors.textSecondary,
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

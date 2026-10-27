import { useTranslation } from 'react-i18next';
import { formatNumber,formatDayLabel } from '../../src/i18n/formatting';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { TrendLineChart } from '../../src/components/charts/TrendLineChart';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { getMyProfile } from '../../src/services/profileService';
import { getLatestWeight, getWeightTrend, calculateBMI } from '../../src/services/weightService';
import { getMonthRange, toLocalDateKey } from '../../src/lib/dateUtils';
import { DataFeedback } from '../../src/components/common/DataFeedback';

export default function BmiScreen() {
  const { t } = useTranslation();

  const today = toLocalDateKey(); const range = getMonthRange(today);
  const query = useHealthQuery(async () => { const [profile,weight,trend] = await Promise.all([getMyProfile(),getLatestWeight(),getWeightTrend(range.start,today)]); return { profile,weight,trend,bmi:calculateBMI(weight?.weight_kg,profile?.height_cm) }; },'body-metrics:'+today);
  const currentBmi = query.data?.bmi ?? null;
  const bmiHistory = (query.data?.trend.points ?? []).flatMap(point => { const bmi = calculateBMI(point.weightKg,query.data?.profile?.height_cm); return bmi === null ? [] : [{ label:formatDayLabel(point.date),value:bmi }]; });
  const birth = query.data?.profile?.date_of_birth;
  const now = new Date(); const age = birth ? now.getFullYear() - Number(birth.substring(0,4)) - (today.substring(5) < birth.substring(5) ? 1 : 0) : null;
  // Calculate marker offset across scale (range 15 to 35)
  const minScale = 15;
  const maxScale = 35;
  const pointerPercentage = Math.min(
    Math.max((((currentBmi ?? minScale) - minScale) / (maxScale - minScale)) * 100, 5),
    95
  );

  return (
    <View style={styles.container}>
      <AppHeader title={t("health.bodyMetrics")} showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        <DataFeedback {...query} empty={currentBmi === null} />
        {/* Main BMI Display Card */}
        <View style={styles.heroCard}>
          <View style={styles.categoryBadge}>
            <Ionicons name="body" size={16} color={Colors.purple} style={styles.badgeIcon} />
            <Text style={styles.badgeText}>{t("health.bmi")}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLarge}>{(currentBmi == null ? undefined : formatNumber(currentBmi,1)) ?? '—'}</Text>
            <Text style={styles.statUnit}>kg/m²</Text>
          </View>

          <View style={styles.statusLabelContainer}>
            <View style={styles.statusGreenDot} />
            <Text style={styles.statusLabelText}>{t("bmi.general")}</Text>
          </View>

          {/* BMI Scale Visualization */}
          <View style={styles.scaleContainer}>
            {/* Indicator pointer */}
            <View style={styles.indicatorTrack}>
              <View
                style={[
                  styles.indicatorWrapper,
                  { left: `${pointerPercentage}%`,opacity:currentBmi === null ? 0 : 1 },
                ]}
              >
                <View style={styles.indicatorPill}>
                  <Text style={styles.indicatorPillText}>{(currentBmi == null ? undefined : formatNumber(currentBmi,1)) ?? '—'}</Text>
                </View>
                <View style={styles.indicatorArrow} />
              </View>
            </View>

            {/* Horizontal Color Bar */}
            <View style={styles.scaleBar}>
              <View style={[styles.scaleSegment, { flex: 1.8, backgroundColor: '#5B8DEF' }]} />
              <View style={[styles.scaleSegment, { flex: 3.2, backgroundColor: '#39A983' }]} />
              <View style={[styles.scaleSegment, { flex: 2.5, backgroundColor: '#F4A261' }]} />
              <View style={[styles.scaleSegment, { flex: 2.5, backgroundColor: '#EA777A' }]} />
            </View>

            {/* Scale Range Labels */}
            <View style={styles.scaleLabelsRow}>
              <Text style={styles.scaleLabelText}>{t("bmi.underweight")}</Text>
              <Text style={styles.scaleLabelText}>{t("bmi.normal")}</Text>
              <Text style={styles.scaleLabelText}>{t("bmi.overweight")}</Text>
              <Text style={styles.scaleLabelText}>{t("bmi.obese")}</Text>
            </View>

            <View style={styles.scaleThresholdsRow}>
              <Text style={styles.thresholdText}>{formatNumber(18.5,1)}</Text>
              <Text style={styles.thresholdText}>{formatNumber(25,1)}</Text>
              <Text style={styles.thresholdText}>{formatNumber(30,1)}</Text>
            </View>
          </View>
        </View>

        {/* Body Measurements (3 cards in a row) */}
        <View style={styles.measurementsRow}>
          {/* Height */}
          <View style={styles.measurementCard}>
            <View style={[styles.measurementIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="resize-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.measurementLabel}>{t("health.height")}</Text>
            <Text style={styles.measurementValue}>{formatNumber(query.data?.profile?.height_cm)} <Text style={styles.measurementUnit}>cm</Text></Text>
          </View>

          {/* Weight */}
          <View style={styles.measurementCard}>
            <View style={[styles.measurementIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="scale-outline" size={18} color={Colors.purple} />
            </View>
            <Text style={styles.measurementLabel}>{t("health.weight")}</Text>
            <Text style={styles.measurementValue}>{formatNumber(query.data?.weight?.weight_kg)} <Text style={styles.measurementUnit}>kg</Text></Text>
          </View>

          {/* Age */}
          <View style={styles.measurementCard}>
            <View style={[styles.measurementIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.blue} />
            </View>
            <Text style={styles.measurementLabel}>{t("health.age")}</Text>
            <Text style={styles.measurementValue}>{formatNumber(age)} <Text style={styles.measurementUnit}>{t("units.years")}</Text></Text>
          </View>
        </View>

        {/* BMI History Trend */}
        <View style={styles.sectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.cardTitle}>{t("bmi.history")}</Text>
              <Text style={styles.cardSubtitle}>{t("bmi.historyHint")}</Text>
            </View>
            <View style={styles.steadyBadge}>
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.purple} />
              <Text style={styles.steadyText}>{t("common.recorded")}</Text>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <TrendLineChart
              data={bmiHistory}
              color={Colors.purple}
              height={170}
              showDots={true}
              showGrid={true}
            />
          </View>
        </View>

        {/* Health Advisory Note */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Colors.textSecondary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            {t("bmi.notice")}</Text>
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
    padding: Spacing.xl,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purpleLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  badgeIcon: {
    marginRight: 6,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.purple,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statLarge: {
    ...Typography.statLarge,
    fontSize: 42,
    lineHeight: 48,
    color: Colors.textPrimary,
  },
  statUnit: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontSize: 16,
    marginLeft: 6,
    fontWeight: '500',
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  statusGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  statusLabelText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: '700',
  },
  scaleContainer: {
    width: '100%',
    paddingTop: Spacing.md,
  },
  indicatorTrack: {
    height: 28,
    width: '100%',
    position: 'relative',
    marginBottom: 4,
  },
  indicatorWrapper: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -16,
  },
  indicatorPill: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  indicatorPillText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  indicatorArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.textPrimary,
  },
  scaleBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%',
  },
  scaleSegment: {
    height: '100%',
  },
  scaleLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  scaleLabelText: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textMuted,
  },
  scaleThresholdsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  thresholdText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Typography.labelSmall.fontFamily,
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  measurementCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  measurementIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  measurementLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  measurementValue: {
    ...Typography.cardTitle,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  measurementUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
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
  steadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.purpleLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  steadyText: {
    ...Typography.labelSmall,
    color: Colors.purple,
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

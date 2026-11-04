import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../../src/i18n/localize';
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
import { useThemedStyles } from '../../src/contexts/ThemeContext';

const rawWeeklyHeartData = [
  { label: "weekday.mon", value: 68 },
  { label: "weekday.tue", value: 72 },
  { label: "weekday.wed", value: 70 },
  { label: "weekday.thu", value: 75 },
  { label: "weekday.fri", value: 69 },
  { label: "weekday.sat", value: 82 },
  { label: "weekday.sun", value: 72 },
];

export default function HeartRateScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const weeklyHeartData = localizeStaticData(rawWeeklyHeartData);

  return (
    <View style={styles.container}>
      <AppHeader title={t("health.heart")} showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        <Text style={{ color:Colors.textSecondary,paddingVertical:Spacing.md }}>{t("health.demoNotice")}</Text>
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
                <Text style={styles.statusText}>{t("bmi.normal")}</Text>
              </View>
            </View>
          </ProgressRing>

          {/* Range Info (3 items in a row) */}
          <View style={styles.rangeRow}>
            {/* Resting */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>{t("heart.resting")}</Text>
              <Text style={styles.rangeValue}>62 <Text style={styles.rangeUnit}>bpm</Text></Text>
            </View>

            <View style={styles.rangeDivider} />

            {/* Average */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>{t("heart.average")}</Text>
              <Text style={styles.rangeValue}>72 <Text style={styles.rangeUnit}>bpm</Text></Text>
            </View>

            <View style={styles.rangeDivider} />

            {/* Peak */}
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>{t("heart.peak")}</Text>
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
              <Text style={styles.cardTitle}>{t("heart.trend")}</Text>
              <Text style={styles.cardSubtitle}>{t("heart.trendHint")}</Text>
            </View>
            <View style={styles.trendBadge}>
              <Ionicons name="pulse" size={14} color={Colors.coral} />
              <Text style={styles.trendBadgeText}>{t("heart.averageDemo")}</Text>
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
          <Text style={styles.cardTitle}>{t("heart.zones")}</Text>
          <Text style={styles.cardSubtitle}>{t("heart.zonesHint")}</Text>

          <View style={styles.zonesList}>
            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.success }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{t("heart.restingZone")}</Text>
                <Text style={styles.zoneDesc}>{t("heart.restingDescription")}</Text>
              </View>
              <Text style={styles.zoneRange}>60 - 75 bpm</Text>
            </View>

            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.blue }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{t("heart.moderate")}</Text>
                <Text style={styles.zoneDesc}>{t("heart.moderateDescription")}</Text>
              </View>
              <Text style={styles.zoneRange}>95 - 125 bpm</Text>
            </View>

            <View style={styles.zoneRow}>
              <View style={[styles.zoneIndicator, { backgroundColor: Colors.coral }]} />
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{t("heart.cardio")}</Text>
                <Text style={styles.zoneDesc}>{t("heart.cardioDescription")}</Text>
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
            {t("heart.demo")}</Text>
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

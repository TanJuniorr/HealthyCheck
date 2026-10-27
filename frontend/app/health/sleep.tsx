import { useTranslation } from 'react-i18next';
import { formatNumber,formatTime,formatDuration,formatDayLabel } from '../../src/i18n/formatting';
import { localizeStaticData } from '../../src/i18n/localize';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { WeeklyBarChart } from '../../src/components/charts/WeeklyBarChart';
import { sleepTips as rawSleepTips } from '../../src/data/sleep';
import { useSleep } from '../../src/hooks/healthHooks';
import { getWeekRange } from '../../src/lib/dateUtils';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

export default function SleepScreen() {
  const { t } = useTranslation();
  const sleepTips = localizeStaticData(rawSleepTips);

  const router = useRouter();

  const query = useSleep(getWeekRange());
  const formatMinutes = (minutes: number | null | undefined) => formatDuration(minutes);
  const latest = query.data?.latestSession;
  const sleepData = { average:formatMinutes(query.data?.averageDailyMinutes),quality:(query.data?.averageQualityRating == null ? undefined : formatNumber(query.data?.averageQualityRating,1)) ?? '—',deepSleep:'—',awake:'—',bedtime:latest ? formatTime(new Date(latest.sleep_start),{ hour:'2-digit',minute:'2-digit' }) : '—',wakeUp:latest ? formatTime(new Date(latest.sleep_end),{ hour:'2-digit',minute:'2-digit' }) : '—' };
  const weeklyChartData = (query.data?.daily ?? []).filter(day => day.minutes !== null).map(day => ({ label:formatDayLabel(day.date),value:(day.minutes ?? 0)/60 }));

  return (
    <View style={styles.container}>
      <AppHeader title={t("health.sleep")} showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        <DataFeedback {...query} empty={!query.data?.latestSession} />
        {/* Main Summary Card (Blue-tinted) */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="moon" size={20} color={Colors.blue} />
            </View>
            <Text style={styles.summaryBadge}>{t("overview.recordedSleep")}</Text>
          </View>

          <Text style={styles.summaryLabel}>{t("sleep.average")}</Text>
          <Text style={styles.summaryValue}>{sleepData.average}</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>{t("sleep.quality")}</Text>
              <View style={styles.summaryColValueRow}>
                <Ionicons name="star" size={14} color="#F4A261" style={styles.starIcon} />
                <Text style={styles.summaryColValue}>{sleepData.quality}/5</Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>{t("sleep.deep")}</Text>
              <Text style={styles.summaryColValue}>{sleepData.deepSleep}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryColLabel}>{t("sleep.awake")}</Text>
              <Text style={styles.summaryColValue}>{sleepData.awake}</Text>
            </View>
          </View>
        </View>

        {/* Sleep Phases Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{t("sleep.phases")}</Text>
          <Text style={styles.cardSubtitle}>{t('sleep.weekTotal',{duration:formatMinutes(query.data?.totalMinutes)})}</Text>

          <View style={styles.phasesList}>
            <Text style={styles.cardSubtitle}>{t("sleep.phasesUnavailable")}</Text>
          </View>
        </View>

        {/* Weekly Bar Chart */}
        <View style={styles.sectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.cardTitle}>{t("sleep.weekly")}</Text>
              <Text style={styles.cardSubtitle}>{t("sleep.grouping")}</Text>
            </View>
            <View style={styles.legendBadge}>
              <View style={[styles.legendDot, { backgroundColor: '#3A5BC7' }]} />
              <Text style={styles.legendText}>{t("sleep.recordedNights")}</Text>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <WeeklyBarChart
              data={weeklyChartData}
              maxValue={10}
              color={Colors.blue}
              highlightColor="#3A5BC7"
              height={170}
              barWidth={26}
              showValues={true}
              unit={t("units.hourShort")}
            />
          </View>
        </View>

        {/* Sleep Schedule Section */}
        <View style={styles.sectionCard}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.cardTitle}>{t("sleep.latest")}</Text>
            <TouchableOpacity
              onPress={() => router.push('/sleep-schedule')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.editButton}
            >
              <Text style={styles.editText}>{t("common.edit")}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleRow}>
            {/* Bedtime */}
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIconBg, { backgroundColor: '#EDF3FF' }]}>
                <Ionicons name="moon" size={20} color={Colors.blue} />
              </View>
              <View>
                <Text style={styles.scheduleLabel}>{t("sleep.bedtime")}</Text>
                <Text style={styles.scheduleTime}>{sleepData.bedtime}</Text>
              </View>
            </View>

            <View style={styles.scheduleArrow}>
              <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            </View>

            {/* Wake up */}
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIconBg, { backgroundColor: '#FFF2E6' }]}>
                <Ionicons name="sunny" size={20} color={Colors.orange} />
              </View>
              <View>
                <Text style={styles.scheduleLabel}>{t("sleep.wakeUp")}</Text>
                <Text style={styles.scheduleTime}>{sleepData.wakeUp}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sleep Tip Card */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconBg}>
            <Ionicons name="bulb-outline" size={20} color={Colors.blue} />
          </View>
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipHeading}>{t("sleep.insight")}</Text>
            <Text style={styles.tipText}>{sleepTips[0]}</Text>
          </View>
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
  summaryCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#D4E3FB',
    ...Shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  summaryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadge: {
    ...Typography.labelSmall,
    color: Colors.blue,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    fontWeight: '600',
  },
  summaryLabel: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    ...Typography.statLarge,
    color: '#1C355E',
    marginBottom: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryColLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  summaryColValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginRight: 3,
  },
  summaryColValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  phasesList: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  phaseItem: {
    width: '100%',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  legendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  editText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scheduleIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  scheduleTime: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  scheduleArrow: {
    paddingHorizontal: Spacing.xs,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF3FF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#DCE7FD',
  },
  tipIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipHeading: {
    ...Typography.label,
    color: Colors.blue,
    fontWeight: '700',
    marginBottom: 2,
  },
  tipText: {
    ...Typography.bodySmall,
    color: '#3A5272',
    lineHeight: 19,
  },
});

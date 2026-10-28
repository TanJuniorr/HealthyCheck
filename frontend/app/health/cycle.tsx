import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../../src/i18n/localize';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { AppHeader, SectionHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import {
  cycleData as rawCycleData,
  cycleWeekDates as rawCycleWeekDates,
  symptoms as rawInitialSymptoms,
  feelings as rawFeelings,
  cycleInsights as rawCycleInsights,
} from '../../src/data/cycle';
import { useThemedStyles } from '../../src/contexts/ThemeContext';

export default function CycleTrackingScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const cycleData = localizeStaticData(rawCycleData);
  const cycleWeekDates = localizeStaticData(rawCycleWeekDates);
  const initialSymptoms = localizeStaticData(rawInitialSymptoms);
  const feelings = localizeStaticData(rawFeelings);
  const cycleInsights = localizeStaticData(rawCycleInsights);

  const [selectedDate, setSelectedDate] = useState<number>(26);
  const [selectedFeelingId, setSelectedFeelingId] = useState<string>('2');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    initialSymptoms.forEach((s) => {
      map[s.id] = s.selected;
    });
    return map;
  });

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const cycleProgress = cycleData.cycleDay / cycleData.cycleLength;

  return (
    <View style={styles.container}>
      <AppHeader title={t("health.cycleTracking")} showBack />

      <ScreenContainer>
        <Text style={{ color:Colors.textSecondary,paddingVertical:Spacing.md }}>{t("health.demoNotice")}</Text>
        {/* Calendar Week Strip */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>{t("cycle.month")}</Text>
            <View style={styles.calendarBadge}>
              <Text style={styles.calendarBadgeText}>{t("cycle.week")}</Text>
            </View>
          </View>

          <View style={styles.weekStripRow}>
            {cycleWeekDates.map((item) => {
              const isSelected = selectedDate === item.date;
              return (
                <TouchableOpacity
                  key={item.date}
                  style={styles.dayColumn}
                  onPress={() => setSelectedDate(item.date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, item.isToday && styles.todayLabel]}>
                    {item.day}
                  </Text>
                  <View
                    style={[
                      styles.dateCircle,
                      item.isToday && styles.todayCircle,
                      isSelected && !item.isToday && styles.selectedCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateNumber,
                        item.isToday && styles.todayNumber,
                        isSelected && !item.isToday && styles.selectedNumber,
                      ]}
                    >
                      {item.date}
                    </Text>
                  </View>
                  {item.isPeriod && <View style={styles.periodDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusTopRow}>
            <View style={styles.phaseBadge}>
              <Ionicons name="flower-outline" size={14} color={Colors.coral} />
              <Text style={styles.phaseBadgeText}>{t('cycle.phaseValue',{phase:cycleData.phase.toUpperCase()})}</Text>
            </View>
            <Text style={styles.nextPeriodText}>{t('cycle.daysUntil',{count:cycleData.nextPeriodIn})}</Text>
          </View>

          <Text style={styles.statusMainText}>
            {t('cycle.dayOf',{day:cycleData.cycleDay,total:cycleData.cycleLength})}
          </Text>
          <Text style={styles.statusSubText}>{t("cycle.expected")}</Text>

          {/* Cycle Progress Track */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, cycleProgress * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.progressLabelsRow}>
              <Text style={styles.progressLabel}>{t("cycle.periodDay")}</Text>
              <Text style={styles.progressLabel}>{t("cycle.ovulationDay")}</Text>
              <Text style={styles.progressLabel}>{t("cycle.lastDay")}</Text>
            </View>
          </View>
        </View>

        {/* How are you feeling today? Section */}
        <SectionHeader title={t("cycle.feeling")} />
        <View style={styles.feelingsCard}>
          <View style={styles.feelingsRow}>
            {feelings.map((item) => {
              const isSelected = selectedFeelingId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.feelingButton, isSelected && styles.feelingButtonSelected]}
                  onPress={() => setSelectedFeelingId(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.feelingEmojiCircle,
                      isSelected && styles.feelingEmojiCircleSelected,
                    ]}
                  >
                    <Text style={styles.feelingEmoji}>{item.emoji}</Text>
                  </View>
                  <Text
                    style={[styles.feelingLabel, isSelected && styles.feelingLabelSelected]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Symptoms Section */}
        <SectionHeader title={t("cycle.symptoms")} />
        <View style={styles.symptomsGrid}>
          {initialSymptoms.map((symptom) => {
            const isSelected = !!selectedSymptoms[symptom.id];
            return (
              <TouchableOpacity
                key={symptom.id}
                style={[styles.symptomChip, isSelected && styles.symptomChipSelected]}
                onPress={() => toggleSymptom(symptom.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.symptomIconWrapper,
                    isSelected && styles.symptomIconWrapperSelected,
                  ]}
                >
                  <Ionicons
                    name={symptom.icon as any}
                    size={18}
                    color={isSelected ? Colors.white : Colors.coral}
                  />
                </View>
                <Text
                  style={[styles.symptomName, isSelected && styles.symptomNameSelected]}
                >
                  {symptom.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Insights Section */}
        <SectionHeader title={t("cycle.insights")} />
        <View style={styles.insightsContainer}>
          {cycleInsights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightIconWrapper}>
                <Ionicons
                  name={index === 0 ? 'sparkles-outline' : 'fitness-outline'}
                  size={20}
                  color={Colors.coral}
                />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Disclaimer Note */}
        <View style={styles.disclaimerContainer}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            {t("cycle.notice")}</Text>
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
  calendarCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calendarMonth: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  calendarBadge: {
    backgroundColor: Colors.coralLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  calendarBadgeText: {
    ...Typography.labelSmall,
    color: Colors.coral,
    fontWeight: '600',
  },
  weekStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
  },
  dayLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  todayLabel: {
    color: Colors.coral,
    fontWeight: '700',
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: Colors.coral,
    ...Shadows.sm,
  },
  selectedCircle: {
    borderWidth: 1.5,
    borderColor: Colors.coral,
    backgroundColor: Colors.coralLight,
  },
  dateNumber: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  todayNumber: {
    color: Colors.white,
    fontWeight: '700',
  },
  selectedNumber: {
    color: Colors.coral,
    fontWeight: '700',
  },
  periodDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.coral,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: Colors.coralLight,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FCDDDD',
    ...Shadows.sm,
  },
  statusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  phaseBadgeText: {
    ...Typography.labelSmall,
    color: Colors.coral,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextPeriodText: {
    ...Typography.label,
    color: Colors.coral,
    fontWeight: '600',
  },
  statusMainText: {
    ...Typography.largeTitle,
    fontSize: 26,
    lineHeight: 32,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statusSubText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    marginTop: Spacing.xs,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(234, 119, 122, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.coral,
    borderRadius: 4,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textMuted,
  },
  feelingsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feelingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feelingButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  feelingButtonSelected: {
    backgroundColor: Colors.coralLight,
  },
  feelingEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    marginBottom: 6,
  },
  feelingEmojiCircleSelected: {
    backgroundColor: '#FFE6E6',
    borderWidth: 1.5,
    borderColor: Colors.coral,
  },
  feelingEmoji: {
    fontSize: 22,
  },
  feelingLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  feelingLabelSelected: {
    color: Colors.coral,
    fontWeight: '700',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  symptomChip: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 52,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  symptomChipSelected: {
    backgroundColor: Colors.coral,
    borderColor: Colors.coral,
  },
  symptomIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomIconWrapperSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  symptomName: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  symptomNameSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  insightsContainer: {
    gap: Spacing.md,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  insightIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  insightDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disclaimerText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});

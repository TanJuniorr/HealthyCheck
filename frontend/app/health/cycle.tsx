import { useTranslation } from 'react-i18next';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Switch, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Radius, Shadows, Spacing } from '../../src/constants/spacing';
import { AppHeader, SectionHeader } from '../../src/components/common/AppHeader';
import { PrimaryButton } from '../../src/components/common/Buttons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { CalendarDatePicker } from '../../src/components/common/CalendarDatePicker';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useNotificationInbox } from '../../src/contexts/NotificationInboxContext';
import { getDaysInRange, getWeekRange, parseLocalDate, shiftDay, toLocalDateKey } from '../../src/lib/dateUtils';
import { appLocale, formatDate } from '../../src/i18n/formatting';
import { localizeMessage } from '../../src/i18n/localize';
import { getCyclePrediction } from '../../src/lib/menstrualCycleCalculations';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { getMyMenstrualCycleLog, getMyMenstrualCycleSettings, saveMyMenstrualCycleLog, saveMyMenstrualCycleSettings } from '../../src/services/menstrualCycleService';
import { reconcileMenstrualCycleReminder, type CycleReminderStatus } from '../../src/services/menstrualCycleNotifications';
import { symptoms as rawSymptoms, feelings as rawFeelings, cycleInsights as rawCycleInsights } from '../../src/data/cycle';
import type { CycleFlowStatus, CycleMood, MenstrualCycleSettingsRow } from '../../src/types/database';

export default function CycleTrackingScreen() {
  const { profile, profileChecked, profileError } = useAuth();
  const styles = useThemedStyles(baseStyles);

  if (!profileChecked) {
    return (
      <View style={styles.loadingScreen}>
        {profileError ? <Text style={styles.errorText}>{profileError}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }
  if (profile?.gender !== 'female') return <Redirect href="/health" />;
  return <CycleTrackingContent />;
}

type PickerPurpose = 'week' | 'periodStart';
type SettingsDraft = Pick<MenstrualCycleSettingsRow, 'last_period_start' | 'cycle_length' | 'period_length' | 'reminder_enabled' | 'reminder_days_before'>;
const defaultSettings: SettingsDraft = { last_period_start: null, cycle_length: 28, period_length: 5, reminder_enabled: true, reminder_days_before: 2 };
const flowStatuses: CycleFlowStatus[] = ['none', 'spotting', 'light', 'medium', 'heavy'];
const errorText = (error: unknown) => localizeMessage(error instanceof Error ? error.message : typeof error === 'string' ? error : '');

function settingsDraftFromRow(row: MenstrualCycleSettingsRow): SettingsDraft {
  return {
    last_period_start: row.last_period_start,
    cycle_length: row.cycle_length,
    period_length: row.period_length,
    reminder_enabled: row.reminder_enabled,
    reminder_days_before: row.reminder_days_before,
  };
}

function getWeekOfMonth(value: string) {
  const date = parseLocalDate(value);
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekOffset = (firstOfMonth.getDay() + 6) % 7;
  return Math.ceil((date.getDate() + firstWeekOffset) / 7);
}

function CycleTrackingContent() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notificationsEnabled } = useNotificationInbox();
  const today = toLocalDateKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [pickerPurpose, setPickerPurpose] = useState<PickerPurpose>('week');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [settingsDraftState, setSettingsDraftState] = useState<{ ownerId: string | null; value: SettingsDraft | null }>({ ownerId: null, value: null });
  const [settingsSaveError, setSettingsSaveError] = useState('');
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');
  const [logSaveError, setLogSaveError] = useState('');
  const [logSaveMessage, setLogSaveMessage] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [reminderStatus, setReminderStatus] = useState<CycleReminderStatus | null>(null);
  const settingsLock = useRef(false);
  const logLock = useRef(false);
  const settingsQuery = useHealthQuery(getMyMenstrualCycleSettings, 'menstrual-cycle-settings');
  const logQuery = useHealthQuery(() => getMyMenstrualCycleLog(selectedDate), `menstrual-cycle-log:${selectedDate}`);

  const settings = settingsQuery.data;
  const ownerId = user?.id ?? null;
  const cycleSettings = settingsDraftState.ownerId === ownerId && settingsDraftState.value
    ? settingsDraftState.value
    : settings ? settingsDraftFromRow(settings) : defaultSettings;
  const week = getWeekRange(selectedDate);
  const weekDates = getDaysInRange(week.start, week.end);
  const weekNumber = getWeekOfMonth(selectedDate);
  const prediction = getCyclePrediction(selectedDate, settings);
  const feelings = useMemo(() => rawFeelings.map(item => ({ ...item, key: item.label.replace(/^cycle\./, ''), label: t(item.label) })), [t]);
  const symptoms = useMemo(() => rawSymptoms.map(item => ({ ...item, key: item.name.replace(/^cycle\./, ''), name: t(item.name) })), [t]);
  const insights = useMemo(() => rawCycleInsights.map(item => ({ ...item, title: t(item.title), description: t(item.description) })), [t]);
  const isFutureDate = selectedDate > today;
  const currentMood = logQuery.data?.mood ?? null;
  const currentSymptoms = logQuery.data?.symptoms ?? [];
  const currentFlow = logQuery.data?.flow_status ?? 'none';

  const updateSettingsDraft = (patch: Partial<SettingsDraft>) => {
    setSettingsDraftState({ ownerId, value: { ...cycleSettings, ...patch } });
    setSettingsSaveError('');
    setSettingsSaveMessage('');
    setReminderError('');
  };

  const persistedSettings: SettingsDraft = settings ? settingsDraftFromRow(settings) : defaultSettings;
  const hasUnsavedSettings = Object.keys(defaultSettings).some(key =>
    cycleSettings[key as keyof SettingsDraft] !== persistedSettings[key as keyof SettingsDraft]
  );

  const saveSettings = async () => {
    if (settingsLock.current) return;
    settingsLock.current = true;
    setSavingSettings(true);
    setSettingsSaveError('');
    setSettingsSaveMessage('');
    setReminderError('');
    const next = { ...cycleSettings };
    try {
      const saved = await saveMyMenstrualCycleSettings(next);
      setSettingsDraftState({ ownerId: saved.user_id, value: settingsDraftFromRow(saved) });
      setSettingsSaveMessage('cycle.saved');
      await settingsQuery.refresh();
      try {
        const status = await reconcileMenstrualCycleReminder(
          saved.user_id,
          saved,
          t('cycle.notificationTitle'),
          expectedDate => t('cycle.notificationBody', { date: formatDate(expectedDate) }),
        );
        setReminderStatus(status);
      } catch {
        setReminderError(t('cycle.reminderScheduleFailed'));
      }
    } catch (error) {
      setSettingsSaveError(errorText(error));
    } finally {
      settingsLock.current = false;
      setSavingSettings(false);
    }
  };

  const saveLog = async (patch: { flow_status?: CycleFlowStatus; mood?: CycleMood | null; symptoms?: string[] }) => {
    if (isFutureDate || logLock.current) return;
    logLock.current = true;
    setSavingLog(true);
    setLogSaveError('');
    setLogSaveMessage('');
    const next = {
      log_date: selectedDate,
      flow_status: patch.flow_status ?? currentFlow,
      mood: patch.mood === undefined ? currentMood : patch.mood,
      symptoms: patch.symptoms ?? currentSymptoms,
    };
    try {
      await saveMyMenstrualCycleLog(next);
      setLogSaveMessage('cycle.logSaved');
      await logQuery.refresh();
    } catch (error) {
      setLogSaveError(errorText(error));
    } finally {
      logLock.current = false;
      setSavingLog(false);
    }
  };

  const openCalendar = (purpose: PickerPurpose) => {
    setPickerPurpose(purpose);
    setCalendarVisible(true);
  };
  const progress = prediction && settings ? Math.min(1, prediction.cycleDay / settings.cycle_length) : 0;
  const ovulationDay = settings ? Math.max(2, settings.cycle_length - 13) : 14;
  const reminderStatusText = reminderStatus
    ? t(`cycle.reminderStatus.${reminderStatus}`)
    : !notificationsEnabled
      ? t('cycle.reminderStatus.masterOff')
      : !cycleSettings.last_period_start || !cycleSettings.reminder_enabled
        ? t('cycle.reminderStatus.off')
        : t('cycle.reminderStatus.ready');

  return (
    <View style={styles.container}>
      <AppHeader
        title={t('health.cycleTracking')}
        showBack
        rightIcon="calendar-outline"
        onRightPress={() => openCalendar('week')}
        rightAccessibilityLabel="cycle.chooseDate"
      />
      <ScreenContainer scrollable padded>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>{formatDate(week.start, { month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={styles.weekNavigator}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('cycle.previousWeek')} style={styles.weekArrow} onPress={() => setSelectedDate(shiftDay(selectedDate, -7))}>
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.calendarBadge}><Text style={styles.calendarBadgeText}>{t('cycle.week', { week: weekNumber })}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('cycle.nextWeek')} style={styles.weekArrow} onPress={() => setSelectedDate(shiftDay(selectedDate, 7))}>
              <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekStripRow}>
            {weekDates.map(date => {
              const isSelected = selectedDate === date;
              const isToday = today === date;
              const datePrediction = getCyclePrediction(date, settings);
              const dayName = new Intl.DateTimeFormat(appLocale(), { weekday: 'short' }).format(parseLocalDate(date));
              return (
                <TouchableOpacity key={date} accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={formatDate(date)} style={styles.dayColumn} onPress={() => setSelectedDate(date)} activeOpacity={0.7}>
                  <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>{dayName}</Text>
                  <View style={[styles.dateCircle, isSelected && styles.selectedCircle, isToday && !isSelected && styles.todayCircle]}>
                    <Text style={[styles.dateNumber, isSelected && styles.selectedNumber, isToday && !isSelected && styles.todayNumber]}>{Number(date.slice(-2))}</Text>
                  </View>
                  {datePrediction?.isPeriodDay ? <View style={styles.periodDot} /> : <View style={styles.periodDotPlaceholder} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionHeader title={t('cycle.settingsTitle')} />
        <View style={styles.settingsCard}>
          <View style={styles.settingsDateRow}>
            <View style={styles.settingsDateCopy}>
              <Text style={styles.settingsLabel}>{t('cycle.lastPeriodStart')}</Text>
              <Text style={styles.settingsValue}>{cycleSettings.last_period_start ? formatDate(cycleSettings.last_period_start) : t('cycle.notSet')}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" disabled={savingSettings || settingsQuery.isLoading} style={[styles.chooseDateButton, (savingSettings || settingsQuery.isLoading) && styles.disabledOption]} onPress={() => openCalendar('periodStart')}>
              <Ionicons name="calendar-outline" size={18} color={Colors.coral} />
              <Text style={styles.chooseDateText}>{t('cycle.choosePeriodStart')}</Text>
            </TouchableOpacity>
          </View>
          <StepperRow label={t('cycle.cycleLength')} value={cycleSettings.cycle_length} unit={t('cycle.daysUnit')} min={21} max={45} onChange={value => updateSettingsDraft({ cycle_length: value })} disabled={savingSettings || settingsQuery.isLoading} />
          <StepperRow label={t('cycle.periodLength')} value={cycleSettings.period_length} unit={t('cycle.daysUnit')} min={1} max={10} onChange={value => updateSettingsDraft({ period_length: value })} disabled={savingSettings || settingsQuery.isLoading} />
          <StepperRow label={t('cycle.remindBefore')} value={cycleSettings.reminder_days_before} unit={t('cycle.daysUnit')} min={1} max={7} onChange={value => updateSettingsDraft({ reminder_days_before: value })} disabled={savingSettings || settingsQuery.isLoading} />
          <View style={styles.reminderRow}>
            <View style={styles.reminderCopy}>
              <Text style={styles.settingsLabel}>{t('cycle.reminder')}</Text>
              <Text style={styles.settingsHint}>{t('cycle.reminderHint')}</Text>
            </View>
            <Switch value={cycleSettings.reminder_enabled} disabled={savingSettings || settingsQuery.isLoading} onValueChange={value => updateSettingsDraft({ reminder_enabled: value })} trackColor={{ false: Colors.border, true: Colors.coral }} thumbColor={Colors.white} />
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.reminderStatus}>{reminderStatusText}</Text>
          {!notificationsEnabled ? <Text style={styles.warningText}>{t('cycle.reminderMasterHint')}</Text> : null}
          {settingsQuery.error ? <Text accessibilityRole="alert" style={styles.errorText}>{t('cycle.settingsLoadError')} {localizeMessage(settingsQuery.error)}</Text> : null}
          {settingsSaveError ? <Text accessibilityRole="alert" style={styles.errorText}>{settingsSaveError}</Text> : null}
          {reminderError ? <Text accessibilityRole="alert" style={styles.warningText}>{reminderError}</Text> : null}
          {settingsSaveMessage ? <Text accessibilityLiveRegion="polite" style={styles.successText}>{t(settingsSaveMessage)}</Text> : null}
          <PrimaryButton
            title={t(savingSettings ? 'cycle.savingSettings' : 'common.save')}
            onPress={saveSettings}
            disabled={!hasUnsavedSettings || settingsQuery.isLoading}
            loading={savingSettings}
          />
        </View>

        {prediction ? (
          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <View style={styles.phaseBadge}>
                <Ionicons name="flower-outline" size={14} color={Colors.coral} />
                <Text style={styles.phaseBadgeText}>{t('cycle.phaseValue', { phase: t(`cycle.phase.${prediction.phase}`).toUpperCase() })}</Text>
              </View>
              <Text style={styles.nextPeriodText}>{t('cycle.daysUntil', { count: prediction.daysUntilNextPeriod })}</Text>
            </View>
            <Text style={styles.statusMainText}>{t('cycle.dayOf', { day: prediction.cycleDay, total: settings?.cycle_length ?? 28 })}</Text>
            <Text style={styles.statusSubText}>{t('cycle.expectedForDate', { date: formatDate(prediction.expectedNextPeriodStart) })}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarTrack}><View style={[styles.progressBarFill, { width: `${Math.max(2, progress * 100)}%` }]} /></View>
              <View style={styles.progressLabelsRow}>
                <Text style={styles.progressLabel}>{t('cycle.periodDay')}</Text>
                <Text style={styles.progressLabel}>{t('cycle.ovulationAt', { day: ovulationDay })}</Text>
                <Text style={styles.progressLabel}>{t('cycle.lastDay', { day: settings?.cycle_length ?? 28 })}</Text>
              </View>
            </View>
            <Text style={styles.estimateNote}>{t('cycle.predictionNote')}</Text>
          </View>
        ) : (
          <View style={styles.setupPrompt}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.coral} />
            <Text style={styles.setupPromptText}>{t('cycle.setupPrompt')}</Text>
          </View>
        )}

        <SectionHeader title={t('cycle.flowStatus')} />
        <Text style={styles.sectionHint}>{t('cycle.flowHint', { date: formatDate(selectedDate) })}</Text>
        <View style={styles.flowGrid}>
          {flowStatuses.map(status => {
            const selected = currentFlow === status;
            return (
              <TouchableOpacity key={status} accessibilityRole="button" accessibilityState={{ selected, disabled: isFutureDate || savingLog }} disabled={isFutureDate || savingLog} onPress={() => void saveLog({ flow_status: status })} style={[styles.flowOption, selected && styles.flowOptionSelected, (isFutureDate || savingLog) && styles.disabledOption]}>
                <Text style={[styles.flowText, selected && styles.flowTextSelected]}>{t(`cycle.flow.${status}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionHeader title={t('cycle.feeling')} />
        <View style={styles.feelingsCard}>
          <View style={styles.feelingsRow}>
            {feelings.map(item => {
              const selected = currentMood === item.key;
              return (
                <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected, disabled: isFutureDate || savingLog }} disabled={isFutureDate || savingLog} style={[styles.feelingButton, selected && styles.feelingButtonSelected, (isFutureDate || savingLog) && styles.disabledOption]} onPress={() => void saveLog({ mood: item.key as CycleMood })} activeOpacity={0.7}>
                  <View style={[styles.feelingEmojiCircle, selected && styles.feelingEmojiCircleSelected]}><Text style={styles.feelingEmoji}>{item.emoji}</Text></View>
                  <Text style={[styles.feelingLabel, selected && styles.feelingLabelSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionHeader title={t('cycle.symptoms')} />
        <Text style={styles.sectionHint}>{t('cycle.symptomsHint')}</Text>
        <View style={styles.symptomsGrid}>
          {symptoms.map(symptom => {
            const selected = currentSymptoms.includes(symptom.key);
            return (
              <TouchableOpacity key={symptom.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: isFutureDate || savingLog }} disabled={isFutureDate || savingLog} style={[styles.symptomChip, selected && styles.symptomChipSelected, (isFutureDate || savingLog) && styles.disabledOption]} onPress={() => void saveLog({ symptoms: selected ? currentSymptoms.filter(item => item !== symptom.key) : [...currentSymptoms, symptom.key] })} activeOpacity={0.7}>
                <View style={[styles.symptomIconWrapper, selected && styles.symptomIconWrapperSelected]}><Ionicons name={symptom.icon as any} size={18} color={selected ? Colors.white : Colors.coral} /></View>
                <Text style={[styles.symptomName, selected && styles.symptomNameSelected]}>{symptom.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {isFutureDate ? <Text style={styles.warningText}>{t('cycle.futureLogReadOnly')}</Text> : null}
        {logQuery.error ? <Text accessibilityRole="alert" style={styles.errorText}>{t('cycle.logLoadError')} {localizeMessage(logQuery.error)}</Text> : null}
        {logSaveError ? <Text accessibilityRole="alert" style={styles.errorText}>{logSaveError}</Text> : null}
        {savingLog || logQuery.isLoading ? <Text style={styles.reminderStatus}>{t('cycle.savingLog')}</Text> : null}
        {logSaveMessage ? <Text accessibilityLiveRegion="polite" style={styles.successText}>{t(logSaveMessage)}</Text> : null}

        <SectionHeader title={t('cycle.insights')} />
        <View style={styles.insightsContainer}>
          <View style={styles.insightCard}>
            <View style={styles.insightIconWrapper}><Ionicons name="sparkles-outline" size={20} color={Colors.coral} /></View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{prediction ? t(`cycle.phase.${prediction.phase}`) : t('cycle.insightTitle')}</Text>
              <Text style={styles.insightDescription}>{t('cycle.phaseEstimateHint')}</Text>
            </View>
          </View>
          {insights.slice(1).map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightIconWrapper}><Ionicons name="fitness-outline" size={20} color={Colors.coral} /></View>
              <View style={styles.insightContent}><Text style={styles.insightTitle}>{insight.title}</Text><Text style={styles.insightDescription}>{insight.description}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.disclaimerContainer}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>{t('cycle.notice')}</Text>
        </View>
      </ScreenContainer>

      <CalendarDatePicker
        key={`${calendarVisible}-${pickerPurpose}-${selectedDate}-${cycleSettings.last_period_start ?? ''}`}
        visible={calendarVisible}
        date={pickerPurpose === 'periodStart' ? cycleSettings.last_period_start ?? selectedDate : selectedDate}
        maxDate={pickerPurpose === 'periodStart' ? today : undefined}
        title={t(pickerPurpose === 'periodStart' ? 'cycle.choosePeriodStart' : 'cycle.chooseDate')}
        onClose={() => setCalendarVisible(false)}
        onSelect={value => {
          setCalendarVisible(false);
          if (pickerPurpose === 'periodStart') updateSettingsDraft({ last_period_start: value });
          else setSelectedDate(value);
        }}
      />
    </View>
  );
}

function StepperRow({ label, value, unit, min, max, onChange, disabled }: {
  label: string; value: number; unit: string; min: number; max: number; onChange: (value: number) => void; disabled: boolean;
}) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} -`} disabled={disabled || value <= min} style={[styles.stepperButton, (disabled || value <= min) && styles.disabledOption]} onPress={() => onChange(value - 1)}><Ionicons name="remove" size={18} color={Colors.coral} /></TouchableOpacity>
        <Text style={styles.stepperValue}>{value} {unit}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} +`} disabled={disabled || value >= max} style={[styles.stepperButton, (disabled || value >= max) && styles.disabledOption]} onPress={() => onChange(value + 1)}><Ionicons name="add" size={18} color={Colors.coral} /></TouchableOpacity>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xl },
  calendarCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.border },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  calendarMonth: { ...Typography.cardTitle, color: Colors.textPrimary, textTransform: 'capitalize', flex: 1 },
  calendarBadge: { backgroundColor: Colors.coralLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  calendarBadgeText: { ...Typography.labelSmall, color: Colors.coral, fontWeight: '600' },
  weekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  weekArrow: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  weekStripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayColumn: { alignItems: 'center', flex: 1, minHeight: 62, justifyContent: 'center' },
  dayLabel: { ...Typography.labelSmall, color: Colors.textMuted, marginBottom: 6 },
  todayLabel: { color: Colors.coral, fontWeight: '700' },
  dateCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { borderWidth: 1, borderColor: Colors.coral },
  selectedCircle: { backgroundColor: Colors.coral, ...Shadows.sm },
  dateNumber: { ...Typography.label, color: Colors.textPrimary, fontWeight: '600' },
  selectedNumber: { color: Colors.white, fontWeight: '700' },
  todayNumber: { color: Colors.coral, fontWeight: '700' },
  periodDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.coral, marginTop: 3 },
  periodDotPlaceholder: { height: 8, marginTop: 3 },
  settingsCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  settingsDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  settingsDateCopy: { flex: 1 },
  settingsLabel: { ...Typography.bodySmall, color: Colors.textPrimary, fontWeight: '600' },
  settingsValue: { ...Typography.supporting, color: Colors.textSecondary, marginTop: 3 },
  chooseDateButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.coral, borderRadius: Radius.md },
  chooseDateText: { ...Typography.labelSmall, color: Colors.coral, fontWeight: '600' },
  stepperRow: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, backgroundColor: Colors.coralLight },
  stepperValue: { ...Typography.label, color: Colors.textPrimary, fontWeight: '700', minWidth: 66, textAlign: 'center' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingTop: Spacing.md },
  reminderCopy: { flex: 1 },
  settingsHint: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 3, lineHeight: 16 },
  reminderStatus: { ...Typography.labelSmall, color: Colors.textSecondary, marginTop: Spacing.sm },
  warningText: { ...Typography.labelSmall, color: Colors.orange, marginTop: Spacing.sm, lineHeight: 18 },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.sm },
  successText: { ...Typography.bodySmall, color: Colors.primaryDark, marginTop: Spacing.sm },
  statusCard: { backgroundColor: Colors.coralLight, borderRadius: Radius.xl, padding: Spacing.xl, marginTop: Spacing.lg, borderWidth: 1, borderColor: '#FCDDDD', ...Shadows.sm },
  statusTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  phaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full },
  phaseBadgeText: { ...Typography.labelSmall, color: Colors.coral, fontWeight: '700', letterSpacing: 0.3 },
  nextPeriodText: { ...Typography.label, color: Colors.coral, fontWeight: '600' },
  statusMainText: { ...Typography.largeTitle, fontSize: 26, lineHeight: 32, color: Colors.textPrimary, marginBottom: 4 },
  statusSubText: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.lg },
  progressContainer: { marginTop: Spacing.xs },
  progressBarTrack: { height: 8, backgroundColor: 'rgba(234, 119, 122, 0.2)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.coral, borderRadius: 4 },
  progressLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: Spacing.xs },
  progressLabel: { ...Typography.labelSmall, fontSize: 10, color: Colors.textMuted, flexShrink: 1 },
  estimateNote: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: Spacing.md, lineHeight: 17 },
  setupPrompt: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.coralLight },
  setupPromptText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  sectionHint: { ...Typography.supporting, color: Colors.textSecondary, marginTop: -Spacing.sm, marginBottom: Spacing.md, lineHeight: 19 },
  flowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flowOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  flowOptionSelected: { borderColor: Colors.coral, backgroundColor: Colors.coral },
  flowText: { ...Typography.labelSmall, color: Colors.textSecondary },
  flowTextSelected: { color: Colors.white, fontWeight: '700' },
  feelingsCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.border },
  feelingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feelingButton: { alignItems: 'center', flex: 1, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  feelingButtonSelected: { backgroundColor: Colors.coralLight },
  feelingEmojiCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, marginBottom: 5 },
  feelingEmojiCircleSelected: { backgroundColor: '#FFE6E6', borderWidth: 1.5, borderColor: Colors.coral },
  feelingEmoji: { fontSize: 20 },
  feelingLabel: { ...Typography.labelSmall, color: Colors.textSecondary, fontSize: 10 },
  feelingLabelSelected: { color: Colors.coral, fontWeight: '700' },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  symptomChip: { width: '47.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, minHeight: 52, gap: Spacing.sm, ...Shadows.sm },
  symptomChipSelected: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  symptomIconWrapper: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.coralLight, alignItems: 'center', justifyContent: 'center' },
  symptomIconWrapperSelected: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  symptomName: { ...Typography.bodySmall, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
  symptomNameSelected: { color: Colors.white, fontWeight: '600' },
  disabledOption: { opacity: 0.55 },
  insightsContainer: { gap: Spacing.md },
  insightCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, ...Shadows.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  insightIconWrapper: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.coralLight, alignItems: 'center', justifyContent: 'center' },
  insightContent: { flex: 1 },
  insightTitle: { ...Typography.cardTitle, color: Colors.textPrimary, marginBottom: 4 },
  insightDescription: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  disclaimerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.xxl, marginBottom: Spacing.xl, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  disclaimerText: { ...Typography.labelSmall, color: Colors.textMuted, flex: 1, lineHeight: 16 },
});

import { useTranslation } from 'react-i18next';
import { formatNumber, formatTime, formatDuration, formatDayLabel, formatDate } from '../../src/i18n/formatting';
import { localizeStaticData, localizeMessage } from '../../src/i18n/localize';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { WeeklyBarChart } from '../../src/components/charts/WeeklyBarChart';
import { SleepRecordForm } from '../../src/components/health/SleepRecordForm';
import { sleepTips as rawSleepTips } from '../../src/data/sleep';
import { useSleepRecords, useHealthGoals } from '../../src/hooks/healthHooks';
import { useAuth } from '../../src/contexts/AuthContext';
import { getWeekRange, getMonthRange, shiftDay, toLocalDateKey, timestampDateKey } from '../../src/lib/dateUtils';
import { aggregateSleep, sleepDurationMinutes } from '../../src/lib/healthCalculations';
import { deleteSleepRecord } from '../../src/services/sleepService';
import { dataError } from '../../src/lib/dataErrors';
import type { SleepRecordRow } from '../../src/types/database';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { useThemedStyles } from '../../src/contexts/ThemeContext';

export default function SleepScreen() {
  const { user } = useAuth();
  return <SleepContent key={user?.id ?? 'signed-out'} />;
}

function SleepContent() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(toLocalDateKey());
  const [editing, setEditing] = useState<SleepRecordRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<SleepRecordRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const deleteLock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const week = getWeekRange(date), month = getMonthRange(date);
  // One range query supplies history, weekly chart and both averages.
  const query = useSleepRecords({ start: week.start < month.start ? week.start : month.start, end: week.end > month.end ? week.end : month.end });
  const goals = useHealthGoals(date);
  const rows = query.data ?? [];
  const weekly = aggregateSleep(rows, week.start, week.end), monthly = aggregateSleep(rows, month.start, month.end);
  const selectedDay = aggregateSleep(rows,date,date);
  const latest = selectedDay.latestSession;
  const history = rows.filter(row => timestampDateKey(row.sleep_end) === date)
    .sort((a, b) => Date.parse(b.sleep_end) - Date.parse(a.sleep_end) || b.id.localeCompare(a.id));
  const chart = weekly.daily.filter(day => day.minutes !== null).map(day => ({ label: formatDayLabel(day.date), value: (day.minutes ?? 0) / 60 }));
  const move = (direction: number) => { setDate(shiftDay(date,direction)); setNotice(null); };
  const remove = async () => {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true; setBusy(true); setDeleteError(null);
    try {
      await deleteSleepRecord(deleting.id);
      if (mounted.current) { setDeleting(null); setNotice('sleep.deleted'); }
    } catch (error) { if (mounted.current) setDeleteError(dataError(error).message); }
    finally { deleteLock.current = false; if (mounted.current) setBusy(false); }
  };
  const openForm = (record: SleepRecordRow | null) => { setNotice(null); setEditing(record); };
  return <View style={styles.container}>
    <AppHeader title={t('health.sleep')} showBack />
    <ScreenContainer contentContainerStyle={{ paddingBottom:Spacing.md }}>
      <View style={styles.controls}>
        <Text style={styles.selectedDate}>{formatDate(date)}</Text>
        <View style={styles.dateControls}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousDay')} onPress={() => move(-1)} style={styles.dateArrow}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></TouchableOpacity>
          <TextButton title={t('period.today')} onPress={() => { setDate(toLocalDateKey()); setNotice(null); }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextDay')} onPress={() => move(1)} style={styles.dateArrow}><Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        </View>
      </View>
      {notice && <Text accessibilityRole="alert" style={styles.success}>{t(notice)}</Text>}
      <DataFeedback {...query} empty={!selectedDay.latestSession} />
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconCircle}><Ionicons name="moon" size={20} color={Colors.blue} /></View>
          <Text style={styles.summaryBadge}>{t('overview.recordedSleep')}</Text>
        </View>
        <Text style={styles.summaryLabel}>{t('sleep.selectedDayDuration')}</Text>
        <Text style={styles.summaryValue}>{formatDuration(query.data ? selectedDay.totalMinutes : null)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryColLabel}>{t('sleep.monthAverage')}</Text>
            <Text style={styles.summaryColValue}>{formatDuration(query.data ? monthly.averageDailyMinutes : null)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryColLabel}>{t('sleep.selectedDayRecords')}</Text>
            <Text style={styles.summaryColValue}>{query.data ? formatNumber(selectedDay.daily[0]?.sessionCount ?? 0) : '—'}</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>{t('sleep.averageRule')}</Text>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('sleep.selectedDateTotal', { duration: formatDuration(query.data ? selectedDay.totalMinutes : null) })}</Text>
        <Text style={styles.cardSubtitle}>{t('sleep.qualityValue', { value: formatNumber(selectedDay.averageQualityRating, 1) })}</Text>
        <DataFeedback {...goals} />
        <Text style={styles.cardSubtitle}>{t('sleep.goalValue', { duration: formatDuration(goals.data?.target_sleep_minutes) })}</Text>
        {selectedDay.totalMinutes > 0 && goals.data?.target_sleep_minutes != null && goals.data.target_sleep_minutes > 0 &&
          <Text style={styles.cardSubtitle}>{t('sleep.goalProgress', { value: formatNumber(selectedDay.totalMinutes / goals.data.target_sleep_minutes * 100, 0) })}</Text>}
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('sleep.weekly')}</Text>
        <Text style={styles.cardSubtitle}>{t('sleep.grouping')}</Text>
        {chart.length > 0 ? <View style={styles.chartWrapper} accessible accessibilityLabel={t('sleep.chartDescription', { values: weekly.daily.filter(day => day.minutes !== null).map(day => `${formatDate(day.date)}: ${formatDuration(day.minutes)}`).join('; ') })}>
          <WeeklyBarChart data={chart} color={Colors.blue} height={180} barWidth={22} showValues unit={t('units.hourShort')} />
        </View> : <Text style={styles.cardSubtitle}>{t('sleep.emptyChart')}</Text>}
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('sleep.latest')}</Text>
        {latest ? <>
          <Text style={styles.cardSubtitle}>{t('sleep.recordDate', { date: formatDate(latest.sleep_end) })}</Text>
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}><Ionicons name="moon" size={20} color={Colors.blue} />
              <View style={styles.flex}><Text style={styles.scheduleLabel}>{t('sleep.bedtime')}</Text><Text style={styles.scheduleTime}>{formatTime(latest.sleep_start)}</Text><Text style={styles.scheduleLabel}>{formatDate(latest.sleep_start)}</Text></View>
            </View>
            <View style={styles.scheduleItem}><Ionicons name="sunny" size={20} color={Colors.orange} />
              <View style={styles.flex}><Text style={styles.scheduleLabel}>{t('sleep.wakeUp')}</Text><Text style={styles.scheduleTime}>{formatTime(latest.sleep_end)}</Text><Text style={styles.scheduleLabel}>{formatDate(latest.sleep_end)}</Text></View>
            </View>
          </View>
          <Text style={styles.duration}>{formatDuration(sleepDurationMinutes(latest.sleep_start, latest.sleep_end))}</Text>
          <TextButton title={t('sleep.editRecord')} onPress={() => openForm(latest)} />
        </> : <Text style={styles.cardSubtitle}>{t('sleep.emptyHistory')}</Text>}
        <TextButton title={t('schedule.title')} onPress={() => router.push('/sleep-schedule')} />
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('sleep.history')}</Text>
        {!history.length && !query.isLoading && !query.error && <Text style={styles.cardSubtitle}>{t('sleep.emptyHistory')}</Text>}
        {history.map(record => <View key={record.id} style={styles.historyRecord}>
          <Text style={styles.cardTitle}>{formatDate(record.sleep_end)}</Text>
          <Text style={styles.duration}>{formatDuration(sleepDurationMinutes(record.sleep_start, record.sleep_end))}</Text>
          <Text style={styles.cardSubtitle}>{t('sleep.timeEndpoint', { field: t('sleep.bedtime'), date: formatDate(record.sleep_start), time: formatTime(record.sleep_start) })}</Text>
          <Text style={styles.cardSubtitle}>{t('sleep.timeEndpoint', { field: t('sleep.wakeUp'), date: formatDate(record.sleep_end), time: formatTime(record.sleep_end) })}</Text>
          {record.quality_rating !== null && <Text style={styles.cardSubtitle}>{t('sleep.ratingValue', { value: formatNumber(record.quality_rating) })}</Text>}
          {record.notes && <Text style={styles.cardSubtitle}>{record.notes}</Text>}
          <View style={styles.controlsRow}>
            <TextButton title={t('common.edit')} onPress={() => openForm(record)} disabled={busy} />
            <TextButton title={t('sleep.deleteRecord')} color={Colors.error} disabled={busy} onPress={() => { setDeleteError(null); setDeleting(record); }} />
          </View>
        </View>)}
      </View>
      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={20} color={Colors.blue} />
        <View style={styles.tipTextContainer}><Text style={styles.tipHeading}>{t('sleep.insight')}</Text><Text style={styles.tipText}>{localizeStaticData(rawSleepTips)[0]}</Text></View>
      </View>
    </ScreenContainer>
    <View style={[styles.stickyFooter,{paddingBottom:Math.max(insets.bottom,Spacing.md)}]}>
      <PrimaryButton title={t('sleep.addRecord')} onPress={() => openForm(null)} />
    </View>
    {editing !== undefined && <SleepRecordForm record={editing} onClose={() => setEditing(undefined)} onSaved={wakeDate => { setDate(wakeDate); setEditing(undefined); setNotice('sleep.saved'); }} />}
    <Modal visible={deleting !== null} transparent animationType="fade" onRequestClose={() => { if (!deleteLock.current) setDeleting(null); }}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}>
        <Text accessibilityRole="header" style={styles.cardTitle}>{t('sleep.deleteRecord')}</Text>
        <Text style={styles.cardSubtitle}>{t('sleep.deleteConfirmation', { date: deleting ? formatDate(deleting.sleep_end) : '' })}</Text>
        {deleteError && <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(deleteError)}</Text>}
        <PrimaryButton title={t(busy ? 'sleep.deleting' : 'sleep.deleteRecord')} loading={busy} onPress={remove} />
        <TextButton title={t('common.cancel')} disabled={busy} onPress={() => setDeleting(null)} />
      </View></View>
    </Modal>
  </View>;
}

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: Spacing.sm, marginTop: Spacing.md },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  selectedDate: { ...Typography.cardTitle, color:Colors.textPrimary, textAlign:'center' },
  dateControls: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:Colors.white, borderRadius:Radius.lg, borderWidth:1, borderColor:Colors.border, paddingHorizontal:Spacing.sm },
  dateArrow: { width:44, height:44, alignItems:'center', justifyContent:'center' },
  stickyFooter: { paddingHorizontal:Spacing.screenPadding, paddingTop:Spacing.md, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.border },
  success: { ...Typography.bodySmall, color: Colors.success, paddingVertical: Spacing.md },
  error: { ...Typography.bodySmall, color: Colors.error },
  duration: { ...Typography.cardTitle, color: Colors.blue, marginTop: Spacing.sm },
  historyRecord: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.screenPadding, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 480, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
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
    textAlign: 'center',
  },
  summaryColValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
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
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexGrow: 1,
    flexBasis: 130,
    flexShrink: 1,
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
  tipTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
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

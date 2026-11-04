import { useTranslation } from 'react-i18next';
import { formatNumber, formatTime, formatDuration, formatDate } from '../../src/i18n/formatting';
import { localizeStaticData, localizeMessage } from '../../src/i18n/localize';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { CalendarDatePicker } from '../../src/components/common/CalendarDatePicker';
import { SleepScheduleCard } from '../../src/components/health/SleepScheduleCard';
import { SleepAnalysis, type SleepChartPeriod } from '../../src/components/health/SleepAnalysis';
import { SleepRecordForm } from '../../src/components/health/SleepRecordForm';
import { sleepTips as rawSleepTips } from '../../src/data/sleep';
import { useSleepRecords, useHealthGoals } from '../../src/hooks/healthHooks';
import { useAuth } from '../../src/contexts/AuthContext';
import { getWeekRange, getMonthRange, shiftDay, toLocalDateKey, timestampDateKey, parseLocalDate } from '../../src/lib/dateUtils';
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
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(toLocalDateKey());
  const [chartDate, setChartDate] = useState(toLocalDateKey());
  const [chartPeriod, setChartPeriod] = useState<SleepChartPeriod>('week');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const selectDate = (value: string) => { setDate(value); setChartDate(value); setHistoryLimit(10); setCalendarOpen(false); setNotice(null); };
  const [editing, setEditing] = useState<SleepRecordRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<SleepRecordRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const deleteLock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const range = chartPeriod === 'week' ? getWeekRange(chartDate) : getMonthRange(chartDate);
  // Fetch the displayed period once, plus the selected day only when it is outside it.
  const query = useSleepRecords(range, date);
  const goals = useHealthGoals(date);
  const rows = query.data ?? [];
  const summary = aggregateSleep(rows,range.start,range.end);
  const selectedDay = aggregateSleep(rows,date,date);
  const history = rows.filter(row => timestampDateKey(row.sleep_end) === date)
    .sort((a,b) => Date.parse(b.sleep_end)-Date.parse(a.sleep_end)||b.id.localeCompare(a.id));
  const move = (direction: number) => { const next=shiftDay(date,direction); if(next<=toLocalDateKey()) selectDate(next); };
  const movePeriod = (offset: number) => {
    if(chartPeriod==='week') setChartDate(shiftDay(chartDate,offset*7));
    else { const next=parseLocalDate(getMonthRange(chartDate).start); next.setMonth(next.getMonth()+offset); setChartDate(toLocalDateKey(next)); }
  };
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
    <AppHeader
      title={t('health.sleep')}
      showBack
      rightIcon="calendar-outline"
      onRightPress={() => setCalendarOpen(true)}
      rightAccessibilityLabel="sleep.openCalendar"
    />
    <ScreenContainer contentContainerStyle={{ paddingBottom:Spacing.md }}>
      <View style={styles.controls}>
        <View style={styles.dateControls}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousDay')} onPress={() => move(-1)} style={styles.dateArrow}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary}/></TouchableOpacity>
          <View style={styles.dateLabel}><Text style={styles.selectedDate}>{formatDate(date)}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextDay')} disabled={date>=toLocalDateKey()} accessibilityState={{disabled:date>=toLocalDateKey()}} onPress={() => move(1)} style={styles.dateArrow}><Ionicons name="chevron-forward" size={24} color={date>=toLocalDateKey()?Colors.textMuted:Colors.textPrimary}/></TouchableOpacity>
        </View>
        <TextButton title={t('period.today')} onPress={()=>selectDate(toLocalDateKey())}/>
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.success}>{t(notice)}</Text> : null}
      <DataFeedback {...query} empty={!selectedDay.latestSession} />
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconCircle}><Ionicons name="moon" size={20} color={Colors.blue} /></View>
          <Text style={styles.summaryBadge}>{t('overview.recordedSleep')}</Text>
        </View>
        <Text style={styles.summaryLabel}>{t('sleep.selectedDayDuration')}</Text>
        <Text style={styles.summaryValue}>{formatDuration(query.data && selectedDay.latestSession ? selectedDay.totalMinutes : null)}</Text>
        <Text style={styles.cardSubtitle}>{t('sleep.periodAverage',{duration:formatDuration(summary.averageDailyMinutes)})}</Text>
        <DataFeedback {...goals}/>
        <Text style={styles.cardSubtitle}>{t('sleep.goalValue',{duration:formatDuration(goals.data?.target_sleep_minutes)})}</Text>
        {selectedDay.latestSession && goals.data?.target_sleep_minutes != null && goals.data.target_sleep_minutes>0 && <Text style={styles.cardSubtitle}>{t(selectedDay.totalMinutes>=goals.data.target_sleep_minutes?'schedule.goalMet':'schedule.goalNotMet')} · {t('sleep.goalProgress',{value:formatNumber(selectedDay.totalMinutes/goals.data.target_sleep_minutes*100,0)})}</Text>}
        {selectedDay.averageQualityRating!==null && <Text style={styles.cardSubtitle}>{t('sleep.qualityValue',{value:formatNumber(selectedDay.averageQualityRating,1)})}</Text>}
      </View>
      <SleepAnalysis rows={rows} date={chartDate} period={chartPeriod} onPeriodChange={setChartPeriod} onMove={movePeriod}/>
      <SleepScheduleCard/>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('sleep.history')}</Text>
        {!history.length && !query.isLoading && !query.error && <Text style={styles.cardSubtitle}>{t('sleep.emptyHistory')}</Text>}
        {history.slice(0,historyLimit).map((record,index) => <View key={record.id} style={styles.historyRecord}>
          <Text style={styles.cardTitle}>{formatDate(record.sleep_end)}{index===0?' · '+t('sleep.newest'):''}</Text>
          <Text style={styles.duration}>{formatDuration(sleepDurationMinutes(record.sleep_start, record.sleep_end))}</Text>
          <View style={styles.endpoint}><Ionicons name="moon" size={18} color={Colors.blue}/><Text style={styles.endpointText}>{t('sleep.timeEndpoint',{field:t('sleep.bedtime'),date:formatDate(record.sleep_start),time:formatTime(record.sleep_start)})}</Text></View>
          <View style={styles.endpoint}><Ionicons name="sunny" size={18} color={Colors.orange}/><Text style={styles.endpointText}>{t('sleep.timeEndpoint',{field:t('sleep.wakeUp'),date:formatDate(record.sleep_end),time:formatTime(record.sleep_end)})}</Text></View>
          {record.quality_rating !== null && <Text style={styles.cardSubtitle}>{t('sleep.ratingValue', { value: formatNumber(record.quality_rating) })}</Text>}
          {record.notes ? <Text style={styles.cardSubtitle}>{record.notes}</Text> : null}
          <View style={styles.controlsRow}>
            <TextButton title={t('common.edit')} onPress={() => openForm(record)} disabled={busy} />
            <TextButton title={t('sleep.deleteRecord')} color={Colors.error} disabled={busy} onPress={() => { setDeleteError(null); setDeleting(record); }} />
          </View>
        </View>)}
        {history.length>historyLimit&&<TextButton title={t('sleep.loadMore')} onPress={()=>setHistoryLimit(value=>value+10)}/>}
      </View>
      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={20} color={Colors.blue} />
        <View style={styles.tipTextContainer}><Text style={styles.tipHeading}>{t('sleep.insight')}</Text><Text style={styles.tipText}>{localizeStaticData(rawSleepTips)[0]}</Text></View>
      </View>
    </ScreenContainer>
    <View style={[styles.stickyFooter,{paddingBottom:Math.max(insets.bottom,Spacing.md)}]}>
      <PrimaryButton title={t('sleep.addRecord')} onPress={() => openForm(null)} />
    </View>
    {editing !== undefined && <SleepRecordForm record={editing} initialDate={date} onClose={() => setEditing(undefined)} onSaved={wakeDate => { selectDate(wakeDate); setEditing(undefined); setNotice('sleep.saved'); }} />}
    {calendarOpen&&<CalendarDatePicker visible date={date} title={t('sleep.selectedDate')} maxDate={toLocalDateKey()} markedDates={rows.map(row=>timestampDateKey(row.sleep_end))} onClose={()=>setCalendarOpen(false)} onSelect={selectDate}/>}
    <Modal visible={deleting !== null} transparent animationType="fade" onRequestClose={() => { if (!deleteLock.current) setDeleting(null); }}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}>
        <Text accessibilityRole="header" style={styles.cardTitle}>{t('sleep.deleteRecord')}</Text>
        <Text style={styles.cardSubtitle}>{t('sleep.deleteConfirmation', { date: deleting ? formatDate(deleting.sleep_end) : '' })}</Text>
        {deleteError ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(deleteError)}</Text> : null}
        <PrimaryButton title={t(busy ? 'sleep.deleting' : 'sleep.deleteRecord')} loading={busy} onPress={remove} />
        <TextButton title={t('common.cancel')} disabled={busy} onPress={() => setDeleting(null)} />
      </View></View>
    </Modal>
  </View>;
}

const baseStyles = StyleSheet.create({
  dateLabel:{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  endpoint:{flexDirection:'row',gap:8,alignItems:'center',marginTop:8},
  endpointText:{...Typography.supporting,color:Colors.textSecondary,flex:1},
  controls: { gap: Spacing.sm, marginTop: Spacing.md },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  selectedDate: { ...Typography.cardTitle, color:Colors.textPrimary, textAlign:'center',flexShrink:1 },
  dateControls: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:Colors.white, borderRadius:Radius.lg, borderWidth:1, borderColor:Colors.border, paddingHorizontal:Spacing.sm },
  dateArrow: { width:44, height:44, alignItems:'center', justifyContent:'center' },
  stickyFooter: { paddingHorizontal:Spacing.screenPadding, paddingTop:Spacing.md, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.border },
  success: { ...Typography.bodySmall, color: Colors.success, paddingVertical: Spacing.md },
  error: { ...Typography.bodySmall, color: Colors.error },
  duration: { ...Typography.cardTitle, color: Colors.blue, marginTop: Spacing.sm },
  historyRecord: { padding: Spacing.md, marginTop:Spacing.md, borderWidth:1, borderColor:Colors.border, borderRadius:Radius.lg, backgroundColor:Colors.background },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.screenPadding, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 480, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
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

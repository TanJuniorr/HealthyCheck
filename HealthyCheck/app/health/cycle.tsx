import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { CycleMonthCalendar } from '../../src/components/cycle/CycleMonthCalendar';
import { CyclePeriodEditor, type PeriodAction } from '../../src/components/cycle/CyclePeriodEditor';
import { CycleDailyLog } from '../../src/components/cycle/CycleDailyLog';
import { CycleSettings } from '../../src/components/cycle/CycleSettings';
import { cycleStyles } from '../../src/components/cycle/cycleStyles';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useNotificationInbox } from '../../src/contexts/NotificationInboxContext';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { useLocalToday } from '../../src/hooks/useLocalToday';
import { getMonthRange } from '../../src/lib/dateUtils';
import { CYCLE_POLICY, cycleSummaryKey, daysBetween, getCyclePrediction } from '../../src/lib/menstrualCycleCalculations';
import { getMyMenstrualCycleCalendar, getMyMenstrualCycleOverview, getMyMenstrualCycleHistory } from '../../src/services/menstrualCycleService';
import { reconcileMenstrualCycleReminder } from '../../src/services/menstrualCycleNotifications';
import { formatDate, formatNumber } from '../../src/i18n/formatting';
import { Colors } from '../../src/constants/colors';

export default function CycleTrackingScreen() {
 const { user, profile, profileChecked, profileError } = useAuth(), styles = useThemedStyles(cycleStyles);
 if (!profileChecked) return <View style={styles.container}>{profileError ? <Text style={styles.error}>{profileError}</Text> : <ActivityIndicator color={Colors.primary}/>}</View>;
 if (!user || profile?.gender !== 'female') return <Redirect href="/health"/>;
 return <CycleTrackingContent key={user.id} owner={user.id}/>;
}
export function CycleTrackingContent({ owner }: { owner: string }) {
 const { t, i18n } = useTranslation(), styles = useThemedStyles(cycleStyles), today = useLocalToday();
 const { notificationsEnabled } = useNotificationInbox();
 const [selected, setSelected] = useState(today), [month, setMonth] = useState(today), [page, setPage] = useState(1);
 const [action, setAction] = useState<PeriodAction | null>(null), [message, setMessage] = useState('');
 const [reminderStatus, setReminderStatus] = useState('cycle.reminderStatus.off');
 const overview = useHealthQuery(getMyMenstrualCycleOverview, `menstrual-cycle-overview:${today}`);
 const history = useHealthQuery(() => getMyMenstrualCycleHistory(page), `menstrual-cycle-history:${page}`);
 const range = getMonthRange(month);
 const calendar = useHealthQuery(() => getMyMenstrualCycleCalendar(range.start, range.end), `menstrual-cycle-calendar:${range.start}`);
 const data = overview.data, periods = data?.periods ?? [], settings = data?.settings ?? null;
 const prediction = getCyclePrediction(today, settings, periods), ongoing = periods.find(period => !period.end_date) ?? null;
 const selectedHasPeriod = (calendar.data?.periods ?? []).some(period => period.start_date <= selected && (!period.end_date || period.end_date >= selected));
 useEffect(() => {
  if (!data || overview.error) return;
  let alive = true;
  void reconcileMenstrualCycleReminder(owner, data.settings, t('cycle.notificationTitle'), expected => t('cycle.notificationBody', { date: formatDate(expected) }), data.periods, () => alive)
   .then(status => { if (alive) setReminderStatus(`cycle.reminderStatus.${status}`); })
   .catch(() => { if (alive) setReminderStatus('cycle.reminderScheduleFailed'); });
  return () => { alive = false; };
 }, [data, overview.error, owner, notificationsEnabled, i18n.resolvedLanguage, t]);
 const showAction = (next: PeriodAction) => { setMessage(''); setAction(next); };
 return <View style={styles.container}>
  <AppHeader title={t('health.cycleTracking')} showBack/>
  <ScreenContainer scrollable padded><View style={styles.content}>
   <DataFeedback {...overview}/>
   <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{t('cycle.overviewTitle')}</Text>
    <Text style={styles.emphasis}>{t(cycleSummaryKey(prediction), { count: prediction?.overdueDays || prediction?.daysUntilNextPeriod || 0 })}</Text>
    {periods[0] ? <Text style={styles.text}>{t('cycle.lastConfirmed', { date: formatDate(periods[0].start_date) })}</Text> : <Text style={styles.hint}>{t('cycle.noHistory')}</Text>}
    {prediction ? <>
     <Text style={styles.text}>{t(prediction.irregular ? 'cycle.expectedRange' : 'cycle.expectedForDate', { date: formatDate(prediction.expectedNextPeriodStart), start: formatDate(prediction.expectedWindowStart), end: formatDate(prediction.expectedWindowEnd) })}</Text>
     <Text style={styles.text}>{t('cycle.estimatedCycleLength', { count: prediction.estimatedCycleLength })}</Text>
     <Text style={styles.hint}>{t(`cycle.source.${prediction.source}`)} · {t(`cycle.confidence.${prediction.confidence}`)}</Text>
     {prediction.averagePeriodLength ? <Text style={styles.text}>{t('cycle.actualPeriodLength', { count: prediction.averagePeriodLength })}</Text> : null}
     {prediction.irregular ? <Text style={styles.hint}>{t('cycle.irregular')}</Text> : null}
     {prediction.intervals.length ? <Text style={styles.hint}>{t('cycle.recentIntervals', { values: prediction.intervals.map(value => formatNumber(value)).join(', ') })}</Text> : null}
    </> : <Text style={styles.hint}>{t('cycle.firstPeriodHint')}</Text>}
    {ongoing ? <>
     <Text style={styles.text}>{t('cycle.ongoingDays', { count: daysBetween(ongoing.start_date, today) + 1 })}</Text>
     {daysBetween(ongoing.start_date, today) + 1 > CYCLE_POLICY.prolongedPeriodDays ? <Text style={styles.hint}>{t('cycle.prolongedHint')}</Text> : null}
     <PrimaryButton title={t('cycle.endPeriod')} disabled={overview.isLoading || Boolean(overview.error)} onPress={() => showAction({ mode: 'end', period: ongoing })}/>
    </> : <PrimaryButton title={t('cycle.startPeriod')} disabled={overview.isLoading || Boolean(overview.error)} onPress={() => showAction({ mode: 'start' })}/>}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{t(message)}</Text> : null}
   </View>
   <DataFeedback {...calendar}/>
   <CycleMonthCalendar month={month} today={today} selected={selected} periods={calendar.data?.periods ?? []} logs={calendar.data?.logs ?? []} prediction={prediction} onSelect={setSelected} onMonth={setMonth}/>
   <CycleDailyLog key={`${owner}:${selected}`} owner={owner} date={selected} today={today} hasPeriod={selectedHasPeriod || Boolean(ongoing)} onStart={() => showAction({ mode: 'start', initialDate: selected })}/>
   <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{t('cycle.historyTitle')}</Text><DataFeedback {...history}/>
    {!history.isLoading && !history.error && !history.data?.data.length ? <Text style={styles.hint}>{t('cycle.noHistory')}</Text> : null}
    {history.data?.data.map((period, index, rows) => <View key={period.id} style={styles.separator}>
     <Text style={styles.title}>{formatDate(period.start_date)} — {period.end_date ? formatDate(period.end_date) : t('cycle.ongoing')}</Text>
     <Text style={styles.hint}>{t(period.end_date ? 'cycle.completed' : 'cycle.ongoing')}{period.end_date ? ` · ${t('cycle.durationDays', { count: daysBetween(period.start_date, period.end_date) + 1 })}` : ''}</Text>
     {rows[index + 1] || history.data?.previousStart ? <Text style={styles.hint}>{t('cycle.intervalDays', { count: daysBetween(rows[index + 1]?.start_date ?? history.data!.previousStart!, period.start_date) })}</Text> : null}
     {period.notes ? <Text style={styles.text}>{period.notes}</Text> : null}
     <View style={styles.row}>
      <TouchableOpacity accessibilityRole="button" style={styles.chip} onPress={() => showAction({ mode: 'edit', period })}><Text style={styles.success}>{t('cycle.editPeriod')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.chip} onPress={() => showAction({ mode: 'delete', period })}><Text style={styles.error}>{t('cycle.deletePeriod')}</Text></TouchableOpacity>
     </View>
    </View>)}
    <View style={styles.row}>
     {page > 1 ? <TextButton title={t('cycle.newerHistory')} disabled={history.isLoading} onPress={() => setPage(value => value - 1)}/> : null}
     {history.data?.hasMore ? <TextButton title={t('cycle.olderHistory')} disabled={history.isLoading} onPress={() => setPage(value => value + 1)}/> : null}
    </View>
   </View>
   {data ? <CycleSettings settings={settings} hasHistory={periods.length > 0} owner={owner} today={today} reminderStatus={reminderStatus}/> : null}
   <Text style={styles.hint}>{t('cycle.trackingNotice')}</Text>
  </View></ScreenContainer>
  {action ? <CyclePeriodEditor action={action} owner={owner} today={today} onClose={() => setAction(null)} onSaved={() => { setAction(null); setMessage('cycle.periodSaved'); setPage(1); }}/ > : null}
 </View>;
}

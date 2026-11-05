import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { Colors } from '../../src/constants/colors';
import { Radius, Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { CalendarDatePicker } from '../../src/components/common/CalendarDatePicker';
import { formatDate } from '../../src/i18n/formatting';
import { useLocalToday } from '../../src/hooks/useLocalToday';
import { shiftDay } from '../../src/lib/dateUtils';
import { validateReportRange } from '../../src/lib/healthReportCalculations';
import { healthReportHtml } from '../../src/lib/healthReportHtml';
import { loadHealthReport } from '../../src/services/healthReportService';
import { createHealthReportPdf, openReportPdf, printReportPdf, shareReportPdf } from '../../src/services/healthReportPdfService';
import { assertIdentity } from '../../src/services/queryCore';
import type { HealthReport, ReportPdf } from '../../src/types/healthReport';

function errorKey(error: unknown, fallback: string) {
  const value = error as { code?: string; message?: string } | null;
  if (value?.message?.startsWith('report.')) return value.message;
  if (value?.code === 'UNAUTHENTICATED') return 'report.signIn';
  if (value?.code === 'AUTH_CHANGED') return 'report.accountChanged';
  return fallback;
}

export default function HealthReportScreen() {
  const { user } = useAuth();
  return <ReportContent key={user?.id ?? 'guest'} owner={user?.id ?? null} />;
}

function ReportContent({ owner }: { owner: string | null }) {
  const styles = useThemedStyles(baseStyles), { t, i18n } = useTranslation(), today = useLocalToday();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [period, setPeriod] = useState<7 | 30 | 'custom'>(7);
  const [customStart, setCustomStart] = useState(() => shiftDay(today, -6));
  const [customEnd, setCustomEnd] = useState(today);
  const start = period === 'custom' ? customStart : shiftDay(today, -(period - 1));
  const end = period === 'custom' ? customEnd : today;
  const [calendar, setCalendar] = useState<'start' | 'end' | null>(null);
  const [preview, setPreview] = useState<{ key: string; report: HealthReport } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [revision, setRevision] = useState(0);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ key: string; pdf: ReportPdf } | null>(null);
  const [consentKey, setConsentKey] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const locked = useRef(false), alive = useRef(true), request = useRef(0);
  const dataKey = `${owner}:${start}:${end}:${revision}`;
  const outputKey = `${dataKey}:${language}`;
  const currentOutputKey = useRef(outputKey);
  const emptyConsent = consentKey === outputKey;
  const current = preview?.key === dataKey ? preview.report : null;
  const pdf = created?.key === outputKey ? created.pdf : null;
  let validation = '';
  try { validateReportRange(start, end, today); } catch (failure) { validation = errorKey(failure, 'report.invalidRange'); }
  const busy = Boolean(phase) || actionBusy;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { currentOutputKey.current = outputKey; }, [outputKey]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const sequence = ++request.current;
    setPreviewError('');
    if (!owner || validation) { setPreviewLoading(false); return; }
    setPreviewLoading(true);
    void loadHealthReport(start, end, owner).then(report => {
      if (active && request.current === sequence) setPreview({ key: dataKey, report });
    }).catch(failure => {
      if (active && request.current === sequence) { setPreview(null); setPreviewError(errorKey(failure, 'report.loadFailed')); }
    }).finally(() => { if (active && request.current === sequence) setPreviewLoading(false); });
    return () => { active = false; };
  }, [owner, start, end, dataKey, validation]));

  const generate = async () => {
    if (locked.current) return;
    if (!owner) { setError('report.signIn'); return; }
    if (validation) { setError(validation); return; }
    locked.current = true;
    const key = outputKey;
    const stillCurrent = () => alive.current && currentOutputKey.current === key;
    setError(''); setCreated(null); setPhase('report.loading');
    try {
      // Every export reloads all sources, even if the preview was loaded previously.
      const report = await loadHealthReport(start, end, owner);
      if (!stillCurrent()) return;
      request.current++; setPreviewLoading(false); setPreviewError(''); setPreview({ key: dataKey, report });
      if (!report.daysWithData && !emptyConsent) { setError('report.consentRequired'); return; }
      setPhase('report.aggregating');
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (!stillCurrent()) return;
      const html = healthReportHtml(report, i18n.getFixedT(language), language);
      await assertIdentity(owner);
      if (!stillCurrent()) return;
      setPhase('report.creating');
      const result = await createHealthReportPdf(report, html);
      await assertIdentity(owner);
      if (stillCurrent()) setCreated({ key, pdf: result });
    } catch (failure) { if (stillCurrent()) setError(errorKey(failure, 'report.pdfFailed')); }
    finally { locked.current = false; if (alive.current) setPhase(''); }
  };
  const action = async (operation: (file: ReportPdf) => Promise<void>) => {
    if (!pdf || locked.current) return;
    locked.current = true; setActionBusy(true); setError('');
    try { await operation(pdf); }
    catch (failure) {
      // Native print/share dismissal is not a failed export. Keep the generated file available.
      if (alive.current && !/cancel|dismiss/i.test(String((failure as Error)?.message))) setError(errorKey(failure, 'report.actionFailed'));
    } finally { locked.current = false; if (alive.current) setActionBusy(false); }
  };
  const types = current ? [
    { key: 'steps', present: current.steps.recordedDays > 0 }, { key: 'sleep', present: current.sleep.recordedDays > 0 },
    { key: 'water', present: current.water.recordedDays > 0 }, { key: 'nutrition', present: current.nutrition.recordedDays > 0 },
    { key: 'weight', present: current.weight.points.length > 0 },
  ] : [];
  const changePeriod = (choice: typeof period) => {
    if (busy) return;
    setError('');
    setConsentKey(null);
    if (choice === 'custom' && period !== 'custom') { setCustomStart(start); setCustomEnd(end); }
    setPeriod(choice);
  };
  return <View style={styles.screen}>
    <AppHeader title={t('report.title')} showBack />
    <ScreenContainer>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={30} color={Colors.primary} /></View>
        <Text style={styles.heading}>{t('report.title')}</Text>
        <Text style={styles.body}>{t('report.description')}</Text>
        <Text style={styles.badge}>PDF · A4</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('report.period')}</Text>
        <View style={styles.choices}>{([7, 30, 'custom'] as const).map(choice => <TouchableOpacity key={choice} accessibilityRole="radio" accessibilityState={{ checked: period === choice, disabled: busy }} disabled={busy} onPress={() => changePeriod(choice)} style={[styles.choice, period === choice && styles.selected]}>
          <Text style={[styles.choiceText, period === choice && styles.selectedText]}>{t(choice === 7 ? 'report.sevenDays' : choice === 30 ? 'report.thirtyDays' : 'report.custom')}</Text>
        </TouchableOpacity>)}</View>
        <View style={styles.dates}>{(['start', 'end'] as const).map(field => <TouchableOpacity key={field} accessibilityRole="button" accessibilityLabel={t(field === 'start' ? 'report.startDate' : 'report.endDate')} disabled={busy || period !== 'custom'} onPress={() => setCalendar(field)} style={styles.date}>
          <Text style={styles.hint}>{t(field === 'start' ? 'report.startDate' : 'report.endDate')}</Text>
          <Text style={styles.dateValue}>{formatDate(field === 'start' ? start : end, { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          {period === 'custom' && <Ionicons name="calendar-outline" size={18} color={Colors.primary} />}
        </TouchableOpacity>)}</View>
        <Text style={styles.hint}>{t('report.rangeHint')}</Text>
        {!!validation && <Text accessibilityRole="alert" style={styles.error}>{t(validation)}</Text>}
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('report.preview')}</Text>
        {!owner ? <Text style={styles.body}>{t('report.signIn')}</Text> : previewLoading ? <View style={styles.loading}><ActivityIndicator color={Colors.primary} /><Text style={styles.body}>{t('report.loading')}</Text></View> : previewError ? <>
          <Text accessibilityRole="alert" style={styles.error}>{t(previewError)}</Text><TextButton title={t('report.retry')} disabled={busy} onPress={() => setRevision(value => value + 1)} />
        </> : current && !validation ? <>
          <Text style={styles.name}>{current.profile?.full_name || t('report.noData')}</Text>
          <Text style={styles.body}>{formatDate(start)} - {formatDate(end)}</Text>
          <Text style={styles.coverage}>{t('report.coverageSummary', { count: current.daysWithData, total: current.dayCount })}</Text>
          {([true, false] as const).map(present => <View key={String(present)} style={styles.typeGroup}>
            <Text style={styles.hint}>{t(present ? 'report.availableTypes' : 'report.missingTypes')}</Text>
            <View style={styles.tags}>{types.filter(type => type.present === present).map(type => <View key={type.key} style={[styles.tag, present && styles.availableTag]}><Ionicons name={present ? 'checkmark-circle-outline' : 'ellipse-outline'} size={15} color={present ? Colors.primary : Colors.textMuted} /><Text style={styles.tagText}>{t(`report.${type.key}`)}</Text></View>)}</View>
            {!types.some(type => type.present === present) && <Text style={styles.hint}>—</Text>}
          </View>)}
          {!current.daysWithData && <View style={styles.empty}>
            <Text style={styles.sectionTitle}>{t('report.emptyTitle')}</Text><Text style={styles.body}>{t('report.emptyBody')}</Text>
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: emptyConsent, disabled: busy }} disabled={busy} onPress={() => setConsentKey(emptyConsent ? null : outputKey)} style={styles.consent}>
              <Ionicons name={emptyConsent ? 'checkbox' : 'square-outline'} size={24} color={Colors.primary} /><Text style={styles.consentText}>{t('report.emptyConsent')}</Text>
            </TouchableOpacity>
          </View>}
        </> : null}
      </View>
      {!!error && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text></View>}
      {!!phase && <Text accessibilityLiveRegion="polite" style={styles.progress}>{t(phase)}</Text>}
      <PrimaryButton title={t(error ? 'report.retry' : pdf ? 'report.regenerate' : 'report.generate')} onPress={generate} loading={Boolean(phase)} disabled={!owner || Boolean(validation) || actionBusy || (current?.daysWithData === 0 && !emptyConsent)} />
      {pdf && <View style={styles.card}>
        <Text accessibilityLiveRegion="polite" style={styles.ready}>{t(Platform.OS === 'web' ? 'report.webReady' : 'report.ready')}</Text>
        <Text style={styles.filename}>{pdf.filename}</Text>
        {pdf.canPreview && <TextButton title={t(Platform.OS === 'web' ? 'report.webPrint' : 'report.open')} disabled={busy} onPress={() => action(openReportPdf)} />}
        {pdf.canShare && <PrimaryButton title={t('report.share')} disabled={busy} onPress={() => action(shareReportPdf)} />}
        {Platform.OS !== 'web' && <TextButton title={t('report.print')} disabled={busy} onPress={() => action(printReportPdf)} />}
        {actionBusy && <ActivityIndicator color={Colors.primary} />}
        <Text style={styles.hint}>{t(Platform.OS === 'web' ? 'report.webHint' : 'report.cacheHint')}</Text>
        {!pdf.canShare && !pdf.canPreview && <Text style={styles.hint}>{t('report.noHandlers')}</Text>}
      </View>}
      {Platform.OS === 'web' && !pdf && <Text style={styles.webHint}>{t('report.webHint')}</Text>}
    </ScreenContainer>
    {calendar && <CalendarDatePicker visible allowYearSelection date={calendar === 'start' ? start : end} maxDate={today} title={t(calendar === 'start' ? 'report.startDate' : 'report.endDate')} onClose={() => setCalendar(null)} onSelect={date => { if (calendar === 'start') setCustomStart(date); else setCustomEnd(date); setCalendar(null); setError(''); setConsentKey(null); }} />}
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  hero: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  heroIcon: { backgroundColor: Colors.primaryLight, padding: 16, borderRadius: 22 },
  heading: { ...Typography.sectionTitle, color: Colors.textPrimary, textAlign: 'center' },
  body: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 22 },
  badge: { ...Typography.supporting, color: Colors.primary, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: Colors.primaryLight },
  card: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginVertical: Spacing.sm, gap: Spacing.sm },
  sectionTitle: { ...Typography.cardTitle, color: Colors.textPrimary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  choice: { flexGrow: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  choiceText: { ...Typography.supporting, color: Colors.textSecondary, textAlign: 'center' },
  selectedText: { color: Colors.primary, fontWeight: '700' },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  date: { flex: 1, minWidth: 118, minHeight: 76, padding: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.md, gap: 5 },
  dateValue: { ...Typography.bodySmall, color: Colors.textPrimary, fontWeight: '600' },
  hint: { ...Typography.supporting, color: Colors.textSecondary, lineHeight: 19 },
  name: { ...Typography.sectionTitle, color: Colors.textPrimary },
  coverage: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  typeGroup: { gap: 6, marginTop: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.background },
  availableTag: { backgroundColor: Colors.primaryLight },
  tagText: { ...Typography.supporting, color: Colors.textSecondary },
  empty: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: Radius.md, gap: 8 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 44 },
  consentText: { ...Typography.bodySmall, flex: 1, color: Colors.textPrimary },
  loading: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  errorBox: { padding: Spacing.md, backgroundColor: Colors.errorLight, borderRadius: Radius.md, marginVertical: Spacing.sm },
  error: { ...Typography.bodySmall, color: Colors.error, lineHeight: 22 },
  progress: { ...Typography.bodySmall, color: Colors.primary, marginVertical: Spacing.md, textAlign: 'center' },
  ready: { ...Typography.bodySmall, color: Colors.success, fontWeight: '600' },
  filename: { ...Typography.supporting, color: Colors.textPrimary },
  webHint: { ...Typography.supporting, color: Colors.textSecondary, marginTop: Spacing.md, lineHeight: 20 },
});

import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { SleepDateTimeField } from './SleepDateTimeField';
import type { SleepDateTimePickerMode } from './SleepDateTimeField.types';
import { formatDate, formatDuration, formatNumber } from '../../i18n/formatting';
import { localizeMessage } from '../../i18n/localize';
import { dataError } from '../../lib/dataErrors';
import { shiftDay, toLocalDateKey } from '../../lib/dateUtils';
import { sleepLocalTimestamp, unusualSleepDuration, validateCompletedSleep } from '../../lib/sleepValidation';
import { addSleepRecord, updateSleepRecord } from '../../services/sleepService';
import type { SleepRecordRow } from '../../types/database';
import { useThemedStyles } from '../../contexts/ThemeContext';

type Props = { record: SleepRecordRow | null; initialDate?: string; onClose: () => void; onSaved: (wakeDate: string) => void };
function clock(date: Date) { return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }

export function SleepRecordForm({ record, initialDate, onClose, onSaved }: Props) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [startDate, setStartDate] = useState(() => record ? toLocalDateKey(new Date(record.sleep_start)) : shiftDay(initialDate ?? new Date(), -1));
  const [startTime, setStartTime] = useState(() => record ? clock(new Date(record.sleep_start)) : '23:00');
  const [endDate, setEndDate] = useState(() => record ? toLocalDateKey(new Date(record.sleep_end)) : (initialDate ?? toLocalDateKey()));
  const [endTime, setEndTime] = useState(() => record ? clock(new Date(record.sleep_end)) : '07:00');
  const [quality, setQuality] = useState<number | null>(record?.quality_rating ?? null);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [activePicker, setActivePicker] = useState<{ field: 'start' | 'end'; mode: SleepDateTimePickerMode } | null>(null);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  let minutes: number | null = null;
  try { minutes = validateCompletedSleep(sleepLocalTimestamp(startDate, startTime), sleepLocalTimestamp(endDate, endTime)); } catch { /* Show validation on save. */ }
  const unusual = minutes !== null && unusualSleepDuration(minutes);
  const changeTimes = (which: 'start' | 'end', date: string, time?: string) => {
    if (lock.current) return;
    if (which === 'start') { setStartDate(date); setStartTime(time ?? ''); }
    else { setEndDate(date); setEndTime(time ?? ''); }
    setConfirmed(false); setError(null);
  };
  const changePicker = (field: 'start' | 'end', mode: SleepDateTimePickerMode) => {
    setActivePicker(current => {
      if (mode) return { field, mode };
      return current?.field === field ? null : current;
    });
  };
  const save = async () => {
    if (lock.current) return;
    setError(null); setActivePicker(null);
    lock.current = true; setSaving(true);
    try {
      const sleep_start = sleepLocalTimestamp(startDate, startTime), sleep_end = sleepLocalTimestamp(endDate, endTime);
      const duration = validateCompletedSleep(sleep_start, sleep_end);
      if (unusualSleepDuration(duration) && !confirmed) { setError('sleep.confirmUnusual'); return; }
      if (notes.length > 2000) { setError('sleep.notesTooLong'); return; }
      const payload = { sleep_start, sleep_end, quality_rating: quality, notes: notes.trim() || null };
      if (record) await updateSleepRecord(record.id, payload);
      else await addSleepRecord(payload);
      if (mounted.current) onSaved(endDate);
    } catch (failure) { if (mounted.current) setError(dataError(failure).message); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const close = () => { if (!lock.current) onClose(); };
  return <Modal visible animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={saving} onPress={close} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{t(record ? 'sleep.editRecord' : 'sleep.addRecord')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.hint}>{t('sleep.recordConvention')}</Text>
        <SleepDateTimeField label={t('sleep.bedtime')} date={startDate} time={startTime}
          activeMode={activePicker?.field === 'start' ? activePicker.mode : null}
          onActiveModeChange={mode => changePicker('start', mode)}
          disabled={saving} onChange={(date, time) => changeTimes('start', date, time)} />
        <SleepDateTimeField label={t('sleep.wakeUp')} date={endDate} time={endTime}
          activeMode={activePicker?.field === 'end' ? activePicker.mode : null}
          onActiveModeChange={mode => changePicker('end', mode)}
          disabled={saving} onChange={(date, time) => changeTimes('end', date, time)} />
        <Text style={styles.duration}>{t('sleep.durationValue', { duration: formatDuration(minutes) })}</Text>
        <Text style={styles.hint}>{t('sleep.recordDate', { date: endDate ? formatDate(endDate) : '—' })}</Text>
        {unusual && <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: saving }} disabled={saving}
          onPress={() => setConfirmed(value => !value)} style={styles.confirm}>
          <Text style={styles.hint}>{t('sleep.unusualDuration')}</Text>
          <Text style={styles.duration}>{t(confirmed ? 'sleep.unusualConfirmed' : 'sleep.confirmDuration')}</Text>
        </TouchableOpacity>}
        <Text style={styles.label}>{t('sleep.optionalQuality')}</Text>
        <View style={styles.qualityRow}>
          {[null, 1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value ?? 'none'} accessibilityRole="radio" accessibilityState={{ selected: quality === value, disabled: saving }}
            accessibilityLabel={value === null ? t('sleep.noRating') : t('sleep.ratingValue', { value: formatNumber(value) })}
            disabled={saving} onPress={() => setQuality(value)} style={[styles.rating, quality === value && styles.selected]}>
            <Text style={{ color: quality === value ? Colors.white : Colors.textPrimary }}>{value === null ? '—' : formatNumber(value)}</Text>
          </TouchableOpacity>)}
        </View>
        <Text style={styles.label}>{t('sleep.notes')}</Text>
        <TextInput accessibilityLabel={t('sleep.notes')} value={notes} onChangeText={setNotes} editable={!saving} multiline
          maxLength={2000} style={styles.notes} textAlignVertical="top" />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
        <PrimaryButton title={t(saving ? 'sleep.saving' : 'sleep.saveRecord')} loading={saving} onPress={save} />
        <TextButton title={t('common.cancel')} onPress={close} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.screenPadding, gap: Spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  backButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerSpacer: { width: 44, height: 44 },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary, position: 'absolute', left: 48, right: 48, textAlign: 'center' },
  hint: { ...Typography.bodySmall, color: Colors.textSecondary },
  label: { ...Typography.label, color: Colors.textSecondary },
  duration: { ...Typography.cardTitle, color: Colors.blue },
  confirm: { padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.orangeLight, borderRadius: Radius.md, minHeight: 48 },
  qualityRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: Spacing.xs },
  rating: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, borderRadius: Radius.md },
  selected: { backgroundColor: Colors.primary },
  notes: { ...Typography.body, color: Colors.textPrimary, minHeight: 96, padding: Spacing.md, backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md },
  error: { ...Typography.bodySmall, color: Colors.error },
});

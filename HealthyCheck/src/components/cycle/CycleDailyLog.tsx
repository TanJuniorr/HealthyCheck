import React, { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHealthQuery } from '../../hooks/useHealthQuery';
import { getMyMenstrualCycleLog, saveMyMenstrualCycleLog } from '../../services/menstrualCycleService';
import { formatDate } from '../../i18n/formatting';
import { localizeMessage } from '../../i18n/localize';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { PrimaryButton } from '../common/Buttons';
import { DataFeedback } from '../common/DataFeedback';
import { symptoms, feelings } from '../../data/cycle';
import type { CycleFlowStatus, CycleMood } from '../../types/database';
import { cycleStyles } from './cycleStyles';
type Draft = { flow_status: CycleFlowStatus | null; mood: CycleMood | null; symptoms: string[] };
export function CycleDailyLog({ date, today, owner, hasPeriod, onStart }: { date: string; today: string; owner: string; hasPeriod: boolean; onStart: () => void }) {
 const { t } = useTranslation(), styles = useThemedStyles(cycleStyles);
 const query = useHealthQuery(() => getMyMenstrualCycleLog(date), `menstrual-cycle-log:${date}`);
 const [editState, setEditState] = useState<{ value: Draft; dirty: boolean } | null>(null);
 const draft = editState?.dirty ? editState.value : query.data ? { flow_status: query.data.flow_status, mood: query.data.mood, symptoms: query.data.symptoms } : editState?.value ?? { flow_status: null, mood: null, symptoms: [] };
 const dirty = editState?.dirty ?? false;
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
 const lock = useRef(false);
 const disabled = date > today || query.isLoading || Boolean(query.error) || busy;
 const update = (patch: Partial<Draft>) => { setEditState({ value: { ...draft, ...patch }, dirty: true }); setMessage(''); setError(''); };
 const save = async () => {
  if (lock.current || disabled || !dirty) return;
  lock.current = true; setBusy(true); setError('');
  try { const saved = await saveMyMenstrualCycleLog({ ...draft, log_date: date }, owner); await query.refresh(); setEditState({ value: { flow_status: saved.flow_status, mood: saved.mood, symptoms: saved.symptoms }, dirty: false }); setMessage('cycle.logSaved'); }
  catch (failure) { setError(failure instanceof Error ? failure.message : 'cycle.saveFailed'); }
  finally { lock.current = false; setBusy(false); }
 };
 return <View style={styles.card}>
  <Text accessibilityRole="header" style={styles.title}>{t('cycle.dailyLog')}</Text>
  <Text style={styles.text}>{formatDate(date)}</Text><DataFeedback {...query}/>
  <Text style={styles.hint}>{t(query.data ? 'cycle.hasLog' : 'cycle.notRecorded')}</Text>
  <Text style={styles.text}>{t('cycle.flowStatus')}</Text>
  <View style={styles.chips}>{(['none', 'spotting', 'light', 'medium', 'heavy'] as CycleFlowStatus[]).map(flow => <TouchableOpacity key={flow} accessibilityRole="button" accessibilityState={{ selected: draft.flow_status === flow, disabled }} disabled={disabled} onPress={() => update({ flow_status: draft.flow_status === flow ? null : flow })} style={[styles.chip, draft.flow_status === flow && styles.selected, disabled && styles.muted]}><Text style={styles.text}>{t(`cycle.flow.${flow}`)}</Text></TouchableOpacity>)}</View>
  <Text style={styles.text}>{t('cycle.feeling')}</Text>
  <View style={styles.chips}>{feelings.map(item => { const mood = item.label.replace('cycle.', '') as CycleMood; return <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected: draft.mood === mood, disabled }} disabled={disabled} onPress={() => update({ mood: draft.mood === mood ? null : mood })} style={[styles.chip, draft.mood === mood && styles.selected]}><Text style={styles.text}>{item.emoji} {t(item.label)}</Text></TouchableOpacity>; })}</View>
  <Text style={styles.text}>{t('cycle.symptoms')}</Text>
  <View style={styles.chips}>{symptoms.map(item => { const symptom = item.name.replace('cycle.', ''), selected = draft.symptoms.includes(symptom); return <TouchableOpacity key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => update({ symptoms: selected ? draft.symptoms.filter(value => value !== symptom) : [...draft.symptoms, symptom] })} style={[styles.chip, selected && styles.selected]}><Text style={styles.text}>{selected ? '✓ ' : ''}{t(item.name)}</Text></TouchableOpacity>; })}</View>
  <Text style={styles.hint}>{t('cycle.flowNotConfirmation')}</Text>
  {!hasPeriod && draft.flow_status && !['none', 'spotting'].includes(draft.flow_status) && date <= today ? <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.chip} onPress={onStart}><Text style={styles.success}>{t('cycle.suggestStart')}</Text></TouchableOpacity> : null}
  {date > today ? <Text style={styles.hint}>{t('cycle.futureLogReadOnly')}</Text> : null}
  {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
  {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{t(message)}</Text> : null}
  <PrimaryButton title={t('cycle.saveLog')} loading={busy} disabled={disabled || !dirty} onPress={save}/>
 </View>;
}

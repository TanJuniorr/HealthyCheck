import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { randomUUID } from 'expo-crypto';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { AppTextInput } from '../common/AppTextInput';
import { CycleDateField } from './CycleDateField';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { localizeMessage } from '../../i18n/localize';
import { saveMyMenstrualCyclePeriod, deleteMyMenstrualCyclePeriod } from '../../services/menstrualCycleService';
import type { MenstrualCyclePeriodRow } from '../../types/database';
import { cycleStyles } from './cycleStyles';
export type PeriodAction = { mode: 'start' | 'end' | 'edit' | 'delete'; period?: MenstrualCyclePeriodRow; initialDate?: string };
export function CyclePeriodEditor({ action, owner, today, onClose, onSaved }: { action: PeriodAction; owner: string; today: string; onClose: () => void; onSaved: () => void }) {
 const { t } = useTranslation(), styles = useThemedStyles(cycleStyles), lock = useRef(false);
 const [id] = useState(() => action.period?.id ?? randomUUID());
 const [start, setStart] = useState(action.period?.start_date ?? action.initialDate ?? today);
 const [end, setEnd] = useState(action.mode === 'end' ? today : action.period?.end_date ?? null);
 const [notes, setNotes] = useState(action.period?.notes ?? '');
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const title = t(action.mode === 'delete' ? 'cycle.deletePeriod' : action.mode === 'start' ? 'cycle.startPeriod' : action.mode === 'end' ? 'cycle.endPeriod' : 'cycle.editPeriod');
 const save = async () => {
  if (lock.current) return;
  lock.current = true; setBusy(true); setError('');
  try {
   if (action.mode === 'delete' && action.period) await deleteMyMenstrualCyclePeriod(action.period, owner);
   else await saveMyMenstrualCyclePeriod({ id, start_date: start, end_date: end, notes }, owner, action.period?.updated_at);
   onSaved();
  } catch (failure) { setError(failure instanceof Error ? failure.message : 'cycle.saveFailed'); }
  finally { lock.current = false; setBusy(false); }
 };
 return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
  <Pressable style={styles.backdrop} onPress={() => { if (!busy) onClose(); }}>
   <Pressable accessibilityViewIsModal style={styles.dialog} onPress={() => {}}>
    <ScrollView keyboardShouldPersistTaps="handled"><View style={styles.content}>
     <Text accessibilityRole="header" style={styles.title}>{title}</Text>
     <Text style={styles.hint}>{t(action.mode === 'delete' ? 'cycle.confirmDelete' : 'cycle.confirmPeriod')}</Text>
     {action.mode !== 'delete' ? <>
      <CycleDateField label={t('cycle.periodStart')} value={start} today={today} disabled={busy || action.mode === 'end'} onChange={setStart}/>
      <CycleDateField label={t('cycle.periodEnd')} value={end} today={today} disabled={busy} onChange={setEnd}/>
      {end && action.mode !== 'end' ? <TextButton title={t('cycle.reopen')} disabled={busy} onPress={() => setEnd(null)}/> : null}
      {!end ? <Text style={styles.hint}>{t('cycle.noEndHint')}</Text> : null}
      <AppTextInput label={t('cycle.notes')} value={notes} editable={!busy} onChangeText={setNotes}/>
     </> : <Text style={styles.text}>{action.period?.start_date} — {action.period?.end_date ?? t('cycle.ongoing')}</Text>}
     {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
     <PrimaryButton title={t(action.mode === 'delete' ? 'common.delete' : 'common.save')} loading={busy} onPress={save}/>
     <TextButton title={t('common.cancel')} disabled={busy} onPress={onClose}/>
    </View></ScrollView>
   </Pressable>
  </Pressable>
 </Modal>;
}

import React, { useRef, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CycleDateField } from './CycleDateField';
import { PrimaryButton } from '../common/Buttons';
import { localizeMessage } from '../../i18n/localize';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { saveMyMenstrualCycleSettings } from '../../services/menstrualCycleService';
import type { MenstrualCycleSettingsRow } from '../../types/database';
import { cycleStyles } from './cycleStyles';
import { Colors } from '../../constants/colors';
type Settings = Omit<MenstrualCycleSettingsRow, 'user_id' | 'updated_at'>;
export function CycleSettings({ settings, hasHistory, owner, today, reminderStatus }: { settings: MenstrualCycleSettingsRow | null; hasHistory: boolean; owner: string; today: string; reminderStatus: string }) {
 const { t } = useTranslation(), styles = useThemedStyles(cycleStyles);
 const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
 const [draft, setDraft] = useState<Settings>(() => ({ last_period_start: settings?.last_period_start ?? null, cycle_length: settings?.cycle_length ?? 28, period_length: settings?.period_length ?? 5, reminder_enabled: settings?.reminder_enabled ?? true, reminder_days_before: settings?.reminder_days_before ?? 2 }));
 const lock = useRef(false);
 const update = (patch: Partial<Settings>) => { setDraft(previous => ({ ...previous, ...patch })); setMessage(''); setError(''); };
 const step = (key: 'cycle_length' | 'period_length' | 'reminder_days_before', min: number, max: number, label: string) => <View style={styles.row}>
  <Text style={styles.text}>{label}: {draft[key]}</Text><View style={styles.row}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('cycle.decrease', { field: label })} disabled={busy || draft[key] <= min} onPress={() => update({ [key]: Math.max(min, draft[key] - 1) })} style={styles.chip}><Text style={styles.text}>−</Text></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('cycle.increase', { field: label })} disabled={busy || draft[key] >= max} onPress={() => update({ [key]: Math.min(max, draft[key] + 1) })} style={styles.chip}><Text style={styles.text}>+</Text></TouchableOpacity>
  </View>
 </View>;
 const save = async () => {
  if (lock.current) return;
  lock.current = true; setBusy(true); setError('');
  try { await saveMyMenstrualCycleSettings(draft, owner); setMessage('cycle.saved'); }
  catch (failure) { setError(failure instanceof Error ? failure.message : 'cycle.saveFailed'); }
  finally { lock.current = false; setBusy(false); }
 };
 return <View style={styles.card}>
  <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.row}><Text style={styles.title}>{t('cycle.settingsTitle')}</Text><Text style={styles.text}>{open ? '−' : '+'}</Text></TouchableOpacity>
  <Text accessibilityLiveRegion="polite" style={styles.hint}>{t(reminderStatus)}</Text>
  {open ? <>
   <Text style={styles.hint}>{t('cycle.settingsExplanation')}</Text>
   {hasHistory ? <Text style={styles.hint}>{t('cycle.manualAnchorIgnored')}</Text> : <CycleDateField label={t('cycle.manualAnchor')} value={draft.last_period_start} today={today} disabled={busy} onChange={last_period_start => update({ last_period_start })}/>}
   {step('cycle_length', 21, 45, t('cycle.manualCycleLength'))}
   {step('period_length', 1, 10, t('cycle.expectedPeriodLength'))}
   {step('reminder_days_before', 1, 7, t('cycle.remindBefore'))}
   <View style={styles.row}><Text style={styles.text}>{t('cycle.reminder')}</Text><Switch accessibilityLabel={t('cycle.reminder')} value={draft.reminder_enabled} disabled={busy} onValueChange={reminder_enabled => update({ reminder_enabled })} trackColor={{ false: Colors.border, true: Colors.primary }}/></View>
   <Text style={styles.hint}>{t('cycle.reminderLimit')}</Text>
   {message ? <Text style={styles.success}>{t(message)}</Text> : null}
   {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
   <PrimaryButton title={t('common.save')} loading={busy} onPress={save}/>
  </> : null}
 </View>;
}

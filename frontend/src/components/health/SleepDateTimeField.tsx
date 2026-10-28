import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { appLocale, formatDate, formatTime } from '../../i18n/formatting';
import { parseLocalDate, toLocalDateKey } from '../../lib/dateUtils';
import { sleepLocalTimestamp } from '../../lib/sleepValidation';
import type { SleepDateTimeFieldProps } from './SleepDateTimeField.types';

export function SleepDateTimeField({ label, date, time, activeMode, onActiveModeChange, onChange, disabled }: SleepDateTimeFieldProps) {
  const { t } = useTranslation();
  const togglePicker = (next: 'date' | 'time') => onActiveModeChange(activeMode === next ? null : next);
  let value: Date;
  try { value = time === undefined ? parseLocalDate(date) : new Date(sleepLocalTimestamp(date, time)); }
  catch { value = new Date(); }
  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.fields}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sleep.chooseDate', { field: label })}
        accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={() => togglePicker('date')}
        style={[styles.fieldButton, styles.dateButton]}>
        <Ionicons name="calendar-outline" size={19} color={Colors.primary} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.dateValue}>{date ? formatDate(date) : t('sleep.chooseDate', { field: label })}</Text>
      </TouchableOpacity>
      {time !== undefined && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sleep.chooseTime', { field: label })}
        accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={() => togglePicker('time')}
        style={[styles.fieldButton, styles.timeButton]}>
        <Ionicons name="time-outline" size={20} color={Colors.primary} />
        <Text style={styles.timeValue}>{formatTime(value)}</Text>
      </TouchableOpacity>}
    </View>
    {activeMode && !disabled && <>
      <View style={Platform.OS === 'ios' ? styles.pickerCard : undefined}>
      <DateTimePicker value={value} mode={activeMode} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        locale={appLocale()} is24Hour={appLocale() === 'vi-VN'}
        minuteInterval={activeMode === 'time' && Platform.OS === 'ios' ? 5 : undefined}
        onDismiss={() => onActiveModeChange(null)}
        onValueChange={(_event, selected) => {
          if (Platform.OS !== 'ios') onActiveModeChange(null);
          if (activeMode === 'date') onChange(toLocalDateKey(selected), time);
          else onChange(date, `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
        }} />
      </View>
      {Platform.OS === 'ios' && <TouchableOpacity accessibilityRole="button" onPress={() => onActiveModeChange(null)} style={styles.doneButton}>
        <Text style={styles.doneText}>{t('sleep.done')}</Text>
      </TouchableOpacity>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: Colors.textSecondary, fontWeight: '600' },
  fields: { flexDirection: 'row', gap: 8 },
  fieldButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  dateButton: { flex: 1, minWidth: 0 },
  timeButton: { minWidth: 122, justifyContent: 'center' },
  dateValue: { flex: 1, color: Colors.textPrimary },
  timeValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pickerCard: { overflow: 'hidden', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  doneButton: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 12 },
  doneText: { color: Colors.primary, fontWeight: '700' },
});

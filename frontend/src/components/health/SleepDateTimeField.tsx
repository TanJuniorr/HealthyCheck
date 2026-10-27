import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { appLocale, formatDate, formatTime } from '../../i18n/formatting';
import { parseLocalDate, toLocalDateKey } from '../../lib/dateUtils';
import { sleepLocalTimestamp } from '../../lib/sleepValidation';
import type { SleepDateTimeFieldProps } from './SleepDateTimeField.types';

export function SleepDateTimeField({ label, date, time, onChange, disabled }: SleepDateTimeFieldProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  let value: Date;
  try { value = time === undefined ? parseLocalDate(date) : new Date(sleepLocalTimestamp(date, time)); }
  catch { value = new Date(); }
  return <View style={{ gap: 8 }}>
    <Text style={{ color: Colors.textSecondary }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sleep.chooseDate', { field: label })}
        disabled={disabled} onPress={() => setMode('date')}
        style={{ minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: Colors.background, flexGrow: 1 }}>
        <Text style={{ color: Colors.textPrimary }}>{date ? formatDate(date) : t('sleep.chooseDate', { field: label })}</Text>
      </TouchableOpacity>
      {time !== undefined && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sleep.chooseTime', { field: label })}
        disabled={disabled} onPress={() => setMode('time')}
        style={{ minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textPrimary }}>{formatTime(value)}</Text>
      </TouchableOpacity>}
    </View>
    {mode && !disabled && <>
      <DateTimePicker value={value} mode={mode} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        locale={appLocale()} is24Hour={appLocale() === 'vi-VN'}
        onDismiss={() => setMode(null)}
        onValueChange={(_event, selected) => {
          if (Platform.OS !== 'ios') setMode(null);
          if (mode === 'date') onChange(toLocalDateKey(selected), time);
          else onChange(date, `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
        }} />
      {Platform.OS === 'ios' && <TouchableOpacity accessibilityRole="button" onPress={() => setMode(null)} style={{ padding: 12, minHeight: 44 }}>
        <Text style={{ color: Colors.primary }}>{t('sleep.done')}</Text>
      </TouchableOpacity>}
    </>}
  </View>;
}

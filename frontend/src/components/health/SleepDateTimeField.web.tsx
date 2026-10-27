import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { appLocale } from '../../i18n/formatting';
import { Colors } from '../../constants/colors';
import type { SleepDateTimeFieldProps } from './SleepDateTimeField.types';

// Browser controls stay in this web-only module; native builds use the native picker.
export function SleepDateTimeField({ label, date, time, onChange, disabled }: SleepDateTimeFieldProps) {
  const { t } = useTranslation();
  const style: React.CSSProperties = { minHeight: 48, padding: 10, border: `1px solid ${Colors.border}`, borderRadius: 12,
    background: Colors.background, color: Colors.textPrimary, font: 'inherit', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', flex: '1 1 140px' };
  return <View style={{ gap: 8 }}>
    <Text style={{ color: Colors.textSecondary }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <input aria-label={t('sleep.chooseDate', { field: label })} lang={appLocale()} type="date" value={date} disabled={disabled}
        onChange={event => onChange(event.target.value, time)} style={style} />
      {time !== undefined && <input aria-label={t('sleep.chooseTime', { field: label })} lang={appLocale()} type="time" value={time} disabled={disabled}
        onChange={event => onChange(date, event.target.value)} style={style} />}
    </View>
  </View>;
}

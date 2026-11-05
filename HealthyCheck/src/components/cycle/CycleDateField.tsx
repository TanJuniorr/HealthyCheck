import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDatePicker } from '../common/CalendarDatePicker';
import { formatDate } from '../../i18n/formatting';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { cycleStyles } from './cycleStyles';
export function CycleDateField({ label, value, today, disabled = false, onChange }: { label: string; value: string | null; today: string; disabled?: boolean; onChange: (value: string) => void }) {
 const { t } = useTranslation(), styles = useThemedStyles(cycleStyles), [open, setOpen] = useState(false);
 return <>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setOpen(true)} style={[styles.dateButton, disabled && styles.muted]}>
   <Text style={styles.hint}>{label}</Text><Text style={styles.text}>{value ? formatDate(value) : t('cycle.notSet')}</Text>
  </TouchableOpacity>
  {open && <CalendarDatePicker visible allowYearSelection date={value ?? today} maxDate={today} title={label} onClose={() => setOpen(false)} onSelect={date => { onChange(date); setOpen(false); }}/ >}
 </>;
}

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, appLocale } from '../../i18n/formatting';
import { getDaysInRange, getMonthRange, parseLocalDate, toLocalDateKey } from '../../lib/dateUtils';
import { getCycleDayState, type CyclePrediction } from '../../lib/menstrualCycleCalculations';
import type { MenstrualCycleLogRow, MenstrualCyclePeriodRow } from '../../types/database';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

export function CycleMonthCalendar({ month, today, selected, periods, logs, prediction, onSelect, onMonth }: {
 month: string; today: string; selected: string; periods: MenstrualCyclePeriodRow[]; logs: MenstrualCycleLogRow[]; prediction: CyclePrediction; onSelect: (date: string) => void; onMonth: (date: string) => void;
}) {
 const { t } = useTranslation(), styles = useThemedStyles(baseStyles);
 const range = getMonthRange(month), first = parseLocalDate(range.start), offset = (first.getDay() + 6) % 7;
 const cells = [...Array.from({ length: offset }, () => null), ...getDaysInRange(range.start, range.end)];
 const move = (delta: number) => onMonth(toLocalDateKey(new Date(first.getFullYear(), first.getMonth() + delta, 1)));
 return <View style={styles.card}>
  <View style={styles.row}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousMonth')} onPress={() => move(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={22} color={Colors.textPrimary}/></TouchableOpacity>
   <Text accessibilityRole="header" style={styles.heading}>{formatDate(month, { month: 'long', year: 'numeric' })}</Text>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextMonth')} onPress={() => move(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={22} color={Colors.textPrimary}/></TouchableOpacity>
  </View>
  <View style={styles.grid}>
   {Array.from({ length: 7 }, (_, index) => <Text key={index} style={styles.weekday}>{new Intl.DateTimeFormat(appLocale(), { weekday: 'short' }).format(new Date(2024, 0, index + 1))}</Text>)}
   {cells.map((date, index) => {
    if (!date) return <View key={`empty-${index}`} style={styles.cell}/>;
    const state = getCycleDayState(date, today, periods, prediction), logged = logs.some(log => log.log_date === date);
    const label = [formatDate(date), state.start ? t('cycle.periodStart') : state.actual ? t('cycle.recorded') : state.predicted ? t('cycle.predicted') : '', logged ? t('cycle.hasLog') : ''].filter(Boolean).join(', ');
    return <TouchableOpacity key={date} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: selected === date }} onPress={() => onSelect(date)} style={styles.cell}>
     <View style={[styles.day, state.actual && styles.actual, state.predicted && styles.predicted, date === today && styles.today, selected === date && styles.selected]}>
      <Text style={[styles.dayText, selected === date && styles.selectedText]}>{Number(date.slice(-2))}</Text>
      <Text style={[styles.marker, selected === date && styles.selectedText]}>{state.start ? '▶' : state.actual ? '●' : state.predicted ? '~' : ''}{logged ? '•' : ''}</Text>
     </View>
    </TouchableOpacity>;
   })}
  </View>
  <TouchableOpacity accessibilityRole="button" onPress={() => { onMonth(today); onSelect(today); }} style={styles.todayButton}><Text style={styles.link}>{t('period.today')}</Text></TouchableOpacity>
  <View style={styles.legend}>
   <Text style={styles.legendText}>▶ {t('cycle.periodStart')}</Text><Text style={styles.legendText}>● {t('cycle.recorded')}</Text>
   <Text style={styles.legendText}>~ {t('cycle.predicted')}</Text><Text style={styles.legendText}>• {t('cycle.hasLog')}</Text>
  </View>
 </View>;
}
const baseStyles = StyleSheet.create({
 card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
 row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { ...Typography.cardTitle, color: Colors.textPrimary, flexShrink: 1, textAlign: 'center', textTransform: 'capitalize' },
 arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
 weekday: { width: '14.2857%', ...Typography.labelSmall, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },
 cell: { width: '14.2857%', minHeight: 48, alignItems: 'center', justifyContent: 'center' }, day: { width: '95%', minHeight: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
 actual: { backgroundColor: Colors.coralLight }, predicted: { borderStyle: 'dashed', borderColor: Colors.coral }, today: { borderColor: Colors.primary }, selected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
 dayText: { ...Typography.bodySmall, color: Colors.textPrimary }, marker: { fontSize: 10, minHeight: 12, color: Colors.coral }, selectedText: { color: Colors.white },
 todayButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { ...Typography.button, color: Colors.primary }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, legendText: { ...Typography.labelSmall, color: Colors.textSecondary },
});

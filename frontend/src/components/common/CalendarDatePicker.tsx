import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Radius, Spacing, Shadows } from '../../constants/spacing';
import { appLocale, formatDate } from '../../i18n/formatting';
import { parseLocalDate, toLocalDateKey } from '../../lib/dateUtils';
import { useThemedStyles } from '../../contexts/ThemeContext';

type CalendarDatePickerProps = {
  visible: boolean;
  maxDate?: string;
  markedDates?: string[];
  date: string;
  title: string;
  onClose: () => void;
  onSelect: (date: string) => void;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function CalendarDatePicker({ visible, date, title, onClose, onSelect, maxDate, markedDates = [] }: CalendarDatePickerProps) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => parseLocalDate(date));

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const cells = useMemo(() => {
    const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: Math.ceil((firstDay + dayCount) / 7) * 7 }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > dayCount) return null;
      return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    });
  }, [year, monthIndex]);

  const moveMonth = (offset: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(appLocale(), { weekday: 'short' }).format(new Date(2024, 0, index + 1))
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable accessibilityViewIsModal style={styles.dialog} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <View style={styles.monthRow}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousMonth')} onPress={() => moveMonth(-1)} style={styles.arrow}>
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{formatDate(month, { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextMonth')} onPress={() => moveMonth(1)} style={styles.arrow}>
              <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.monthRow}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousYear')} onPress={() => moveMonth(-12)} style={styles.arrow}><Ionicons name="play-back" size={18} color={Colors.primary}/></TouchableOpacity>
            <Text style={styles.monthLabel}>{new Intl.NumberFormat(appLocale(), {useGrouping:false}).format(year)}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextYear')} onPress={() => moveMonth(12)} style={styles.arrow}><Ionicons name="play-forward" size={18} color={Colors.primary}/></TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {weekdays.map((weekday, index) => <Text key={`weekday-${index}`} style={styles.weekday}>{weekday}</Text>)}
            {cells.map((cell, index) => {
              if (!cell) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const disabled = Boolean(maxDate && cell > maxDate);
              const selected = cell === date;
              const isToday = cell === toLocalDateKey();
              return (
                <TouchableOpacity key={cell} accessibilityRole="button" disabled={disabled} accessibilityState={{ selected, disabled }} accessibilityLabel={formatDate(cell)} onPress={() => { if (!disabled) onSelect(cell); }} style={[styles.dayCell, disabled && styles.disabledDay]}>
                  <View style={[styles.dayButton, selected && styles.selectedDay, isToday && !selected && styles.todayDay]}>
                    {markedDates.includes(cell) && <View style={[styles.recordDot, selected && styles.selectedDot]} />}
                    <Text style={[styles.dayText, selected && styles.selectedDayText]}>{Number(cell.slice(-2))}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity accessibilityRole="button" disabled={Boolean(maxDate && toLocalDateKey()>maxDate)} onPress={() => {if(!maxDate || toLocalDateKey()<=maxDate) onSelect(toLocalDateKey());}} style={styles.todayButton}>
            <Text style={styles.todayText}>{t('period.today')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.screenPadding, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 420, maxHeight:'90%', backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.md },
  title: { ...Typography.cardTitle, color: Colors.textPrimary, marginBottom: Spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, backgroundColor: Colors.background },
  monthLabel: { ...Typography.label, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: Colors.textMuted, ...Typography.labelSmall, paddingVertical: Spacing.sm },
  disabledDay: { opacity: 0.3 },
  recordDot: { position:'absolute', bottom:2, width:4, height:4, borderRadius:2, backgroundColor:Colors.primary },
  selectedDot: { backgroundColor:Colors.white },
  dayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  selectedDay: { backgroundColor: Colors.primary },
  todayDay: { borderWidth: 1, borderColor: Colors.primary },
  dayText: { ...Typography.bodySmall, color: Colors.textPrimary },
  selectedDayText: { color: Colors.white, fontWeight: '700' },
  todayButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  todayText: { ...Typography.button, color: Colors.primary },
  closeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...Typography.button, color: Colors.textSecondary },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { aggregateSleep } from '../../lib/healthCalculations';
import { getWeekRange, getMonthRange } from '../../lib/dateUtils';
import { formatDate, formatDuration, formatNumber } from '../../i18n/formatting';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { TextButton } from '../common/Buttons';
import type { SleepRecordRow } from '../../types/database';
export type SleepChartPeriod = 'week' | 'month';
type Props = { rows: SleepRecordRow[]; date: string; period: SleepChartPeriod; onPeriodChange: (period: SleepChartPeriod) => void; onMove: (offset: number) => void };
export function SleepAnalysis({ rows, date, period, onPeriodChange, onMove }: Props) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const [selected, setSelected] = useState<string | null>(null);
  const range = period === 'week' ? getWeekRange(date) : getMonthRange(date);
  const summary = aggregateSleep(rows, range.start, range.end);
  const maxHours = Math.max(8, Math.ceil(Math.max(0, ...summary.daily.map(day => day.minutes ?? 0)) / 60));
  const selectedDay = summary.daily.find(day => day.date === selected);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{t('sleep.chartTitle')}</Text>
    <View style={styles.periods}>
      {(['week', 'month'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }} onPress={() => onPeriodChange(value)} style={[styles.periodButton, period === value && styles.selectedPeriod]}>
        <Text style={[styles.text, period === value && styles.selectedText]}>{t(value === 'week' ? 'sleep.weekView' : 'sleep.monthView')}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={styles.navigation}><TextButton title={t('sleep.previousPeriod')} onPress={() => onMove(-1)}/><TextButton title={t('sleep.nextPeriod')} onPress={() => onMove(1)}/></View>
    <Text style={styles.text}>{t('sleep.dateRange', { start: formatDate(range.start), end: formatDate(range.end) })}</Text>
    <Text style={styles.text}>{t('sleep.chartMissing')}</Text>
    {!summary.latestSession && <Text style={styles.text}>{t('common.noRecords')}</Text>}
    <View style={styles.chart}>
      <View style={styles.axis}>{[1, .75, .5, .25, 0].map(fraction => <Text key={fraction} style={styles.axisText}>{formatNumber(maxHours * fraction)}{t('units.hourShort')}</Text>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.trend}>{summary.daily.map(day => <TouchableOpacity key={day.date} accessibilityRole="button" accessibilityState={{ selected: day.date === selected }} accessibilityLabel={formatDate(day.date) + ': ' + (day.minutes === null ? t('common.noRecords') : formatDuration(day.minutes))} onPress={() => setSelected(day.date)} style={styles.barColumn}>
          <View style={styles.track}>{day.minutes !== null && <View style={[styles.bar, { height: day.minutes / (maxHours * 60) * 180 }, day.date === selected && styles.selectedBar]}/>}</View>
          <Text style={styles.axisText}>{day.minutes === null ? '—' : formatNumber(day.minutes / 60, 1)}</Text>
          <Text style={styles.axisText}>{formatDate(day.date, { day:'numeric', month:'numeric' })}</Text>
        </TouchableOpacity>)}</View>
      </ScrollView>
    </View>
    {selectedDay && <Text style={styles.text}>{formatDate(selectedDay.date)}: {selectedDay.minutes === null ? t('common.noRecords') : formatDuration(selectedDay.minutes)}</Text>}
    <Text style={styles.text}>{t('sleep.chartSummary', { total: summary.latestSession ? formatDuration(summary.totalMinutes) : '—', average: formatDuration(summary.averageDailyMinutes) })}</Text>
  </View>;
}
const baseStyles = StyleSheet.create({
  card:{backgroundColor:Colors.white,padding:16,borderRadius:18,gap:12,marginTop:16},title:{color:Colors.textPrimary,fontSize:16,fontWeight:'600'},text:{color:Colors.textSecondary},
  periods:{flexDirection:'row',flexWrap:'wrap',gap:8},navigation:{flexDirection:'row',justifyContent:'space-between'},periodButton:{minHeight:44,paddingHorizontal:20,paddingVertical:12,borderRadius:12,backgroundColor:Colors.background},selectedPeriod:{backgroundColor:Colors.primary},selectedText:{color:Colors.white,fontWeight:'600'},
  chart:{flexDirection:'row',gap:4},axis:{height:180,justifyContent:'space-between',minWidth:36},axisText:{color:Colors.textSecondary,fontSize:11},trend:{flexDirection:'row',gap:6},barColumn:{alignItems:'center',gap:6,minWidth:44},track:{height:180,width:22,backgroundColor:Colors.background,borderRadius:4,justifyContent:'flex-end'},bar:{width:22,backgroundColor:Colors.primary,borderRadius:4},selectedBar:{backgroundColor:Colors.blue},
});

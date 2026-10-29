import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useHealthQuery } from '../../hooks/useHealthQuery';
import { getMySleepSchedule } from '../../services/sleepScheduleService';
import { useSleepReminderStatus } from '../../contexts/SleepReminderContext';
import { DataFeedback } from '../common/DataFeedback';
import { formatTime } from '../../i18n/formatting';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
const weekdays=['weekday.monday','weekday.tuesday','weekday.wednesday','weekday.thursday','weekday.friday','weekday.saturday','weekday.sunday'];
export function SleepScheduleCard() {
 const {t}=useTranslation();const router=useRouter();const styles=useThemedStyles(baseStyles);const status=useSleepReminderStatus();const query=useHealthQuery(getMySleepSchedule,'sleep-schedule:summary');
 const time=(value:string)=>formatTime(new Date(2000,0,1,Number(value.slice(0,2)),Number(value.slice(3,5))));
 return <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('schedule.title')} onPress={()=>router.push('/sleep-schedule')} style={styles.card}>
  <Text style={styles.title}>{t('schedule.title')}</Text><DataFeedback {...query}/>
  {query.data?<><Text style={styles.text}>{t('sleep.plannedTimes',{bed:time(query.data.bedtime),wake:time(query.data.wake_time)})}</Text><Text style={styles.text}>{query.data.active_days.map(day=>t(weekdays[day-1])).join(', ')}</Text><Text style={styles.text}>{t(`schedule.status_${query.data.reminder_enabled?status:'off'}`)}</Text></>:!query.isLoading&&!query.error&&<Text style={styles.text}>{t('sleep.noSchedule')}</Text>}
  <Text style={styles.action}>{t(query.data?'common.edit':'sleep.createSchedule')}</Text>
 </TouchableOpacity>;
}
const baseStyles=StyleSheet.create({card:{backgroundColor:Colors.white,padding:18,borderRadius:18,marginTop:16,gap:10},title:{color:Colors.textPrimary,fontSize:16,fontWeight:'600'},text:{color:Colors.textSecondary},action:{color:Colors.primary,fontWeight:'600',minHeight:44,paddingVertical:12}});

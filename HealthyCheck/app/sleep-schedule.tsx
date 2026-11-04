import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Switch, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { PrimaryButton, TextButton } from '../src/components/common/Buttons';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { SleepDateTimeField } from '../src/components/health/SleepDateTimeField';
import { useHealthQuery } from '../src/hooks/useHealthQuery';
import { useAuth } from '../src/contexts/AuthContext';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import { useSleepReminderStatus } from '../src/contexts/SleepReminderContext';
import { getMySleepSchedule, saveSleepSchedule, deleteSleepSchedule } from '../src/services/sleepScheduleService';
import { requestSleepPermission, reconcileSleepReminders } from '../src/services/sleepNotifications';
import { plannedDuration, validateSchedule } from '../src/lib/sleepSchedule';
import { toLocalDateKey } from '../src/lib/dateUtils';
import { dataError } from '../src/lib/dataErrors';
import { localizeMessage } from '../src/i18n/localize';
import { formatDuration, formatNumber } from '../src/i18n/formatting';
import { Colors } from '../src/constants/colors';
import type { SleepScheduleRow } from '../src/types/database';
import type { SleepDateTimePickerMode } from '../src/components/health/SleepDateTimeField.types';
const days=['weekday.monday','weekday.tuesday','weekday.wednesday','weekday.thursday','weekday.friday','weekday.saturday','weekday.sunday'];
export default function SleepScheduleScreen() {
 const {user}=useAuth();const {t}=useTranslation();const styles=useThemedStyles(baseStyles);
 const query=useHealthQuery(getMySleepSchedule,'sleep-schedule:mine');
 return <View style={styles.container}><AppHeader title={t('schedule.title')} showBack/><ScreenContainer><DataFeedback {...query}/>{!query.error&&(query.data!==null||!query.isLoading)&&<ScheduleForm key={user?.id??'signed-out'} initial={query.data}/>}</ScreenContainer></View>;
}
function ScheduleForm({initial}:{initial:SleepScheduleRow|null}) {
 const {user}=useAuth();const {t}=useTranslation();const styles=useThemedStyles(baseStyles);const status=useSleepReminderStatus();
 const [input,setInput]=useState(()=>initial?{bedtime:initial.bedtime.slice(0,5),wake_time:initial.wake_time.slice(0,5),active_days:initial.active_days,reminder_enabled:initial.reminder_enabled,reminder_minutes_before:initial.reminder_minutes_before}:{bedtime:'23:00',wake_time:'07:00',active_days:[1,2,3,4,5,6,7],reminder_enabled:false,reminder_minutes_before:15});
 const [picker,setPicker]=useState<{field:string;mode:SleepDateTimePickerMode}>({field:'',mode:null});
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[confirm,setConfirm]=useState(false);const lock=useRef(false);
 const run=async(remove=false)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError(null);setNotice(null);
  try {
   if(remove){await deleteSleepSchedule();setConfirm(false);setNotice('schedule.deleted');try{await reconcileSleepReminders(user?.id??null,null,'','');}catch{setError('schedule.notificationError');}}
   else {validateSchedule(input);if(input.reminder_enabled&&Platform.OS!=='web'&&!await requestSleepPermission()){setError('schedule.denied');return;}const saved=await saveSleepSchedule(input);setNotice('schedule.saved');try{await reconcileSleepReminders(user?.id??null,saved,t('schedule.notificationTitle'),t('schedule.notificationBody'));}catch{setError('schedule.notificationError');}}
  }catch(e){setError(dataError(e).message);}finally{lock.current=false;setBusy(false);}
 };
 let duration:number|null=null;try{duration=plannedDuration(input);}catch{}
 return <View style={styles.card}>
  <Text style={styles.text}>{t('schedule.convention')}</Text>
  {(['bedtime','wake_time'] as const).map(field=><SleepDateTimeField key={field} label={t(field==='bedtime'?'sleep.bedtime':'sleep.wakeUp')} hideDate date={toLocalDateKey()} time={input[field]} disabled={busy} activeMode={picker.field===field?picker.mode:null} onActiveModeChange={mode=>setPicker({field,mode})} onChange={(_date,time)=>setInput({...input,[field]:time??''})}/>)}
  <Text style={styles.text}>{t('sleep.durationValue',{duration:formatDuration(duration)})}</Text>
  <Text style={styles.text}>{t('schedule.activeDays')}</Text>
  <View style={styles.row}>{days.map((day,i)=><TextButton key={day} title={(input.active_days.includes(i+1)?'✓ ':'')+t(day)} disabled={busy} onPress={()=>setInput({...input,active_days:input.active_days.includes(i+1)?input.active_days.filter(d=>d!==i+1):[...input.active_days,i+1]})}/>)}</View>
  <View style={styles.row}><TextButton title={t('schedule.everyDay')} disabled={busy} onPress={()=>setInput({...input,active_days:[1,2,3,4,5,6,7]})}/><TextButton title={t('schedule.weekdays')} disabled={busy} onPress={()=>setInput({...input,active_days:[1,2,3,4,5]})}/></View>
  <View style={styles.row}><Text style={styles.text}>{t('schedule.bedtimeReminder')}</Text><Switch accessibilityLabel={t('schedule.bedtimeReminder')} value={input.reminder_enabled} disabled={busy} onValueChange={value=>setInput({...input,reminder_enabled:value})}/></View>
  {input.reminder_enabled&&<View style={styles.row}>{[5,10,15,30,60].map(minutes=><TextButton key={minutes} title={(input.reminder_minutes_before===minutes?'✓ ':'')+t('schedule.before',{minutes:formatNumber(minutes)})} disabled={busy} onPress={()=>setInput({...input,reminder_minutes_before:minutes})}/>)}</View>}
  <Text accessibilityRole="alert" style={styles.text}>{t(`schedule.status_${status}`)}</Text>
  {(status==='denied'||error==='schedule.denied')&&Platform.OS!=='web'&&<TextButton title={t('schedule.openSettings')} onPress={()=>Linking.openSettings()}/>}
  {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
  {notice ? <Text accessibilityRole="alert" style={styles.text}>{t(notice)}</Text> : null}
  <PrimaryButton title={t(busy?'sleep.saving':'schedule.save')} loading={busy} onPress={()=>run()}/>
  {initial&&<TextButton title={t('schedule.delete')} disabled={busy} onPress={()=>setConfirm(true)}/>}
  {confirm&&<View style={styles.card}><Text style={styles.text}>{t('schedule.confirmDelete')}</Text><TextButton title={t('schedule.delete')} disabled={busy} onPress={()=>run(true)}/><TextButton title={t('common.cancel')} disabled={busy} onPress={()=>setConfirm(false)}/></View>}
 </View>;
}
const baseStyles=StyleSheet.create({container:{flex:1,backgroundColor:Colors.background},card:{backgroundColor:Colors.white,padding:18,borderRadius:20,gap:16,marginVertical:12},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6},text:{color:Colors.textPrimary,flexShrink:1},error:{color:Colors.error}});

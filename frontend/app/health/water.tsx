import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { CalendarDatePicker } from '../../src/components/common/CalendarDatePicker';
import { PrimaryButton, TextButton } from '../../src/components/common/Buttons';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { WeeklyBarChart } from '../../src/components/charts/WeeklyBarChart';
import { WaterRecordForm } from '../../src/components/health/WaterRecordForm';
import { useWaterTracking } from '../../src/hooks/healthHooks';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { getWeekRange, shiftDay, timestampDateKey, toLocalDateKey } from '../../src/lib/dateUtils';
import { aggregateWater, selectCurrentGoals } from '../../src/lib/healthCalculations';
import { deleteWaterRecord } from '../../src/services/waterService';
import { dataError } from '../../src/lib/dataErrors';
import { formatDate, formatTime, formatNumber, formatDayLabel } from '../../src/i18n/formatting';
import { localizeMessage } from '../../src/i18n/localize';
import { Colors } from '../../src/constants/colors';
import type { WaterRecordRow } from '../../src/types/database';
export default function WaterScreen(){const {user}=useAuth();return <WaterContent key={user?.id??'signed-out'}/>;}
function WaterContent(){
 const {t}=useTranslation();const styles=useThemedStyles(baseStyles);
 const [date,setDate]=useState(toLocalDateKey()),[calendar,setCalendar]=useState(false);
 const [form,setForm]=useState<{record:WaterRecordRow|null;amount?:number}|null>(null);
 const [deleting,setDeleting]=useState<WaterRecordRow|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const lock=useRef(false),mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const range=getWeekRange(date),query=useWaterTracking(range),rows=query.data?.rows??[],goals=query.data?.goals??[];
 const goal=selectCurrentGoals(goals,date)?.daily_water_ml??null;
 const day=aggregateWater(rows,date,date,goal),week=aggregateWater(rows,range.start,range.end);
 const percent=goal&&goal>0?day.totalMl/goal*100:null;
 const history=rows.filter(row=>timestampDateKey(row.recorded_at)===date).sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at)||b.id.localeCompare(a.id));
 const recorded=week.daily.filter(d=>d.hasRecords),achieved=week.daily.filter(d=>{const target=selectCurrentGoals(goals,d.date)?.daily_water_ml;return d.hasRecords&&target!=null&&target>0&&d.totalMl>=target;}).length;
 const select=(value:string)=>{if(value<=toLocalDateKey()){setDate(value);setCalendar(false);setNotice(null);}};
 const open=(record:WaterRecordRow|null,amount?:number)=>{setNotice(null);setForm({record,amount});};
 const remove=async()=>{
  if(!deleting||lock.current)return;lock.current=true;setBusy(true);setError(null);
  try{await deleteWaterRecord(deleting.id);if(mounted.current){setDeleting(null);setNotice('water.deleted');}}
  catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 return <View style={styles.screen}><AppHeader title={t('water.title')} showBack/><ScreenContainer>
  <View style={styles.dateRow}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.previousDay')} style={styles.arrow} onPress={()=>select(shiftDay(date,-1))}><Ionicons name="chevron-back" size={24} color={Colors.primary}/></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('water.chooseDate')} style={styles.dateLabel} onPress={()=>setCalendar(true)}><Ionicons name="calendar-outline" size={20} color={Colors.primary}/><Text style={styles.text}>{formatDate(date)}</Text></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('calendar.nextDay')} disabled={date>=toLocalDateKey()} accessibilityState={{disabled:date>=toLocalDateKey()}} style={styles.arrow} onPress={()=>select(shiftDay(date,1))}><Ionicons name="chevron-forward" size={24} color={Colors.primary}/></TouchableOpacity>
  </View>
  <TextButton title={t('period.today')} onPress={()=>select(toLocalDateKey())}/><DataFeedback {...query}/>
  {notice&&<Text accessibilityRole="alert" style={styles.success}>{t(notice)}</Text>}
  <View style={styles.card}>
   <Text style={styles.title}>{t('water.title')}</Text><Text style={styles.total}>{t('water.ml',{value:query.data?formatNumber(day.totalMl):'—'})}</Text>
   <Text style={styles.text}>{t('water.goal',{value:formatNumber(goal)})}</Text>
   {percent!==null?<><Text style={styles.text}>{t('water.remaining',{value:formatNumber(Math.max(0,goal!-day.totalMl)),percent:formatNumber(percent,0)})}</Text><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.min(100,percent)}} style={styles.track}><View style={[styles.fill,{width:`${Math.min(100,percent)}%`}]}/></View></>:<Text style={styles.text}>{t('water.noGoal')}</Text>}
  </View>
  <View style={styles.card}><Text style={styles.title}>{t('water.add')}</Text><View style={styles.quick}>{[100,200,250,500].map(ml=><TextButton key={ml} title={t('water.ml',{value:formatNumber(ml)})} onPress={()=>open(null,ml)}/>)}</View><PrimaryButton title={t('water.custom')} onPress={()=>open(null)}/></View>
  <View style={styles.card}><Text style={styles.title}>{t('water.history')}</Text>
   {!history.length&&!query.isLoading&&!query.error&&<Text style={styles.text}>{t('water.empty')}</Text>}
   {history.map(row=><View key={row.id} style={styles.entry}><Text style={styles.text}>{formatTime(row.recorded_at)} · {t('water.ml',{value:formatNumber(row.amount_ml)})}</Text><View style={styles.quick}><TextButton title={t('common.edit')} disabled={busy} onPress={()=>open(row)}/><TextButton title={t('water.delete')} color={Colors.error} disabled={busy} onPress={()=>{setError(null);setDeleting(row);}}/></View></View>)}
  </View>
  <View style={styles.card}><Text style={styles.title}>{t('water.weekly')}</Text><Text style={styles.text}>{t('sleep.dateRange',{start:formatDate(range.start),end:formatDate(range.end)})}</Text>
   {recorded.length?<><View accessible accessibilityLabel={week.daily.map(d=>`${formatDate(d.date)}: ${d.hasRecords?t('water.ml',{value:formatNumber(d.totalMl)}):t('common.noRecords')}`).join('; ')}><WeeklyBarChart data={week.daily.filter(d=>d.hasRecords).map(d=>({label:formatDayLabel(d.date),value:d.totalMl}))} color={Colors.blue} showValues height={180}/></View><Text style={styles.text}>{t('water.weekStats',{average:formatNumber(week.totalMl/recorded.length,0),days:formatNumber(recorded.length),achieved:formatNumber(achieved)})}</Text></>:<Text style={styles.text}>{t('common.noRecords')}</Text>}
   <Text style={styles.text}>{t('water.averageRule')}</Text>
  </View>
 </ScreenContainer>
 {form&&<WaterRecordForm record={form.record} amount={form.amount} date={date} onClose={()=>setForm(null)} onSaved={savedDate=>{setDate(savedDate);setForm(null);setNotice('water.saved');}}/>}
 {calendar&&<CalendarDatePicker visible date={date} title={t('water.chooseDate')} maxDate={toLocalDateKey()} markedDates={week.daily.filter(d=>d.hasRecords).map(d=>d.date)} onSelect={select} onClose={()=>setCalendar(false)}/>}
 <Modal visible={deleting!==null} transparent animationType="fade" onRequestClose={()=>{if(!lock.current)setDeleting(null);}}><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}><Text style={styles.title}>{t('water.delete')}</Text><Text style={styles.text}>{t('water.confirmDelete',{value:deleting?formatNumber(deleting.amount_ml):'',time:deleting?formatTime(deleting.recorded_at):''})}</Text>{error&&<Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text>}<PrimaryButton title={t(busy?'water.deleting':'water.delete')} loading={busy} onPress={remove}/><TextButton title={t('common.cancel')} disabled={busy} onPress={()=>setDeleting(null)}/></View></View></Modal>
 </View>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},card:{backgroundColor:Colors.white,padding:18,borderRadius:20,gap:12,marginBottom:16},dateRow:{flexDirection:'row',alignItems:'center',marginTop:12},dateLabel:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},arrow:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{color:Colors.textPrimary,fontSize:17,fontWeight:'600'},total:{color:Colors.blue,fontSize:32,fontWeight:'700'},text:{color:Colors.textSecondary,flexShrink:1},success:{color:Colors.success,paddingVertical:12},error:{color:Colors.error},track:{height:10,backgroundColor:Colors.border,borderRadius:5,overflow:'hidden'},fill:{height:10,backgroundColor:Colors.blue},quick:{flexDirection:'row',flexWrap:'wrap',gap:4},entry:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:Colors.border},backdrop:{flex:1,justifyContent:'center',alignItems:'center',padding:20,backgroundColor:'rgba(0,0,0,0.45)'},dialog:{backgroundColor:Colors.white,borderRadius:20,padding:20,gap:16,width:'100%',maxWidth:480}});

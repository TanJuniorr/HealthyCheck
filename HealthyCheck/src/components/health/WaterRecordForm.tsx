import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput } from '../common/AppTextInput';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { SleepDateTimeField } from './SleepDateTimeField';
import type { SleepDateTimePickerMode } from './SleepDateTimeField.types';
import type { WaterRecordRow } from '../../types/database';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { toLocalDateKey } from '../../lib/dateUtils';
import { waterAmount, waterTimestamp } from '../../lib/waterValidation';
import { addWaterRecord, updateWaterRecord } from '../../services/waterService';
import { dataError } from '../../lib/dataErrors';
import { localizeMessage } from '../../i18n/localize';
import { formatDate, formatNumber } from '../../i18n/formatting';
type Props={record:WaterRecordRow|null;date:string;amount?:number;onClose:()=>void;onSaved:(date:string)=>void};
function clock(value:Date){return `${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`;}
export function WaterRecordForm({record,date,amount,onClose,onSaved}:Props) {
 const {t}=useTranslation();const styles=useThemedStyles(baseStyles),insets=useSafeAreaInsets();
 const [value,setValue]=useState(String(record?.amount_ml??amount??250));
 const [day,setDay]=useState(()=>record?toLocalDateKey(new Date(record.recorded_at)):date);
 const [time,setTime]=useState(()=>clock(record?new Date(record.recorded_at):new Date()));
 const [mode,setMode]=useState<SleepDateTimePickerMode>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const close=()=>{if(!lock.current)onClose();};
 const save=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError(null);
  try {
   const payload={amount_ml:waterAmount(value),recorded_at:waterTimestamp(day,time)};
   if(record) await updateWaterRecord(record.id,payload);else await addWaterRecord(payload);
   if(mounted.current)onSaved(day);
  }catch(e){if(mounted.current)setError(dataError(e).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 return <Modal visible animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+20}]}>
  <Text accessibilityRole="header" style={styles.title}>{t(record?'water.edit':'water.add')}</Text>
  <View pointerEvents={busy?'none':'auto'}><AppTextInput editable={!busy} label={t('water.amount')} keyboardType="numeric" value={value} onChangeText={setValue}/></View>
  <View style={styles.row}>{[100,200,250,500].map(ml=><TextButton key={ml} disabled={busy} title={t('water.ml',{value:formatNumber(ml)})} onPress={()=>setValue(String(ml))}/>)}</View>
  <SleepDateTimeField label={t('water.drinkingTime')} date={day} time={time} disabled={busy} activeMode={mode} onActiveModeChange={setMode} onChange={(nextDate,nextTime)=>{if(!lock.current){setDay(nextDate);setTime(nextTime??'');}}}/>
  <Text style={styles.text}>{t('water.saveDate',{date:formatDate(day)})}</Text>
  <Text style={styles.text}>{t('water.amountHint')}</Text>
  {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
  <PrimaryButton title={t(busy?'water.saving':'water.save')} loading={busy} onPress={save}/><TextButton title={t('common.cancel')} disabled={busy} onPress={close}/>
 </ScrollView></KeyboardAvoidingView></Modal>;
}
const baseStyles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.background},content:{paddingHorizontal:20,gap:16,maxWidth:640,width:'100%',alignSelf:'center'},title:{color:Colors.textPrimary,fontSize:22,fontWeight:'700'},text:{color:Colors.textSecondary},error:{color:Colors.error},row:{flexDirection:'row',flexWrap:'wrap',gap:4}});

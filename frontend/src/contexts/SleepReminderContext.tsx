import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { getMySleepSchedule } from '../services/sleepScheduleService';
import { reconcileSleepReminders, setReminderOwner } from '../services/sleepNotifications';
import { subscribeSleepChanges } from '../lib/healthQueryEvents';
import { Colors } from '../constants/colors';
const ReminderContext=createContext('off');
export const useSleepReminderStatus=()=>useContext(ReminderContext);
export function SleepReminderProvider({children}:{children:React.ReactNode}) {
 const {user,isLoading}=useAuth();const {t,i18n}=useTranslation();const [status,setStatus]=useState('off');
 const owner=user?.id??null;
 useEffect(()=>{
  if(isLoading) return;
  let alive=true;let generation=0;
  setReminderOwner(owner);
  const refresh=async()=>{
   const request=++generation;
   try {
    // Clear prior-account reminders even if loading the new account fails.
    await reconcileSleepReminders(owner,undefined,'','');
    const schedule=owner?await getMySleepSchedule():null;
    if(!alive||request!==generation)return;
    const result=await reconcileSleepReminders(owner,schedule,t('schedule.notificationTitle'),t('schedule.notificationBody'));
    if(alive&&request===generation)setStatus(result);
   } catch {if(alive)setStatus('error');}
  };
  void refresh();
  const unsubscribe=subscribeSleepChanges((changed,kind)=>{if(changed===owner&&kind==='schedule')void refresh();});
  const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return ()=>{alive=false;generation++;setReminderOwner(null);unsubscribe();subscription.remove();void reconcileSleepReminders(null,null,'','').catch(()=>{});};
 },[owner,isLoading,i18n.resolvedLanguage,t]);
 return <ReminderContext.Provider value={status}>{children}{status==='error'&&<View style={{padding:8,backgroundColor:Colors.background}}><Text accessibilityRole="alert" style={{color:Colors.error}}>{t('schedule.notificationError')}</Text></View>}</ReminderContext.Provider>;
}

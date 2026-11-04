import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { reminderTriggers } from '../lib/sleepSchedule';
import type { SleepScheduleRow } from '../types/database';
import { getNotificationPreferences } from './notificationPreferencesService';
export type ReminderStatus = 'ready' | 'off' | 'unsupported' | 'denied';

const tag='healthycheck-sleep';
let owner: string | null=null;
let queue: Promise<unknown>=Promise.resolve();
export function setReminderOwner(value: string | null) { owner=value; }
export async function requestSleepPermission() {
 if(Platform.OS==='web') return false;
 if(Platform.OS==='android') await Notifications.setNotificationChannelAsync(tag,{name:tag,importance:AndroidImportance.DEFAULT});
 const existing=await Notifications.getPermissionsAsync();
 if(existing.granted) return true;
 return (await Notifications.requestPermissionsAsync()).granted;
}
// The OS queue persists identifiers on this device. Each request is tagged by account,
// schedule and configuration, so process restarts need no second identifier store.
export function reconcileSleepReminders(account: string | null,schedule: SleepScheduleRow | null | undefined,title: string,body: string): Promise<ReminderStatus> {
 const task=async (): Promise<ReminderStatus>=>{
  if(Platform.OS==='web') return 'unsupported';
  const existing=(await Notifications.getAllScheduledNotificationsAsync()).filter(n=>n.content.data?.kind===tag);
  const cancel=async()=>{for(const n of existing) await Notifications.cancelScheduledNotificationAsync(n.identifier);};
  if(account!==owner) return 'off';
  if(schedule===undefined) {for(const n of existing) if(n.content.data?.owner!==account) await Notifications.cancelScheduledNotificationAsync(n.identifier);return 'off';}
  if(!account || !schedule?.reminder_enabled || !(await getNotificationPreferences(account)).notificationsEnabled) {await cancel();return 'off';}
  const permission=await Notifications.getPermissionsAsync();
  if(!permission.granted) {await cancel();return 'denied';}
  const triggers=reminderTriggers(schedule);
  const signature=JSON.stringify([account,schedule.id,triggers,title,body,Intl.DateTimeFormat().resolvedOptions().timeZone]);
  if(existing.length===triggers.length && existing.every(n=>n.content.data?.signature===signature)) return 'ready';
  await cancel();
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync(tag,{name:title,importance:AndroidImportance.DEFAULT});
  const added:string[]=[];
  try {
   for(const trigger of triggers) {
    if(owner!==account) throw new Error('Account changed');
    added.push(await Notifications.scheduleNotificationAsync({content:{title,body,data:{kind:tag,owner:account,scheduleId:schedule.id,signature}},trigger:{type:Notifications.SchedulableTriggerInputTypes.WEEKLY,...trigger,channelId:tag}}));
   }
   if(owner!==account) throw new Error('Account changed');
   return 'ready';
  } catch(error) {for(const id of added) await Notifications.cancelScheduledNotificationAsync(id);throw error;}
 };
 const pending=queue.then(task,task);queue=pending.catch(()=>{});return pending;
}

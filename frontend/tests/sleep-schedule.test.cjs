const {test}=require('node:test');const assert=require('node:assert/strict');const createLoader=require('./load-ts.cjs');
const input={bedtime:'00:10',wake_time:'08:10',active_days:[1,7],reminder_enabled:true,reminder_minutes_before:30};
const utils=createLoader()('src/lib/sleepSchedule');
test('schedule validation rejects invalid days, times, reminders and owner spoofing',()=>{
 assert.equal(utils.plannedDuration(input),480);
 for(const patch of [{active_days:[]},{active_days:[0]},{active_days:[1,1]},{bedtime:'25:00'},{wake_time:'00:10'},{reminder_minutes_before:20},{user_id:'spoof'}])assert.throws(()=>utils.validateSchedule({...input,...patch}));
 assert.deepEqual(Array.from(utils.validateSchedule(input).active_days),[1,7]);
});
test('weekly notification weekdays wrap to prior Sunday and Saturday before midnight',()=>{
 const triggers=utils.reminderTriggers(input);assert.equal(triggers[0].weekday,1);assert.equal(triggers[1].weekday,7);assert.equal(triggers[0].hour,23);assert.equal(triggers[0].minute,40);
});
test('actual after-midnight bedtime matches the preceding active planned night',()=>{
 const schedule={...input,bedtime:'23:00',wake_time:'07:00',active_days:[1]};
 const result=utils.compareSchedule({sleep_start:new Date(2026,9,27,0,10).toISOString(),sleep_end:new Date(2026,9,27,7,15).toISOString()},schedule);
 assert.equal(result.bedtime,70);assert.equal(result.wake,15);assert.equal(result.planned,480);
 assert.equal(utils.compareSchedule({sleep_start:new Date(2026,9,28,23).toISOString(),sleep_end:new Date(2026,9,29,7).toISOString()},schedule),null);
});
function notifications(platform='ios') {
 let scheduled=[],cancelled=[],next=0,granted=true,fail=false,requested=0;
 const mock={AndroidImportance:{DEFAULT:3},SchedulableTriggerInputTypes:{WEEKLY:'weekly'},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({granted}),requestPermissionsAsync:async()=>{requested++;return {granted};},getAllScheduledNotificationsAsync:async()=>scheduled,cancelScheduledNotificationAsync:async id=>{cancelled.push(id);scheduled=scheduled.filter(n=>n.identifier!==id);},scheduleNotificationAsync:async request=>{if(fail===true||(fail==='partial'&&next>=1))throw Error('Failed');const identifier=String(++next);scheduled.push({...request,identifier});return identifier;}};
 const api=createLoader({'react-native':{Platform:{OS:platform}},'expo-notifications':mock})('src/services/sleepNotifications');
 return {api,setGranted:v=>{granted=v;},setFail:v=>{fail=v;},get scheduled(){return scheduled;},get cancelled(){return cancelled;},get requested(){return requested;}};
}
test('notifications are idempotent across reloads and replaced/cancelled on edit, disable and logout',async()=>{
 const f=notifications(),schedule={...input,id:'s',user_id:'a'};f.api.setReminderOwner('a');
 assert.equal(await f.api.reconcileSleepReminders('a',schedule,'Title','Body'),'ready');assert.equal(f.scheduled.length,2);
 await f.api.reconcileSleepReminders('a',schedule,'Title','Body');assert.equal(f.cancelled.length,0);
 await f.api.reconcileSleepReminders('a',{...schedule,bedtime:'23:10'},'Title','Body');assert.equal(f.cancelled.length,2);assert.equal(f.scheduled.length,2);
 await f.api.reconcileSleepReminders('a',{...schedule,reminder_enabled:false},'Title','Body');assert.equal(f.scheduled.length,0);
 await f.api.reconcileSleepReminders('a',schedule,'Title','Body');f.api.setReminderOwner(null);await f.api.reconcileSleepReminders(null,null,'','');assert.equal(f.scheduled.length,0);
});
test('permission denial, Web unsupported and API failure never claim reminders are ready',async()=>{
 const f=notifications();f.api.setReminderOwner('a');f.setGranted(false);assert.equal(await f.api.requestSleepPermission(),false);assert.equal(f.requested,1);assert.equal(await f.api.reconcileSleepReminders('a',{...input,id:'s'},'T','B'),'denied');assert.equal(f.scheduled.length,0);
 const web=notifications('web');assert.equal(await web.api.requestSleepPermission(),false);assert.equal(await web.api.reconcileSleepReminders(null,null,'',''),'unsupported');
 f.setGranted(true);f.setFail(true);await assert.rejects(f.api.reconcileSleepReminders('a',{...input,id:'s'},'T','B'));assert.equal(f.scheduled.length,0);
});

test('partially scheduled reminders roll back and a different account cannot retain previous reminders',async()=>{
 const f=notifications();f.api.setReminderOwner('a');f.setFail('partial');
 await assert.rejects(f.api.reconcileSleepReminders('a',{...input,id:'s'},'T','B'));assert.equal(f.scheduled.length,0);assert.equal(f.cancelled.length,1);
 f.setFail(false);await f.api.reconcileSleepReminders('a',{...input,id:'s'},'T','B');
 f.api.setReminderOwner('b');await f.api.reconcileSleepReminders('b',undefined,'','');assert.equal(f.scheduled.length,0);
 assert.equal(await f.api.reconcileSleepReminders('a',{...input,id:'s'},'T','B'),'off');assert.equal(f.scheduled.length,0);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const createLoader=require('./load-ts.cjs'),{boundary,A,B}=require('./recommendation-fixture.cjs');
const dates=createLoader()('src/lib/dateUtils'),today=dates.toLocalDateKey();
const settings={user_id:A,last_period_start:null,cycle_length:28,period_length:5,reminder_enabled:true,reminder_days_before:2};
const rows=[{id:'p',user_id:A,start_date:dates.shiftDay(today,-20),end_date:dates.shiftDay(today,-15)}];
function scheduler(platform='android'){
 let scheduled=[],calls=0,granted=true,enabled=true,current=true;
 const native={AndroidImportance:{DEFAULT:3},SchedulableTriggerInputTypes:{DATE:'date'},getAllScheduledNotificationsAsync:async()=>scheduled,getPermissionsAsync:async()=>({granted}),setNotificationChannelAsync:async()=>{},cancelScheduledNotificationAsync:async id=>{scheduled=scheduled.filter(item=>item.identifier!==id);},scheduleNotificationAsync:async item=>{const identifier='r'+(++calls);scheduled.push({...item,identifier});return identifier;}};
 const load=createLoader({'react-native':{Platform:{OS:platform}},'expo-notifications':native,[boundary('services/healthNotifications.ts')]:{notificationChannelId:'test'},[boundary('services/notificationPreferencesService.ts')]:{getNotificationPreferences:async()=>({notificationsEnabled:enabled})}});
 return {api:load('src/services/menstrualCycleNotifications'),get scheduled(){return scheduled;},get calls(){return calls;},deny(){granted=false;},disable(){enabled=false;},isCurrent:()=>current,expire(){current=false;}};
}
test('Android and iOS use the same actual-history estimate, deduplicate, replace changed dates and clear old owners/off/denied',async()=>{
 for(const platform of ['android','ios']){
  const f=scheduler(platform),sync=(owner=A,config=settings,periods=rows)=>f.api.reconcileMenstrualCycleReminder(owner,config,'Title',date=>'Expected '+date,periods);
  assert.equal(await sync(),'ready');assert.equal(f.scheduled[0].content.data.expectedPeriodStart,dates.shiftDay(today,8));assert.equal(f.scheduled.length,1);
  await sync();assert.equal(f.calls,1);
  await sync(A,{...settings,cycle_length:29});assert.equal(f.calls,2);assert.equal(f.scheduled.length,1);
  await sync(B,{...settings,user_id:B});assert.equal(f.scheduled[0].content.data.owner,B);
  await sync(B,{...settings,reminder_enabled:false});assert.equal(f.scheduled.length,0);
  await sync();f.deny();assert.equal(await sync(),'denied');assert.equal(f.scheduled.length,0);
 }
});
test('open period, no anchor, late estimate, master off, stale account work and Web never schedule a false reminder',async()=>{
 const f=scheduler();
 const sync=(config,periods)=>f.api.reconcileMenstrualCycleReminder(A,config,'title',date=>date,periods,f.isCurrent);
 assert.equal(await sync(settings,[]),'off');
 assert.equal(await sync(settings,[{...rows[0],end_date:null}]),'off');
 assert.equal(await sync(settings,[{...rows[0],start_date:dates.shiftDay(today,-60)}]),'off');
 f.disable();assert.equal(await sync(settings,rows),'off');assert.equal(f.calls,0);
 const stale=scheduler();stale.expire();assert.equal(await stale.api.reconcileMenstrualCycleReminder(A,settings,'t',date=>date,rows,stale.isCurrent),'off');assert.equal(stale.calls,0);
 const web=scheduler('web');assert.equal(await web.api.reconcileMenstrualCycleReminder(A,settings,'t',date=>date,rows),'unsupported');assert.equal(web.calls,0);
});

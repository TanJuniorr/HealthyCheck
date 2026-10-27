/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const createLoader = require('./load-ts.cjs');
const load = createLoader();
const sleep = load('src/lib/sleepValidation');
const calc = load('src/lib/healthCalculations');
const dates = load('src/lib/dateUtils');
const A='11111111-1111-4111-8111-111111111111';

test('explicit local dates give eight hours overnight; reversed/same timestamps and future completion fail',()=>{
 const start=sleep.sleepLocalTimestamp('2020-10-27','23:00'),end=sleep.sleepLocalTimestamp('2020-10-28','07:00');
 assert.equal(sleep.validateCompletedSleep(start,end),480);
 assert.equal(dates.timestampDateKey(end),'2020-10-28');
 assert.throws(()=>sleep.validateCompletedSleep(end,start),e=>e.message==='sleep.invalidOrder');
 assert.throws(()=>sleep.validateCompletedSleep(start,start),e=>e.message==='sleep.invalidOrder');
 assert.throws(()=>sleep.validateCompletedSleep(start,end,Date.parse(end)-1),e=>e.message==='sleep.futureTimes');
 for(const [date,time] of [['',''],['2020-02-30','07:00'],['2020-10-27','24:00'],['2020-10-27','07:60'],['2020-10-27','bad']]) assert.throws(()=>sleep.sleepLocalTimestamp(date,time));
 assert.equal(sleep.unusualSleepDuration(30),true); assert.equal(sleep.unusualSleepDuration(480),false); assert.equal(sleep.unusualSleepDuration(1100),true);
});

test('local sleep dates survive UTC conversion and DST gaps are rejected rather than silently shifted',()=>{
 const script=`const load=require('./tests/load-ts.cjs')();const s=load('src/lib/sleepValidation');const d=load('src/lib/dateUtils');let gap=false;try{s.sleepLocalTimestamp('2026-03-08','02:30');}catch{gap=true;}const start=s.sleepLocalTimestamp('2020-10-27','23:00'),end=s.sleepLocalTimestamp('2020-10-28','07:00');console.log(JSON.stringify({start,end,day:d.timestampDateKey(end),minutes:s.validateCompletedSleep(start,end),gap}));`;
 const run=tz=>JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:tz},encoding:'utf8'}));
 const vn=run('Asia/Ho_Chi_Minh');assert.equal(vn.start,'2020-10-27T16:00:00.000Z');assert.equal(vn.end,'2020-10-28T00:00:00.000Z');assert.equal(vn.day,'2020-10-28');assert.equal(vn.minutes,480);
 const ny=run('America/New_York');assert.equal(ny.day,'2020-10-28');assert.equal(ny.minutes,480);assert.equal(ny.gap,true);
});

test('weekly and monthly sleep averages sum distinct daily sessions and exclude missing days and duplicates',()=>{
 const row=(id,day,hours)=>({id,user_id:A,sleep_start:new Date(2020,9,day,0).toISOString(),sleep_end:new Date(2020,9,day,hours).toISOString(),quality_rating:null});
 const first=row('a',27,8),nap={...row('b',27,10),sleep_start:new Date(2020,9,27,9).toISOString()},third=row('c',29,7);
 const rows=[first,nap,third,{...first,id:'duplicate'},first];
 const weekly=calc.aggregateSleep(rows,'2020-10-26','2020-11-01'),monthly=calc.aggregateSleep(rows,'2020-10-01','2020-10-31');
 assert.equal(weekly.totalMinutes,960);assert.equal(weekly.averageDailyMinutes,480);assert.equal(monthly.averageDailyMinutes,480);
 assert.equal(weekly.daily.find(d=>d.date==='2020-10-27').minutes,540);
 assert.equal(weekly.daily.find(d=>d.date==='2020-10-28').minutes,null);
 assert.equal(weekly.daily.filter(d=>d.sessionCount>0).length,2);
 assert.equal(calc.aggregateSleep([],'2020-10-01','2020-10-31').averageDailyMinutes,null);
});

// Small hook driver for exercising rendered event handlers with the project's Node test runner.
// Native controls are boundaries; business logic, translations and async handlers are real.
function uiFixture(extra={}) {
 const slots=[];let cursor=0;const effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...require('react'),
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}}
 };
 const loader=createLoader({react:hooks,'react-native':{View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',Modal:'Modal',KeyboardAvoidingView:'KeyboardAvoidingView',ScrollView:'ScrollView',Platform:{OS:'web',select:()=>undefined},StyleSheet:{create:x=>x}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
  'react-i18next':{...require('react-i18next'),useTranslation:()=>({t:(...args)=>loader('src/i18n/index').default.t(...args)})},
  [path.resolve(__dirname,'../src/services/sleepService.ts')]:{addSleepRecord:async()=>{},updateSleepRecord:async()=>{}},
  [path.resolve(__dirname,'../src/components/health/SleepDateTimeField.tsx')]:{SleepDateTimeField:'SleepDateTimeField'},
  [path.resolve(__dirname,'../src/components/common/Buttons.tsx')]:{PrimaryButton:'PrimaryButton',TextButton:'TextButton'},
  ...extra});
 return {load:loader,render(fn){cursor=0;const result=fn();while(effects.length)effects.shift()();return result;},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}
function elements(tree) {
 if(!tree||typeof tree!=='object')return [];
 return [tree,...(Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children]).flat(Infinity).flatMap(elements)];
}
const record={id:A,user_id:A,sleep_start:new Date(2020,9,27,23).toISOString(),sleep_end:new Date(2020,9,28,7).toISOString(),quality_rating:4,notes:'Original note'};

test('Sleep form keeps entered values and validation feedback across Vietnamese/English changes',async()=>{
 const f=uiFixture(),i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Form=f.load('src/components/health/SleepRecordForm').SleepRecordForm,props={record,onClose(){},onSaved(){}};
 let tree=f.render(()=>Form(props));elements(tree).find(e=>e.type==='TextInput').props.onChangeText('Keep this note');
 let fields=elements(tree).filter(e=>e.type==='SleepDateTimeField');fields[1].props.onChange('2020-10-27','07:00');
 tree=f.render(()=>Form(props));await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();
 tree=f.render(()=>Form(props));assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&/after bedtime/.test(e.props.children)));
 await i18n.changeLanguage('vi');tree=f.render(()=>Form(props));
 assert.equal(elements(tree).find(e=>e.type==='TextInput').props.value,'Keep this note');
 fields=elements(tree).filter(e=>e.type==='SleepDateTimeField');assert.equal(fields[0].props.time,'23:00');assert.equal(fields[1].props.date,'2020-10-27');
 assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&/Thức dậy/.test(e.props.children)));
});

test('failed form save retains entries and never closes/reports success; retry succeeds only after confirmation',async()=>{
 let calls=0,saved=0,closed=0,release;
 const f=uiFixture({[path.resolve(__dirname,'../src/services/sleepService.ts')]:{updateSleepRecord:async()=>{calls++;if(calls===1)throw Error('Network unavailable');await new Promise(resolve=>{release=resolve;});}}});
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Form=f.load('src/components/health/SleepRecordForm').SleepRecordForm,props={record,onClose(){closed++;},onSaved(){saved++;}};
 let tree=f.render(()=>Form(props));elements(tree).find(e=>e.type==='TextInput').props.onChangeText('Retain after failure');
 tree=f.render(()=>Form(props));await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();
 tree=f.render(()=>Form(props));assert.equal(saved,0);assert.equal(closed,0);assert.equal(elements(tree).find(e=>e.type==='TextInput').props.value,'Retain after failure');
 assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&/connect/.test(e.props.children)));
 const submit=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=submit();await submit();
 assert.equal(calls,2);tree=f.render(()=>Form(props));assert.equal(elements(tree).find(e=>e.type==='PrimaryButton').props.loading,true);
 assert.equal(saved,0);release();await request;assert.equal(saved,1);
});

test('focused Dashboard query reloads after sleep invalidation, ignores other users and unsubscribes on blur',async()=>{
 let loads=0,owner=A;const focus=[];
 const events=createLoader()('src/lib/healthQueryEvents');
 const q=uiFixture({
  'expo-router':{useFocusEffect:callback=>{if(focus.at(-1)!==callback)focus.push(callback);}},
  [path.resolve(__dirname,'../src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},
  [path.resolve(__dirname,'../src/services/queryCore.ts')]:{assertIdentity:async()=>{}},
  [path.resolve(__dirname,'../src/lib/healthQueryEvents.ts')]:events
 });
 const hook=q.load('src/hooks/useHealthQuery').useHealthQuery;
 let value=1;const loader=async()=>{loads++;return value;};
 q.render(()=>hook(loader,'weekly-overview:2020-10-26'));
 const blur=focus.at(-1)();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(loads,1);value=2;events.notifySleepChanged('other-user');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);
 events.notifySleepChanged(A);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(q.render(()=>hook(loader,'weekly-overview:2020-10-26')).data,2);assert.equal(loads,2);
 blur();events.notifySleepChanged(A);await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,2);
 owner='other-user';assert.equal(q.render(()=>hook(loader,'weekly-overview:2020-10-26')).data,null);
});

test('Sleep deletion requires confirmation and keeps the record visible when the database rejects it',async()=>{
 let calls=0;
 const row={...record,sleep_start:new Date(Date.now()-8*3600000).toISOString(),sleep_end:new Date().toISOString()};
 const f=uiFixture({
  '@expo/vector-icons':{Ionicons:'Ionicons'},'expo-router':{useRouter:()=>({push(){}})},
  [path.resolve(__dirname,'../src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},
  [path.resolve(__dirname,'../src/hooks/healthHooks.ts')]:{useSleepRecords:()=>({data:[row],isLoading:false,error:null,refresh:async()=>{}}),useHealthGoals:()=>({data:null,isLoading:false,error:null,refresh:async()=>{}})},
  [path.resolve(__dirname,'../src/components/common/AppHeader.tsx')]:{AppHeader:'AppHeader'},
  [path.resolve(__dirname,'../src/components/common/ScreenContainer.tsx')]:{ScreenContainer:'ScreenContainer'},
  [path.resolve(__dirname,'../src/components/charts/WeeklyBarChart.tsx')]:{WeeklyBarChart:'WeeklyBarChart'},
  [path.resolve(__dirname,'../src/services/sleepService.ts')]:{deleteSleepRecord:async()=>{calls++;if(calls===1)throw Error('Network unavailable');}}
 });
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Screen=f.load('app/health/sleep').default,render=()=>f.render(()=>Screen().type());
 let tree=render();elements(tree).find(e=>e.type==='TextButton'&&e.props.title==='Delete sleep record').props.onPress();
 tree=render();assert.equal(calls,0);assert.equal(elements(tree).find(e=>e.type==='Modal').props.visible,true);
 await elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title==='Delete sleep record').props.onPress();
 tree=render();assert.equal(calls,1);assert.equal(elements(tree).find(e=>e.type==='Modal').props.visible,true);
 assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&/connect/.test(e.props.children)));
 assert.ok(elements(tree).some(e=>e.props?.children==='Original note'));
 await elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title==='Delete sleep record').props.onPress();
 tree=render();assert.equal(calls,2);assert.equal(elements(tree).find(e=>e.type==='Modal').props.visible,false);
 assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&e.props.children==='Sleep record deleted.'));
});

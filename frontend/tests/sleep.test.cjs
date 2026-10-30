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

const {uiFixture,elements}=require('./ui-fixture.cjs');
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

test('single duration chart switches week/month and distinguishes missing records',async()=>{
 const f=uiFixture({},true),i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Analysis=f.load('src/components/health/SleepAnalysis').SleepAnalysis;
 const row=(id,month,day,hours)=>({...record,id,sleep_start:new Date(2020,month,day,0).toISOString(),sleep_end:new Date(2020,month,day,hours).toISOString()});
 const props={date:'2020-10-27',period:'week',onPeriodChange:value=>{props.period=value;},onMove:offset=>{props.date=dates.shiftDay(props.date,offset*7);},rows:[row('a',9,5,6),row('b',9,27,8),row('c',10,1,7)]};
 const render=()=>f.render(()=>Analysis(props));
 const bars=tree=>elements(tree).filter(e=>e.props?.accessibilityLabel?.includes(': ')&&!e.props.accessibilityLabel.includes(i18n.t('common.noRecords'))).map(e=>e.props.accessibilityLabel);
 let tree=render();assert.equal(bars(tree).length,2);assert.ok(bars(tree).some(label=>label.includes('November 1')));
 elements(tree).find(e=>e.type==='TouchableOpacity'&&elements(e).some(child=>child.props?.children==='Month')).props.onPress();
 tree=render();assert.equal(bars(tree).length,2);assert.ok(bars(tree).some(label=>label.includes('October 5')));assert.ok(bars(tree).every(label=>!label.includes('November')));
 const text=elements(tree).filter(e=>e.type==='Text').map(e=>e.props.children).join(' ');assert.doesNotMatch(text,/Planned and actual|deviation/);
 await i18n.changeLanguage('vi');tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='Biểu đồ và xu hướng giấc ngủ'));
 props.rows=[];tree=render();assert.equal(bars(tree).length,0);assert.ok(elements(tree).some(e=>e.props?.children===i18n.t('common.noRecords')));
});

test('calendar navigates months and years, highlights selection and blocks future dates',async()=>{
 const f=uiFixture(),i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Calendar=f.load('src/components/common/CalendarDatePicker').CalendarDatePicker;
 let selected=null;const props={visible:true,date:'2020-10-27',title:'Calendar',maxDate:'2020-10-27',markedDates:['2020-10-27'],onClose(){},onSelect:value=>{selected=value;}};
 const render=()=>f.render(()=>Calendar(props));let tree=render();
 const day=elements(tree).find(e=>e.props?.accessibilityLabel==='October 27, 2020');assert.equal(day.props.accessibilityState.selected,true);day.props.onPress();assert.equal(selected,'2020-10-27');
 const future=elements(tree).find(e=>e.props?.accessibilityLabel==='October 28, 2020');assert.equal(future.props.disabled,true);future.props.onPress();assert.equal(selected,'2020-10-27');
 elements(tree).find(e=>e.props?.accessibilityLabel==='Next month').props.onPress();tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='November 2020'));
 elements(tree).find(e=>e.props?.accessibilityLabel==='Previous year').props.onPress();tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='November 2019'));
 elements(tree).find(e=>e.props?.accessibilityLabel==='Next year').props.onPress();tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='November 2020'));
 props.maxDate=dates.toLocalDateKey();tree=render();elements(tree).find(e=>e.type==='TouchableOpacity'&&elements(e).some(child=>child.props?.children==='Today')).props.onPress();assert.equal(selected,dates.toLocalDateKey());
});

test('sleep screen has one chart, no latest-session card, and calendar/day selection stays independent of chart periods',async()=>{
 let captured;const today=dates.toLocalDateKey(),yesterday=dates.shiftDay(today,-1);
 const current={...record,sleep_start:new Date(Date.now()-8*3600000).toISOString(),sleep_end:new Date().toISOString()};
 const f=uiFixture({
  [path.resolve(__dirname,'../src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},
  [path.resolve(__dirname,'../src/hooks/healthHooks.ts')]:{useSleepRecords:(range,date)=>{captured={range,date};return {data:[current],isLoading:false,error:null,refresh:async()=>{}};},useHealthGoals:()=>({data:null,isLoading:false,error:null,refresh:async()=>{}})},
  [path.resolve(__dirname,'../src/components/common/AppHeader.tsx')]:{AppHeader:'AppHeader'},
  [path.resolve(__dirname,'../src/components/common/ScreenContainer.tsx')]:{ScreenContainer:'ScreenContainer'},
 });
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Screen=f.load('app/health/sleep').default,render=()=>f.render(()=>Screen().type());let tree=render();
 assert.equal(elements(tree).filter(e=>e.type==='SleepAnalysis').length,1);assert.ok(!elements(tree).some(e=>e.props?.children===i18n.t('sleep.latest')));
 assert.equal(elements(tree).filter(e=>e.type==='SleepScheduleCard').length,1);
 elements(tree).find(e=>e.props?.accessibilityLabel==='Previous day').props.onPress();tree=render();assert.equal(captured.date,yesterday);
 elements(tree).find(e=>e.props?.accessibilityLabel==='Next day').props.onPress();tree=render();assert.equal(captured.date,today);
 elements(tree).find(e=>e.props?.accessibilityLabel===i18n.t('sleep.openCalendar')).props.onPress();tree=render();
 const calendar=elements(tree).find(e=>e.type?.name==='CalendarDatePicker');assert.ok(calendar);calendar.props.onSelect('2020-10-27');tree=render();assert.equal(captured.date,'2020-10-27');assert.ok(!elements(tree).some(e=>e.type?.name==='CalendarDatePicker'));
 const chart=elements(tree).find(e=>e.type==='SleepAnalysis');assert.equal(chart.props.period,'week');chart.props.onMove(-1);tree=render();assert.equal(captured.date,'2020-10-27');assert.equal(elements(tree).find(e=>e.type==='SleepAnalysis').props.date,'2020-10-20');
 elements(tree).find(e=>e.type==='SleepAnalysis').props.onPeriodChange('month');tree=render();assert.equal(captured.date,'2020-10-27');assert.equal(captured.range.start,'2020-10-01');
});

const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {execFileSync}=require('node:child_process');const load=require('./load-ts.cjs')();
const water=load('src/lib/waterValidation');
test('water amount validation accepts only whole ml within the per-entry limit',()=>{
 assert.equal(water.waterAmount('250'),250);assert.equal(water.waterAmount(' 100 '),100);
 for(const value of ['', '1.5','2e3','NaN','abc','0',-1,5001])assert.throws(()=>water.waterAmount(value));
 assert.throws(()=>water.waterTimestamp('2020-02-30','07:30'));assert.throws(()=>water.waterTimestamp('2020-10-30','24:00'));assert.throws(()=>water.waterTimestamp('2999-01-01','07:00'));
});
test('local midnight entries belong to separate days after UTC conversion',()=>{
 const script=`const load=require('./tests/load-ts.cjs')();const w=load('src/lib/waterValidation'),d=load('src/lib/dateUtils'),c=load('src/lib/healthCalculations');const a=w.waterTimestamp('2020-10-30','23:59'),b=w.waterTimestamp('2020-10-31','00:05');const result=c.aggregateWater([{recorded_at:a,amount_ml:250},{recorded_at:b,amount_ml:400}],'2020-10-30','2020-10-31');console.log(JSON.stringify({a,b,key:d.timestampDateKey(b),daily:result.daily}));`;
 const result=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:'Asia/Ho_Chi_Minh'},encoding:'utf8'}));
 assert.equal(result.b,'2020-10-30T17:05:00.000Z');assert.equal(result.key,'2020-10-31');assert.equal(result.daily[0].totalMl,250);assert.equal(result.daily[1].totalMl,400);
});
const {uiFixture,elements}=require('./ui-fixture.cjs');
test('water form keeps its selected day and entered values after a failed save; double-taps do not resubmit',async()=>{
 let calls=0,saved=0,release;
 const f=uiFixture({
  [path.resolve(__dirname,'../src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'},
  [path.resolve(__dirname,'../src/services/waterService.ts')]:{addWaterRecord:async payload=>{assert.equal(payload.amount_ml,300);calls++;if(calls===1)throw Error('Network unavailable');await new Promise(resolve=>{release=resolve;});}}
 });
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const Form=f.load('src/components/health/WaterRecordForm').WaterRecordForm,props={record:null,date:'2020-10-30',onClose(){},onSaved(){saved++;}};
 const render=()=>f.render(()=>Form(props));let tree=render();assert.equal(elements(tree).find(e=>e.type==='SleepDateTimeField').props.date,'2020-10-30');
 elements(tree).find(e=>e.type==='AppTextInput').props.onChangeText('300');tree=render();await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();
 tree=render();assert.equal(saved,0);assert.equal(elements(tree).find(e=>e.type==='AppTextInput').props.value,'300');assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'&&/connect/.test(e.props.children)));
 await i18n.changeLanguage('vi');tree=render();assert.equal(elements(tree).find(e=>e.type==='AppTextInput').props.value,'300');
 const submit=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=submit();await submit();assert.equal(calls,2);assert.equal(saved,0);release();await request;assert.equal(saved,1);
});
test('water screen shows an empty history, changes days with the calendar and caps only the progress bar',async()=>{
 let rows=[],captured;
 const today=load('src/lib/dateUtils').toLocalDateKey(),stamp=new Date().toISOString();
 const f=uiFixture({
  [path.resolve(__dirname,'../src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:'account'}})},
  [path.resolve(__dirname,'../src/hooks/healthHooks.ts')]:{useWaterTracking:range=>{captured=range;return {data:{rows,goals:[{id:'goal',effective_from:'2000-01-01',created_at:'2000-01-01T00:00:00Z',daily_water_ml:2000}]},isLoading:false,error:null,refresh:async()=>{}};}},
  [path.resolve(__dirname,'../src/components/common/AppHeader.tsx')]:{AppHeader:'AppHeader'},
  [path.resolve(__dirname,'../src/components/common/ScreenContainer.tsx')]:{ScreenContainer:'ScreenContainer'},
  [path.resolve(__dirname,'../src/components/charts/WeeklyBarChart.tsx')]:{WeeklyBarChart:'WeeklyBarChart'},
  [path.resolve(__dirname,'../src/components/health/WaterRecordForm.tsx')]:{WaterRecordForm:'WaterRecordForm'},
  [path.resolve(__dirname,'../src/services/waterService.ts')]:{deleteWaterRecord:async()=>{}}
 });
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');const Screen=f.load('app/health/water').default;
 const render=()=>f.render(()=>Screen().type());let tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='No water intake recorded for this day.'));
 rows=[{id:'r',amount_ml:2500,recorded_at:stamp}];tree=render();assert.ok(elements(tree).some(e=>e.props?.children==='2,500 ml'));assert.equal(elements(tree).find(e=>e.props?.accessibilityRole==='progressbar').props.accessibilityValue.now,100);assert.ok(elements(tree).some(e=>typeof e.props?.children==='string'&&e.props.children.includes('125%')));
 elements(tree).find(e=>e.type==='AppHeader').props.onRightPress();tree=render();const calendar=elements(tree).find(e=>e.type?.name==='CalendarDatePicker');calendar.props.onSelect('2020-10-30');tree=render();assert.equal(captured.start,'2020-10-26');assert.ok(elements(tree).some(e=>e.props?.children==='No water intake recorded for this day.'));
 elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title===i18n.t('water.custom')).props.onPress();tree=render();assert.equal(elements(tree).find(e=>e.type==='WaterRecordForm').props.date,'2020-10-30');assert.ok(today>'2020-10-30');
});

test('focused Dashboard and water queries refresh on water mutations and ignore other accounts',async()=>{
 const focus=[];let loads=0,value=250;
 const f=uiFixture({
  'expo-router':{useFocusEffect:callback=>{if(focus.at(-1)!==callback)focus.push(callback);}},
  [path.resolve(__dirname,'../src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:'account'}})},
  [path.resolve(__dirname,'../src/services/queryCore.ts')]:{assertIdentity:async()=>{}}
 });
 const useQuery=f.load('src/hooks/useHealthQuery').useHealthQuery,events=f.load('src/lib/healthQueryEvents');
 const loader=async()=>{loads++;return value;};f.render(()=>useQuery(loader,'weekly-overview:2020-10-26'));
 const blur=focus.at(-1)();await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);
 events.notifyWaterChanged('other');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);
 value=500;events.notifyWaterChanged('account');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.render(()=>useQuery(loader,'weekly-overview:2020-10-26')).data,500);assert.equal(loads,2);
 blur();events.notifyWaterChanged('account');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,2);
 assert.ok(events.dependsOnWater('water-records:2020'));assert.ok(events.dependsOnWater('water:2020'));assert.ok(events.dependsOnWater('overview:2020'));assert.equal(events.dependsOnWater('sleep-records:2020'),false);
 const definition=load('src/data/health').dailyHighlights.find(item=>item.id==='water');assert.equal(definition.route,'/health/water');
});

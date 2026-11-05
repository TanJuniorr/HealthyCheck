const {test}=require('node:test'), assert=require('node:assert/strict');
const {fixture,table,A,B}=require('./recommendation-fixture.cjs');
const id='33333333-3333-4333-8333-333333333333';
const input={id,start_date:'2026-01-01',end_date:null,notes:'note'};
const row={...input,user_id:A,recorded_timezone:'UTC',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'};
test('period CRUD is owner scoped, validates dates, binds account and uses a stable request id with conflict-aware retry',async()=>{
 let saved=null;
 const f=fixture(request=>{
  assert.equal(table(request),'menstrual_cycle_periods');
  if(request.method==='POST'){assert.equal(request.body.user_id,A);assert.equal(request.body.id,id);assert.match(request.headers.get('Prefer'),/ignore-duplicates/);if(saved)return{data:[]};saved={...row,...request.body};return{data:[saved]};}
  assert.equal(request.url.searchParams.get('user_id'),'eq.'+A);
  if(request.method==='GET')return{data:saved?[saved]:[]};
  if(request.method==='PATCH'){assert.equal(request.url.searchParams.get('updated_at'),'eq.'+row.updated_at);saved={...saved,...request.body};return{data:[saved]};}
  if(request.method==='DELETE'){saved=null;return{data:[{id}]};}
  throw Error('Unexpected request');
 });
 const service=f.load('src/services/menstrualCycleService');
 await assert.rejects(service.saveMyMenstrualCyclePeriod({...input,end_date:'2025-12-31'},A),e=>e.message==='cycle.invalidPeriodDates');
 await assert.rejects(service.saveMyMenstrualCyclePeriod({...input,start_date:'2999-01-01'},A));assert.equal(f.calls.length,0);
 await assert.rejects(service.saveMyMenstrualCyclePeriod(input,B),e=>e.code==='AUTH_CHANGED');assert.equal(f.calls.length,0);
 let events=0;service.subscribeCycleSettingsChanges(owner=>{assert.equal(owner,A);events++;});
 const created=await service.saveMyMenstrualCyclePeriod(input,A);assert.equal(created.end_date,null);
 const retry=await service.saveMyMenstrualCyclePeriod(input,A);assert.equal(retry.id,created.id);
 const ended=await service.saveMyMenstrualCyclePeriod({...input,end_date:'2026-01-05'},A,created.updated_at);assert.equal(ended.end_date,'2026-01-05');
 await service.deleteMyMenstrualCyclePeriod(ended,A);assert.equal(events,4);
 assert.ok(f.calls.every(request=>table(request)==='menstrual_cycle_periods'));
});
test('overlap, stale edits and session changes fail without fallback writes',async()=>{
 const f=fixture(()=>({status:409,data:{code:'23P01',message:'private detail'}}));const service=f.load('src/services/menstrualCycleService');
 await assert.rejects(service.saveMyMenstrualCyclePeriod(input,A),e=>e.message==='cycle.periodConflict');
 const empty=fixture(()=>({data:[]}));await assert.rejects(empty.load('src/services/menstrualCycleService').saveMyMenstrualCyclePeriod(input,A,row.updated_at),e=>e.message==='cycle.stalePeriod');
 let release;const switched=fixture(()=>new Promise(resolve=>{release=resolve;}));const request=switched.load('src/services/menstrualCycleService').saveMyMenstrualCyclePeriod(input,A);
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));switched.setOwner(B);release({data:[row]});await assert.rejects(request,e=>e.code==='AUTH_CHANGED');
});
test('history is paginated and month queries include overlapping open periods; daily logs never create periods',async()=>{
 const f=fixture(request=>({data:table(request)==='menstrual_cycle_settings'?[]:table(request)==='menstrual_cycle_logs'&&request.method==='POST'?[{...request.body,id}]:[],total:0}));
 const service=f.load('src/services/menstrualCycleService');
 await service.getMyMenstrualCyclePeriods({page:2,pageSize:10});assert.equal(f.calls[0].url.searchParams.get('offset'),'10');
 await service.getMyMenstrualCycleCalendar('2026-01-01','2026-01-31');
 const overlap=f.calls.find(request=>request.url.searchParams.has('or'));assert.match(overlap.url.searchParams.get('or'),/end_date.is.null,end_date.gte.2026-01-01/);
 const before=f.calls.length;
 await service.saveMyMenstrualCycleLog({log_date:'2026-01-01',flow_status:'spotting',mood:'happy',symptoms:['cramps']},A);
 await service.saveMyMenstrualCycleLog({log_date:'2026-01-01',flow_status:null,mood:'tired',symptoms:[]},A);
 assert.ok(f.calls.slice(before).every(request=>table(request)==='menstrual_cycle_logs'));
});

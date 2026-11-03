const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,boundary,dates,A,B}=require('./recommendation-fixture.cjs');
const old={id:'33333333-3333-4333-8333-333333333333',user_id:A,daily_steps:8000,daily_calories:2000,daily_water_ml:2000,target_sleep_minutes:480,effective_from:'2020-01-01',created_at:'2020-01-01T00:00:00Z'};
const preview={calories:{status:'success',recommendedCalories:1850.4},steps:{status:'success',recommendedSteps:7000},water:{status:'success',recommendedWaterMl:2250,limitations:{canApplyDirectlyToWaterOnlyGoal:false}}};
const context=()=>({ownerId:A,expectedGoal:old,date:dates.toLocalDateKey()});
const mocks={
 [boundary('services/calorieRecommendationService.ts')]:{getMyCalorieRecommendation:async()=>preview.calories},
 [boundary('services/stepRecommendationService.ts')]:{getMyStepRecommendation:async()=>preview.steps},
};
const row=request=>({...old,id:B,...request.body.p_changes,effective_from:request.body.p_local_date,created_at:new Date().toISOString()});
const service=f=>f.load('src/services/healthGoalSnapshotService');
test('calorie, step and combined applications send one confirmed snapshot RPC and preserve unspecified fields',async()=>{
 for(const [selected,expected] of [[['calories'],{daily_calories:1850}],[['steps'],{daily_steps:7000}],[['calories','steps'],{daily_calories:1850,daily_steps:7000}]]){
  const f=fixture(request=>({data:[row(request)]}),mocks);let events=0;
  f.load('src/lib/healthQueryEvents').subscribeHealthChanges((owner,kind)=>{assert.equal(owner,A);assert.equal(kind,'goals');events++;});
  const result=await service(f).applyHealthGoalRecommendation(context(),selected,preview);
  assert.equal(f.calls.length,1);const request=f.calls[0];assert.equal(request.method,'POST');assert.ok(request.url.pathname.endsWith('/rpc/save_health_goal_snapshot'));
  assert.deepEqual(request.body.p_changes,expected);assert.equal(request.body.p_expected_owner,A);assert.equal(request.body.p_expected_id,old.id);
  assert.deepEqual(request.body.p_expected_values,{daily_steps:8000,daily_calories:2000,daily_water_ml:2000,target_sleep_minutes:480});
  assert.equal(request.body.p_local_date,dates.toLocalDateKey());assert.ok(request.body.p_time_zone);assert.equal(result.daily_water_ml,2000);assert.equal(result.target_sleep_minutes,480);assert.equal(events,1);
 }
});
test('manual overrides are saved explicitly without reading or adopting an algorithm value',async()=>{
 let calculations=0;const overrides={...mocks,[boundary('services/calorieRecommendationService.ts')]:{getMyCalorieRecommendation:async()=>{calculations++;return preview.calories;}}};
 const f=fixture(request=>({data:[row(request)]}),overrides);const result=await service(f).saveManualHealthGoals(context(),{daily_calories:2200});
 assert.equal(result.daily_calories,2200);assert.equal(calculations,0);assert.equal(f.calls.length,1);
});
test('incompatible water, unsafe statuses, absent current goals and changed previews do not dispatch a write',async()=>{
 const f=fixture(()=>{throw Error('Unexpected write');},mocks);
 await assert.rejects(service(f).applyHealthGoalRecommendation(context(),['water'],preview));
 for(const status of ['missing_data','needs_review','out_of_scope','query_error'])await assert.rejects(service(f).applyHealthGoalRecommendation(context(),['calories'],{...preview,calories:{status,candidateCalories:1850,recommendedCalories:1850}}));
 await assert.rejects(service(f).applyHealthGoalRecommendation({...context(),expectedGoal:null},['calories'],preview),e=>e.message==='goals.completeFirst');
 await assert.rejects(service(f).saveManualHealthGoals({...context(),expectedGoal:null},{daily_calories:2200}),e=>e.message==='goals.completeFirst');assert.equal(f.calls.length,0);
 const changed=fixture(()=>{throw Error('Unexpected write');},{...mocks,[boundary('services/calorieRecommendationService.ts')]:{getMyCalorieRecommendation:async()=>({status:'success',recommendedCalories:1900})}});
 await assert.rejects(service(changed).applyHealthGoalRecommendation(context(),['calories'],preview),e=>e.message==='goals.recommendationChanged');assert.equal(changed.calls.length,0);
});
test('initial goals require all four explicit values and never rely on database defaults',async()=>{
 const f=fixture(request=>({data:[row(request)]}),mocks),values={daily_steps:6000,daily_calories:2200,daily_water_ml:1700,target_sleep_minutes:420};
 await service(f).saveManualHealthGoals({...context(),expectedGoal:null},values);assert.deepEqual(f.calls[0].body.p_changes,values);assert.equal(f.calls[0].body.p_expected_values,null);
});
test('double-clicks are locked, failed saves do not notify success, and network failures can retry',async()=>{
 let release,started;const ready=new Promise(resolve=>{started=resolve;});
 const f=fixture(async request=>{started();await new Promise(resolve=>{release=resolve;});return {data:[row(request)]};},mocks);
 const first=service(f).saveManualHealthGoals(context(),{daily_steps:7000});await ready;
 await assert.rejects(service(f).saveManualHealthGoals(context(),{daily_steps:7000}),e=>e.message==='goals.busy');assert.equal(f.calls.length,1);release();await first;
 let offline=true,events=0;const g=fixture(request=>offline?{status:400,data:{message:'Network unavailable'}}:{data:[row(request)]},mocks);
 g.load('src/lib/healthQueryEvents').subscribeHealthChanges(()=>events++);
 await assert.rejects(service(g).saveManualHealthGoals(context(),{daily_steps:7000}),e=>e.code==='NETWORK');assert.equal(events,0);
 offline=false;await service(g).saveManualHealthGoals(context(),{daily_steps:7000});assert.equal(events,1);
});
test('server conflicts and unconfirmed responses remain errors without success events',async()=>{
 for(const response of [{status:409,data:{code:'40001',message:'goals.conflict'}},{data:[]},{data:[{...old,user_id:B,daily_calories:1850}]}]){
  const f=fixture(()=>response,mocks);let events=0;f.load('src/lib/healthQueryEvents').subscribeHealthChanges(()=>events++);
  await assert.rejects(service(f).saveManualHealthGoals(context(),{daily_calories:1850}));assert.equal(events,0);
 }
});
test('owner/date changes and stale account responses are rejected; expected owner is bound inside the RPC',async()=>{
 const f=fixture(()=>{throw Error('Unexpected write');},mocks);f.setOwner(B);
 await assert.rejects(service(f).saveManualHealthGoals(context(),{daily_steps:7000}),e=>e.code==='AUTH_CHANGED');assert.equal(f.calls.length,0);
 f.setOwner(A);await assert.rejects(service(f).saveManualHealthGoals({...context(),date:'2020-01-01'},{daily_steps:7000}),e=>e.message==='goals.dayChanged');assert.equal(f.calls.length,0);
 const switched=fixture(request=>{assert.equal(request.body.p_expected_owner,A);switched.setOwner(B);return {data:[row(request)]};},mocks);
 let events=0;switched.load('src/lib/healthQueryEvents').subscribeHealthChanges(()=>events++);
 await assert.rejects(service(switched).saveManualHealthGoals(context(),{daily_steps:7000}),e=>e.code==='AUTH_CHANGED');assert.equal(events,0);
});
test('profile and weight edits from an old account cannot start a write for the new authenticated owner',async()=>{
 const f=fixture(()=>{throw Error('Unexpected write');});f.setOwner(B);
 await assert.rejects(f.load('src/services/profileService').updateMyProfile({activity_level:'very_active'},A),e=>e.code==='AUTH_CHANGED');
 await assert.rejects(f.load('src/services/profileService').ensureMyProfile(A),e=>e.code==='AUTH_CHANGED');
 await assert.rejects(f.load('src/services/weightService').addWeightRecord({weight_kg:65},A),e=>e.code==='AUTH_CHANGED');
 assert.equal(f.calls.length,0);
});

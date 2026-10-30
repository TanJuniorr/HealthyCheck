/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('./load-ts.cjs');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
function fixture(handler) {
 let owner=A; const calls=[];
 const client=createClient('https://unit-test.invalid','sb_publishable_test',{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },global:{ fetch:async (input,init) => {
  const request={ url:new URL(String(input)),method:init.method,headers:new Headers(init.headers),body:init.body ? JSON.parse(init.body) : null }; calls.push(request);
  const answer=await handler(request,calls.length);
  const status=answer.status ?? 200; let body=answer.data ?? [];
  if (request.headers.get('Accept')?.includes('vnd.pgrst.object') && Array.isArray(body)) body=body[0] ?? null;
  return new Response(status===204 ? null : JSON.stringify(body),{ status,headers:{ 'Content-Type':'application/json','Content-Range':`0-${Math.max(0,(Array.isArray(body)?body.length:1)-1)}/${answer.total ?? (Array.isArray(body)?body.length:1)}` } });
 } } });
 client.auth.getUser=async () => ({ data:{ user:owner ? { id:owner,user_metadata:{ full_name:'Lan' } } : null },error:null });
 client.auth.getSession=async () => ({ data:{ session:owner ? { user:{ id:owner },access_token:'unit-test-only' } : null },error:null });
 const load=createLoader({ [path.resolve(__dirname,'../src/lib/supabase.ts')]:{ supabase:client } });
 return { load,calls,setOwner(value){owner=value;} };
}
test('owner-scoped read, filtered dates and deterministic history pagination use real SDK request syntax',async () => {
 const f=fixture(() => ({ data:[],total:0 }));
 const page=await f.load('src/services/stepsService').getStepsHistory({ startDate:'2026-10-26',endDate:'2026-11-01',page:2,pageSize:20 });
 assert.equal(page.data.length,0); const params=f.calls[0].url.searchParams;
 assert.equal(params.get('user_id'),'eq.'+A); assert.equal(params.get('record_date'),'gte.2026-10-26');
 assert.ok(params.getAll('record_date').includes('lte.2026-11-01')); assert.equal(params.get('offset'),'20'); assert.equal(params.get('limit'),'20');
 assert.match(params.get('order'),/record_date.desc/); assert.match(params.get('order'),/id.desc/);
});
test('all personal CRUD injects owner and update/delete always filter target plus owner',async () => {
 const specs=[['healthGoalsService','createGoals','updateGoals','deleteGoals',{ daily_steps:8000 }],['stepsService','addStepRecord','updateStepRecord','deleteStepRecord',{ record_date:'2026-10-27',steps:10 }],['waterService','addWaterRecord','updateWaterRecord','deleteWaterRecord',{ amount_ml:250 }],['weightService','addWeightRecord','updateWeightRecord','deleteWeightRecord',{ weight_kg:68 }]];
 for (const [module,add,update,remove,payload] of specs) {
  const f=fixture(request => ({ data:[{ id:B,user_id:A,...payload }] })); const service=f.load('src/services/'+module);
  await service[add](payload); await service[update](B,payload); await service[remove](B);
  assert.equal(f.calls[0].body.user_id,A);
  for (const request of f.calls.slice(1)) { assert.equal(request.url.searchParams.get('id'),'eq.'+B); assert.equal(request.url.searchParams.get('user_id'),'eq.'+A); }
 }
});
test('missing authentication and invalid payloads perform no database request',async () => {
 const f=fixture(() => {throw new Error('Unexpected request');}); const service=f.load('src/services/stepsService');
 f.setOwner(null); await assert.rejects(service.getStepsByDate('2026-10-27'),error => error.code==='UNAUTHENTICATED');
 await assert.rejects(service.addStepRecord({ record_date:'2026-10-27',steps:-1 }),error => error.code==='INVALID_INPUT');
 assert.equal(f.calls.length,0);
});
test('database errors stay errors; missing and invalid write targets fail safely',async () => {
 const f=fixture(() => ({ status:403,data:{ code:'42501',message:'private SQL detail' } }));
 await assert.rejects(f.load('src/services/waterService').getWaterHistory(),error => error.code==='PERMISSION_DENIED' && !error.message.includes('private SQL'));
 const empty=fixture(() => ({ data:[] })); const service=empty.load('src/services/weightService');
 await assert.rejects(service.updateWeightRecord(B,{ weight_kg:60 }),error => error.code==='NOT_FOUND');
 await assert.rejects(service.deleteWeightRecord('bad-id'),error => error.code==='INVALID_INPUT');
});
test('complete ranges continue when server returns fewer rows than requested',async () => {
 const rows=[0,1,2].map((_,i) => ({ id:String(i),record_date:'2026-10-27',steps:1,user_id:A }));
 const f=fixture(request => {const offset=Number(request.url.searchParams.get('offset'));return { data:rows.slice(offset,offset+1),total:rows.length };});
 const result=await f.load('src/services/stepsService').getStepsByDateRange('2026-10-27','2026-10-27');
 assert.equal(result.length,3); assert.equal(f.calls.length,3);
});
test('data returned after user change is rejected instead of crossing account boundaries',async () => {
 let release; let started;
 const ready=new Promise(resolve => {started=resolve;});
 const f=fixture(async () => {started();return await new Promise(resolve => {release=resolve;});});
 const request=f.load('src/services/stepsService').getStepsByDate('2026-10-27');
 await ready; f.setOwner(B); release({ data:[{ id:A,user_id:A,record_date:'2026-10-27',steps:42 }],total:1 });
 await assert.rejects(request,error => error.code==='AUTH_CHANGED');
});
test('current goals exclude future dates and order effective date then created_at',async () => {
 const f=fixture(() => ({ data:[{ id:B,user_id:A,effective_from:'2026-10-20',daily_steps:8000 }] }));
 const result=await f.load('src/services/healthGoalsService').getCurrentGoals('2026-10-27');
 assert.equal(result.daily_steps,8000); const params=f.calls[0].url.searchParams;
 assert.equal(params.get('effective_from'),'lte.2026-10-27'); assert.match(params.get('order'),/^effective_from.desc,created_at.desc/); assert.equal(params.get('limit'),'1');
});
test('meal insert validates all items, verifies food IDs once and submits an atomic bulk request',async () => {
 const f=fixture(request => request.url.pathname.endsWith('/foods') ? { data:[{ id:A },{ id:B }] } : { data:request.body.map((row,i) => ({ ...row,id:i===0?A:B,food:{id:row.food_id} })) });
 const rows=await f.load('src/services/mealsService').addMealItems([{ food_id:A,meal_type:'lunch',quantity_g:100 },{ food_id:B,meal_type:'lunch',quantity_g:75 }]);
 assert.equal(rows.length,2); assert.equal(f.calls.filter(request => request.method==='POST').length,1);
 const write=f.calls.find(request => request.method==='POST'); assert.equal(write.body.length,2); assert.ok(write.body.every(row => row.user_id===A)); assert.match(write.url.searchParams.get('select'),/food:foods/);
 const invalid=fixture(() => ({ data:[] }));
 await assert.rejects(invalid.load('src/services/mealsService').addMealItems([{ food_id:A,meal_type:'snack',quantity_g:1 }]),error => error.code==='NOT_FOUND');
 assert.equal(invalid.calls.some(request => request.method==='POST'),false);
});
test('failed bulk meals never report success',async () => {
 const f=fixture(request => request.url.pathname.endsWith('/foods') ? { data:[{ id:A }] } : { status:400,data:{code:'23503'} });
 await assert.rejects(f.load('src/services/mealsService').addMealItems([{ food_id:A,meal_type:'dinner',quantity_g:100 }]),error => error.code==='CONSTRAINT');
});
test('sleep partial updates validate against existing endpoints and use optimistic timestamp filters',async () => {
 const current={ id:B,user_id:A,sleep_start:'2026-10-26T22:00:00Z',sleep_end:'2026-10-27T06:00:00Z' };
 const f=fixture(request => ({data:request.url.searchParams.get('select') === 'id' ? [] : [{...current,...(request.body ?? {})}]}));
 const service=f.load('src/services/sleepService');
 await assert.rejects(service.updateSleepRecord(B,{sleep_end:'2026-10-26T21:00:00Z'}),error => error.code==='INVALID_INPUT');
 assert.equal(f.calls.some(request => request.method==='PATCH'),false);
 await service.updateSleepRecord(B,{notes:'Rested'});
 const write=f.calls.find(request => request.method==='PATCH'); assert.equal(write.body.notes,'Rested');
 assert.equal(write.url.searchParams.get('user_id'),'eq.'+A); assert.equal(write.url.searchParams.get('sleep_end'),'eq.'+current.sleep_end);
});
test('profile ensure preserves existing rows and safely handles concurrent trigger creation',async () => {
 let reads=0;
 const f=fixture(request => {if(request.method==='GET') return {data:++reads===1?[]:[{ id:A,full_name:'Existing',height_cm:170 }]};return { status:201,data:null };});
 const row=await f.load('src/services/profileService').ensureMyProfile();
 assert.equal(row.full_name,'Existing');
 const write=f.calls.find(request => request.method==='POST'); assert.equal(write.body.id,A); assert.match(write.headers.get('Prefer'),/resolution=ignore-duplicates/); assert.equal(write.body.height_cm,undefined);
 const existing=fixture(() => ({ data:[{id:A,full_name:'Existing'}] })); await existing.load('src/services/profileService').ensureMyProfile();
 assert.equal(existing.calls.length,1);
});

test('daily dashboard uses bounded queries and agrees with individual metric calculations',async () => {
 const stamp=new Date(2026,9,27,12).toISOString();
 const food={ id:A,name:'Rice',calories_per_100g:130,protein_per_100g:2.7,carbs_per_100g:28,fat_per_100g:0.3 };
 const records={ profiles:[{id:A,height_cm:'172'}],health_goals:[{id:B,user_id:A,daily_steps:8000,daily_calories:2000,daily_water_ml:2000,target_sleep_minutes:480,effective_from:'2026-10-01',created_at:stamp}],step_records:[{id:A,user_id:A,record_date:'2026-10-27',steps:250,distance_km:null,active_minutes:null},{id:B,user_id:A,record_date:'2026-10-27',steps:100,distance_km:null,active_minutes:null}],sleep_records:[{id:B,user_id:A,sleep_start:new Date(Date.parse(stamp)-8*3600000).toISOString(),sleep_end:stamp,quality_rating:4}],meal_records:[{id:B,user_id:A,food_id:A,food,meal_type:'lunch',quantity_g:150,consumed_at:stamp}],water_records:[{id:B,user_id:A,recorded_at:stamp,amount_ml:250}],weight_records:[{id:B,user_id:A,weight_kg:68,recorded_at:stamp}] };
 const f=fixture(request => { const table=request.url.pathname.split('/').at(-1); return {data:records[table],total:records[table].length}; });
 const result=await f.load('src/services/dashboardService').getDashboardSummary('2026-10-27');
 assert.equal(result.steps.total,350); assert.equal(result.sleep.minutes,480); assert.equal(result.nutrition.calories,195); assert.equal(result.water.totalMl,250); assert.ok(Math.abs(result.weight.bmi-22.9853975)<1e-6);
 assert.equal(f.calls.length,7);
 for (const request of f.calls) {
  const table=request.url.pathname.split('/').at(-1);
  if (!['profiles','health_goals'].includes(table)) assert.ok([...request.url.searchParams.keys()].some(key=>['record_date','sleep_end','consumed_at','recorded_at'].includes(key)));
 }
});
test('weekly dashboard makes range queries once per table and applies goal history by day',async () => {
 const earlier={id:A,user_id:A,effective_from:'2026-10-01',created_at:'2026-10-01T00:00:00Z',daily_steps:8000};
 const later={id:B,user_id:A,effective_from:'2026-10-29',created_at:'2026-10-20T00:00:00Z',daily_steps:9000};
 const f=fixture(request => {
  const table=request.url.pathname.split('/').at(-1);
  if(table==='health_goals') { const changing=request.url.searchParams.getAll('effective_from').some(value=>value.startsWith('gte.'));return {data:changing?[later]:[earlier]}; }
  return {data:[]};
 });
 const result=await f.load('src/services/dashboardService').getWeeklyDashboardSummary('2026-10-27');
 assert.equal(result.length,7); assert.equal(result[0].steps.goal,8000); assert.equal(result[3].steps.goal,9000);
 assert.equal(result[0].sleep.minutes,null); assert.equal(result[0].weight.bmi,null); assert.equal(f.calls.length,9);
});
test('food search never sends user text as database patterns and reuses the shared read-only catalogue',async () => {
 const f=fixture(() => ({data:[],total:0}));
 const service=f.load('src/services/foodsService');
 await service.searchFoods('rice_%',{category:'Grains'}); await service.getFoodById(A); await service.getFoodCategories();
 assert.equal(f.calls[0].url.searchParams.get('category'),null);
 assert.equal(f.calls[0].url.searchParams.get('name'),null);
 assert.equal(f.calls.length,2); // catalogue once, plus the explicit historical by-ID lookup
 assert.ok(f.calls.every(request=>request.method==='GET'));
});

test('service and screen use the same ranked search across catalogue pages, excluding retired choices only from selection',async()=>{
 const base={calories_per_100g:155,protein_per_100g:12.58,carbs_per_100g:1.12,fat_per_100g:10.61,serving_size:'cá hồi',catalog_metadata:null};
 const rows=[{...base,id:B,name:'Canh cá hồi',category:'prepared'},
  {...base,id:'00000000-0000-4000-8000-000000000001',name:'Cá hồi',category:'meat'},
  {...base,id:'00000000-0000-4000-8000-000000000002',name:'Cá thu',category:'meat'},
  {...base,id:'00000000-0000-4000-8000-000000000003',name:'Bắp cải sống',category:'vegetables'},
  {...base,id:A,name:'Trứng gà luộc',category:'Protein',protein_per_100g:12.6,catalog_metadata:{selectable:false}}];
 const f=fixture(request=>{
  const id=request.url.searchParams.get('id');if(id)return {data:rows.filter(row=>'eq.'+row.id===id)};
  const offset=Number(request.url.searchParams.get('offset'));return {data:rows.slice(offset,offset+2),total:rows.length};
 }),service=f.load('src/services/foodsService'),shared=f.load('src/lib/foodPortions');
 const catalogue=await service.readFoodCatalogue();assert.equal(catalogue.length,4);assert.equal(f.calls.length,3);
 for(const search of ['cá','ca hoi','cá hồi','CÁ HỒI']){
  const result=await service.searchFoods(search,{pageSize:200});assert.deepEqual(result.data.map(row=>row.id),shared.filterFoods(catalogue,search,null).map(row=>row.id));
 }
 assert.equal(f.calls.length,3);
 const page=await service.searchFoods('cá',{category:'meat',pageSize:1,page:2});assert.equal(page.data[0].name,'Cá thu');assert.equal(page.total,2);assert.equal(page.hasMore,false);
 assert.equal((await service.searchFoods('cá',{category:'vegetables'})).data.length,0);
 assert.equal((await service.getFoodById(A)).protein_per_100g,12.6);
 assert.ok(f.calls.every(request=>request.method==='GET'&&!request.url.searchParams.has('name')));
});

test('profile updates allow only verified editable fields and retain unspecified values',async () => {
 const f=fixture(request => ({data:[{id:A,full_name:request.body?.full_name ?? 'Old',height_cm:'170'}]}));
 const service=f.load('src/services/profileService'); const row=await service.updateMyProfile({full_name:' Lan '});
 assert.equal(row.full_name,'Lan'); assert.equal(row.height_cm,170);
 assert.equal(f.calls[0].url.searchParams.get('id'),'eq.'+A); assert.equal(f.calls[0].body.height_cm,undefined); assert.equal(f.calls[0].body.id,undefined);
 for(const key of ['email','gender','id']) await assert.rejects(service.updateMyProfile({[key]:'bad'}),error=>error.code==='INVALID_INPUT');
 assert.equal(f.calls.length,1);
});

test('onboarding service sends one authenticated RPC, rejects owner spoofing and accepts only confirmed completion',async()=>{
 const input={date_of_birth:'1995-05-02',gender:'prefer_not_to_say',height_cm:170.5,weight_kg:65.5};
 const completed={id:A,...input,health_onboarding_completed_at:'2020-10-27T00:00:00Z'};
 const f=fixture(request=>({data:[completed]})),service=f.load('src/services/healthOnboardingService');
 const row=await service.completeHealthOnboarding(input);assert.equal(row.height_cm,170.5);
 assert.equal(f.calls.length,1);assert.ok(f.calls[0].url.pathname.endsWith('/rpc/complete_health_onboarding'));
 assert.deepEqual(f.calls[0].body,{p_date_of_birth:input.date_of_birth,p_gender:input.gender,p_height_cm:170.5,p_weight_kg:65.5});
 await assert.rejects(service.completeHealthOnboarding({...input,user_id:B}),e=>e.code==='INVALID_INPUT');assert.equal(f.calls.length,1);
 for(const response of [[],[{...completed,health_onboarding_completed_at:null}],[{...completed,id:B}]]){
  const g=fixture(()=>({data:response}));await assert.rejects(g.load('src/services/healthOnboardingService').completeHealthOnboarding(input));
 }
 let release,started;const ready=new Promise(resolve=>{started=resolve;});
 const g=fixture(async()=>{started();await new Promise(resolve=>{release=resolve;});return {data:[completed]};}),s=g.load('src/services/healthOnboardingService');
 const request=s.completeHealthOnboarding(input);await ready;await assert.rejects(s.completeHealthOnboarding(input),e=>e.message==='onboarding.busy');release();await request;assert.equal(g.calls.length,1);
 const rejected=fixture(()=>({status:403,data:{code:'42501'}}));await assert.rejects(rejected.load('src/services/healthOnboardingService').completeHealthOnboarding(input),e=>e.code==='PERMISSION_DENIED');
});
test('confirmed onboarding appears in Profile and Dashboard BMI using the real height/weight without creating goals',async()=>{
 let profile=null,weights=[];
 const input={date_of_birth:'1995-05-02',gender:'prefer_not_to_say',height_cm:170.5,weight_kg:65.5};
 const f=fixture(request=>{
  if(request.url.pathname.endsWith('/rpc/complete_health_onboarding')){
   profile={id:A,date_of_birth:input.date_of_birth,gender:input.gender,height_cm:input.height_cm,health_onboarding_completed_at:'2020-10-27T00:00:00Z'};
   weights=[{id:B,user_id:A,weight_kg:input.weight_kg,recorded_at:'2020-10-27T00:00:00Z'}];return {data:[profile]};
  }
  if(request.url.pathname.endsWith('/profiles'))return {data:profile?[profile]:[]};
  if(request.url.pathname.endsWith('/weight_records'))return {data:weights};
  return {data:[]};
 });
 await f.load('src/services/healthOnboardingService').completeHealthOnboarding(input);
 const saved=await f.load('src/services/profileService').getMyProfile();assert.equal(saved.height_cm,170.5);assert.equal(saved.date_of_birth,input.date_of_birth);assert.equal(saved.gender,input.gender);
 const home=await f.load('src/services/dashboardService').getDashboardSummary('2020-10-27');
 assert.equal(home.weight.latestKg,65.5);assert.equal(home.weight.bmi,f.load('src/lib/healthCalculations').calculateBMI(65.5,170.5));
 assert.equal(home.nutrition.calorieGoal,null);assert.equal(home.water.goalMl,null);assert.equal(home.steps.goal,null);
 assert.equal(f.calls.filter(request=>request.method==='POST').length,1);
});
test('meal update and delete scope both ID and owner, and missing by-id is null',async () => {
 const f=fixture(request => ({data:request.method==='GET'?[]:[{id:B,user_id:A,meal_type:'snack',quantity_g:50,food_id:A}]}));
 const service=f.load('src/services/mealsService'); await service.updateMealRecord(B,{quantity_g:50}); await service.deleteMealRecord(B);
 assert.equal(await service.getMealRecordById(B),null);
 for(const request of f.calls) {assert.equal(request.url.searchParams.get('id'),'eq.'+B);assert.equal(request.url.searchParams.get('user_id'),'eq.'+A);}
});
test('sleep add/delete use valid timestamps and owned row filters',async () => {
 const payload={sleep_start:'2026-10-26T22:00:00Z',sleep_end:'2026-10-27T06:00:00Z',quality_rating:4};
 const f=fixture(request => ({data:request.method === 'GET' ? [] : [{id:B,user_id:A,...payload}]})); const service=f.load('src/services/sleepService');
 await service.addSleepRecord(payload); await service.deleteSleepRecord(B);
 const write=f.calls.find(request=>request.method==='POST'), remove=f.calls.find(request=>request.method==='DELETE');
 assert.equal(write.body.user_id,A); assert.equal(remove.url.searchParams.get('id'),'eq.'+B); assert.equal(remove.url.searchParams.get('user_id'),'eq.'+A);
});
test('network errors are classified and missing count metadata is never a fabricated total',async () => {
 const f=fixture(() => ({status:400,data:{message:'Network unavailable'}}));
 await assert.rejects(f.load('src/services/foodsService').getAllFoods(),error=>error.code==='NETWORK');
 const page=await f.load('src/services/queryCore').readPages(async()=>({data:[{id:A}],error:null}),{page:2,pageSize:1});
 assert.equal(page.total,null); assert.equal(page.hasMore,true);
});
const sleepPayload = {sleep_start:'2020-10-26T16:00:00Z',sleep_end:'2020-10-27T00:00:00Z',quality_rating:4,notes:null};

test('sleep rejects future/invalid intervals and owner spoofing before database writes',async()=>{
 const f=fixture(()=>{throw Error('Unexpected request');}),service=f.load('src/services/sleepService');
 const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString();
 await assert.rejects(service.addSleepRecord({sleep_start:start,sleep_end:end}),e=>e.message==='sleep.futureTimes');
 await assert.rejects(service.addSleepRecord({...sleepPayload,sleep_end:sleepPayload.sleep_start}),e=>e.code==='INVALID_INPUT');
 await assert.rejects(service.addSleepRecord({...sleepPayload,user_id:B}),e=>e.code==='INVALID_INPUT');
 f.setOwner(null); await assert.rejects(service.addSleepRecord(sleepPayload),e=>e.code==='UNAUTHENTICATED');
 assert.equal(f.calls.length,0);
});

test('overlapping or duplicate sleep is rejected with an owner-scoped interval query',async()=>{
 const f=fixture(()=>({data:[{id:B}]})),service=f.load('src/services/sleepService');
 await assert.rejects(service.addSleepRecord(sleepPayload),e=>e.message==='sleep.overlap');
 assert.equal(f.calls.length,1);
 const query=f.calls[0].url.searchParams;
 assert.equal(query.get('user_id'),'eq.'+A);
 assert.equal(query.get('sleep_start'),'lt.'+new Date(sleepPayload.sleep_end).toISOString());
 assert.equal(query.get('sleep_end'),'gt.'+new Date(sleepPayload.sleep_start).toISOString());
});

test('successful sleep writes publish invalidation only after confirmed database responses',async()=>{
 const current={...sleepPayload,id:B,user_id:A};
 const f=fixture(request=>({data:request.method==='GET' && request.url.searchParams.get('select')==='id'?[]:[{...current,...request.body}]}));
 const service=f.load('src/services/sleepService'),events=f.load('src/lib/healthQueryEvents'),notifications=[];
 const unsubscribe=events.subscribeSleepChanges(owner=>notifications.push(owner));
 await service.addSleepRecord(sleepPayload); assert.deepEqual(notifications,[A]);
 await service.updateSleepRecord(B,{sleep_end:'2020-10-27T01:00:00Z'}); assert.deepEqual(notifications,[A,A]);
 await service.deleteSleepRecord(B); assert.deepEqual(notifications,[A,A,A]);
 unsubscribe();
 for(const key of ['sleep:2020','sleep-records:2020','overview:2020','weekly-overview:2020']) assert.ok(events.dependsOnSleep(key));
 assert.equal(events.dependsOnSleep('water:2020'),false);
 const update=f.calls.find(r=>r.method==='PATCH');
 assert.equal(update.url.searchParams.get('id'),'eq.'+B);assert.equal(update.url.searchParams.get('user_id'),'eq.'+A);
});

test('failed sleep create, update and delete never notify success or discard request errors',async()=>{
 for(const operation of ['add','update','delete']) {
  const f=fixture(request=>request.method==='GET'?{data:request.url.searchParams.get('select')==='id'?[]:[{...sleepPayload,id:B,user_id:A}]}:{status:403,data:{code:'42501'}});
  let notified=0; f.load('src/lib/healthQueryEvents').subscribeSleepChanges(()=>notified++);
  const service=f.load('src/services/sleepService');
  const action=operation==='add'?()=>service.addSleepRecord(sleepPayload):operation==='update'?()=>service.updateSleepRecord(B,{notes:'Keep me'}):()=>service.deleteSleepRecord(B);
  await assert.rejects(action,e=>e.code==='PERMISSION_DENIED'); assert.equal(notified,0);
 }
 const empty=fixture(()=>({data:[]}));
 await assert.rejects(empty.load('src/services/sleepService').deleteSleepRecord(B),e=>e.code==='NOT_FOUND');
});

test('sleep refuses missing/foreign edit targets and scopes reads and delete to the session owner',async()=>{
 const f=fixture(()=>({data:[]})),service=f.load('src/services/sleepService');
 assert.equal(await service.getSleepRecordById(B),null);
 await assert.rejects(service.updateSleepRecord(B,{notes:'Forbidden'}),e=>e.code==='NOT_FOUND');
 await assert.rejects(service.deleteSleepRecord(B),e=>e.code==='NOT_FOUND');
 assert.ok(f.calls.every(r=>r.url.searchParams.get('user_id')==='eq.'+A));
 assert.equal(f.calls.some(r=>r.method==='PATCH'),false);
});

test('concurrent sleep submissions produce one insert and release the lock after errors',async()=>{
 let release,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const f=fixture(async request=>{
  if(request.method==='GET'){started();await new Promise(resolve=>{release=resolve;});return {data:[]};}
  return {data:[{...request.body,id:B}]};
 });
 const service=f.load('src/services/sleepService');
 const first=service.addSleepRecord(sleepPayload);await ready;
 await assert.rejects(service.addSleepRecord(sleepPayload),e=>e.message==='sleep.busy');
 release();await first;
 assert.equal(f.calls.filter(r=>r.method==='POST').length,1);
});

test('sleep mutations refresh daily and weekly Dashboard values after add, edit and delete',async()=>{
 let rows=[];
 const f=fixture(request=>{
  if(!request.url.pathname.endsWith('/sleep_records')) return {data:[]};
  if(request.method==='POST'){rows=[{...request.body,id:B}];return {data:rows};}
  if(request.method==='PATCH'){rows=[{...rows[0],...request.body}];return {data:rows};}
  if(request.method==='DELETE'){const removed=rows;rows=[];return {data:removed};}
  if(request.url.searchParams.get('select')==='id') return {data:[]};
  return {data:rows,total:rows.length};
 });
 const service=f.load('src/services/sleepService'),dashboard=f.load('src/services/dashboardService');
 const day=f.load('src/lib/dateUtils').timestampDateKey(sleepPayload.sleep_end);
 assert.equal((await dashboard.getDashboardSummary(day)).sleep.minutes,null);
 await service.addSleepRecord(sleepPayload);
 assert.equal((await dashboard.getDashboardSummary(day)).sleep.minutes,480);
 await service.updateSleepRecord(B,{sleep_end:'2020-10-27T01:00:00Z'});
 assert.equal((await dashboard.getDashboardSummary(day)).sleep.minutes,540);
 assert.equal((await dashboard.getWeeklyDashboardSummary(day)).find(d=>d.date===day).sleep.minutes,540);
 await service.deleteSleepRecord(B);
 assert.equal((await dashboard.getDashboardSummary(day)).sleep.minutes,null);
 assert.equal((await dashboard.getWeeklyDashboardSummary(day)).find(d=>d.date===day).sleep.minutes,null);
});

test('sleep rejects unconfirmed INSERT/UPDATE responses and expired or changed ownership before writing',async()=>{
 for(const method of ['POST','PATCH']) {
  const f=fixture(request=>request.method==='GET'?{data:request.url.searchParams.get('select')==='id'?[]:[{...sleepPayload,id:B,user_id:A}]}:{data:[]});
  const service=f.load('src/services/sleepService');let success=false;
  f.load('src/lib/healthQueryEvents').subscribeSleepChanges(()=>{success=true;});
  await assert.rejects(method==='POST'?service.addSleepRecord(sleepPayload):service.updateSleepRecord(B,{notes:'Unconfirmed'}));
  assert.equal(success,false);
 }
 let release,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const f=fixture(async()=>{started();await new Promise(resolve=>{release=resolve;});return {data:[]};});
 const operation=f.load('src/services/sleepService').addSleepRecord(sleepPayload);await ready;
 f.setOwner(B);release();await assert.rejects(operation,e=>e.code==='AUTH_CHANGED');
 assert.equal(f.calls.some(r=>r.method==='POST'),false);
});
const scheduleInput={bedtime:'23:00',wake_time:'07:00',active_days:[1,2,3,4,5],reminder_enabled:true,reminder_minutes_before:15};

test('nutrition CRUD updates all four daily totals and Dashboard, preserves fractional grams and isolates accounts',async()=>{
 const catalogue=require('../../supabase/seeds/nutrition_usda.json').foods;
 const chicken={...catalogue.find(food=>food.catalog_metadata.source_id==='usda-sr:171477'),id:B},oil={...catalogue.find(food=>food.catalog_metadata.source_id==='usda-sr:171413'),id:A};
 let records=[],sequence=0,notifications=0;
 const matches=(row,params)=>[...params].every(([key,filter])=>{
  if(!['id','user_id','consumed_at'].includes(key))return true;
  const dot=filter.indexOf('.'),op=filter.slice(0,dot),value=filter.slice(dot+1),actual=row[key];
  if(op==='eq')return actual===value;if(op==='gte')return actual>=value;if(op==='lt')return actual<value;return true;
 });
 const f=fixture(r=>{
  if(r.url.pathname.endsWith('/foods'))return {data:[{id:A},{id:B}]};
  if(!r.url.pathname.endsWith('/meal_records'))return {data:[]};
  if(r.method==='POST'){const added=r.body.map(row=>({...row,id:`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`}));records.push(...added);return {data:added.map(row=>({...row,food:row.food_id===A?oil:chicken}))};}
  const selected=records.filter(row=>matches(row,r.url.searchParams));
  if(r.method==='PATCH'){selected.forEach(row=>Object.assign(row,r.body));return {data:selected};}
  if(r.method==='DELETE'){records=records.filter(row=>!selected.includes(row));return {data:selected};}
  return {data:selected.map(row=>({...row,food:row.food_id===A?oil:chicken})),total:selected.length};
 });
 const service=f.load('src/services/mealsService'),dashboard=f.load('src/services/dashboardService'),calc=f.load('src/lib/healthCalculations'),events=f.load('src/lib/healthQueryEvents');
 events.subscribeNutritionChanges(owner=>{assert.equal(owner,A);notifications++;});
 const stamp=new Date(2020,9,27,12).toISOString(),nextDay=new Date(2020,9,28,12).toISOString();
 const rows=await service.addMealItems([{food_id:B,quantity_g:150,meal_type:'lunch',consumed_at:stamp},{food_id:A,quantity_g:2.5123456789,meal_type:'lunch',consumed_at:stamp}]);
 assert.equal(records.length,2);assert.equal(records[1].quantity_g,2.5123456789);
 const expected=calc.aggregateNutrition(rows,'2020-10-27','2020-10-27'),summary=await service.getDailyNutrition('2020-10-27'),home=(await dashboard.getDashboardSummary('2020-10-27')).nutrition;
 for(const key of ['calories','protein','carbs','fat']){assert.equal(summary[key],expected[key]);assert.equal(home[key],summary[key]);}
 await service.updateMealRecord(rows[0].id,{quantity_g:100});
 assert.equal((await dashboard.getDashboardSummary('2020-10-27')).nutrition.protein,31.02);
 assert.equal(records.length,2);assert.equal(records[0].consumed_at,stamp);
 await service.updateMealRecord(rows[0].id,{consumed_at:nextDay});
 assert.equal((await service.getDailyNutrition('2020-10-28')).protein,31.02);
 await service.deleteMealRecord(rows[1].id);assert.equal((await dashboard.getDashboardSummary('2020-10-27')).nutrition.calories,0);
 assert.equal((await dashboard.getWeeklyDashboardSummary('2020-10-27')).find(day=>day.date==='2020-10-28').nutrition.calories,165);
 assert.equal(notifications,4);
 f.setOwner(B);assert.equal((await service.getMealsByDate('2020-10-28')).length,0);
 await assert.rejects(service.updateMealRecord(rows[0].id,{quantity_g:200}),e=>e.code==='NOT_FOUND');await assert.rejects(service.deleteMealRecord(rows[0].id),e=>e.code==='NOT_FOUND');assert.equal(notifications,4);
});

test('failed or unconfirmed meal writes do not notify; concurrent adds share an owner lock',async()=>{
 for(const method of ['POST','PATCH','DELETE']){
  const f=fixture(r=>r.method==='GET'?{data:[{id:B}]}:{status:403,data:{code:'42501'}}),service=f.load('src/services/mealsService');let notified=0;
  f.load('src/lib/healthQueryEvents').subscribeNutritionChanges(()=>notified++);
  const payload={food_id:B,quantity_g:150,meal_type:'lunch'};
  await assert.rejects(method==='POST'?service.addMealRecord(payload):method==='PATCH'?service.updateMealRecord(B,{quantity_g:100}):service.deleteMealRecord(B));assert.equal(notified,0);
 }
 let release,started;const ready=new Promise(resolve=>{started=resolve;});
 const f=fixture(async r=>{
  if(r.method==='GET')return {data:[{id:B}]};started();await new Promise(resolve=>{release=resolve;});return {data:r.body.map(row=>({...row,id:A}))};
 }),service=f.load('src/services/mealsService');
 const payload={food_id:B,quantity_g:150,meal_type:'lunch'},first=service.addMealRecord(payload);await ready;
 await assert.rejects(service.addMealRecord(payload),e=>e.message==='meals.busy');release();await first;
 assert.equal(f.calls.filter(r=>r.method==='POST').length,1);
 const empty=fixture(r=>({data:r.method==='GET'?[{id:B}]:[]}));let notified=0;empty.load('src/lib/healthQueryEvents').subscribeNutritionChanges(()=>notified++);
 await assert.rejects(empty.load('src/services/mealsService').addMealRecord(payload));assert.equal(notified,0);
});
test('sleep schedules roundtrip with session ownership and unique-owner upsert',async()=>{
 const f=fixture(r=>({data:[{id:B,user_id:A,...scheduleInput,...r.body}]})),service=f.load('src/services/sleepScheduleService');
 await service.saveSleepSchedule(scheduleInput);assert.equal((await service.getMySleepSchedule()).bedtime,'23:00');await service.updateSleepSchedule({...scheduleInput,bedtime:'22:30'});await service.deleteSleepSchedule();
 assert.equal(f.calls[0].body.user_id,A);assert.equal(f.calls[0].url.searchParams.get('on_conflict'),'user_id');
 assert.ok(f.calls.filter(r=>r.method!=='POST').every(r=>r.url.searchParams.get('user_id')==='eq.'+A));
 await assert.rejects(service.saveSleepSchedule({...scheduleInput,user_id:B}),e=>e.code==='INVALID_INPUT');
});
test('sleep schedule failures and PostgreSQL overlap violations remain localized errors',async()=>{
 const f=fixture(()=>({status:403,data:{code:'42501'}}));await assert.rejects(f.load('src/services/sleepScheduleService').saveSleepSchedule(scheduleInput),e=>e.code==='PERMISSION_DENIED');
 assert.equal(f.load('src/lib/dataErrors').dataError({code:'23P01'}).message,'sleep.overlap');
});

test('water CRUD keeps independent daily totals and Dashboard values, including moves between dates',async()=>{
 let records=[],sequence=0;
 const matches=(row,params)=>[...params].every(([key,filter])=>{
  if(!['id','user_id','recorded_at'].includes(key))return true;
  const dot=filter.indexOf('.'),op=filter.slice(0,dot),value=filter.slice(dot+1),actual=row[key];
  if(op==='eq')return actual===value;if(op==='gte')return actual>=value;if(op==='lt')return actual<value;return true;
 });
 const f=fixture(r=>{
  if(!r.url.pathname.endsWith('/water_records'))return {data:[]};
  if(r.method==='POST'){const row={...r.body,id:`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`};records.push(row);return {data:[row]};}
  const selected=records.filter(row=>matches(row,r.url.searchParams));
  if(r.method==='PATCH'){selected.forEach(row=>Object.assign(row,r.body));return {data:selected};}
  if(r.method==='DELETE'){records=records.filter(row=>!selected.includes(row));return {data:selected};}
  return {data:selected,total:selected.length};
 });
 const service=f.load('src/services/waterService'),dashboard=f.load('src/services/dashboardService');
 const stamp=(day,hour)=>new Date(2020,9,day,hour).toISOString();
 let notifications=0;f.load('src/lib/healthQueryEvents').subscribeWaterChanges(owner=>{assert.equal(owner,A);notifications++;});
 const first=await service.addWaterRecord({amount_ml:250,recorded_at:stamp(27,7)});
 assert.equal((await service.getDailyWaterTotal('2020-10-27')).totalMl,250);
 const second=await service.addWaterRecord({amount_ml:200,recorded_at:stamp(27,9)});
 await service.addWaterRecord({amount_ml:500,recorded_at:stamp(27,12)});await service.addWaterRecord({amount_ml:250,recorded_at:stamp(27,15)});
 await service.addWaterRecord({amount_ml:600,recorded_at:stamp(28,12)});
 assert.equal((await service.getDailyWaterTotal('2020-10-27')).totalMl,1200);assert.equal((await service.getDailyWaterTotal('2020-10-28')).totalMl,600);
 await service.updateWaterRecord(first.id,{amount_ml:300});assert.equal((await dashboard.getDashboardSummary('2020-10-27')).water.totalMl,1250);
 await service.updateWaterRecord(first.id,{recorded_at:stamp(28,8)});
 assert.equal((await service.getDailyWaterTotal('2020-10-27')).totalMl,950);assert.equal((await service.getDailyWaterTotal('2020-10-28')).totalMl,900);
 await service.deleteWaterRecord(second.id);assert.equal((await dashboard.getDashboardSummary('2020-10-27')).water.totalMl,750);
 const weekly=await dashboard.getWeeklyDashboardSummary('2020-10-27');assert.equal(weekly.find(d=>d.date==='2020-10-28').water.totalMl,900);
 assert.equal(notifications,8);
 assert.ok(f.calls.filter(r=>r.url.pathname.endsWith('/water_records')&&r.method!=='POST').every(r=>r.url.searchParams.get('user_id')==='eq.'+A));
 f.setOwner(B);assert.equal((await service.getWaterRecordsByDate('2020-10-27')).length,0);await assert.rejects(service.updateWaterRecord(first.id,{amount_ml:100}),e=>e.code==='NOT_FOUND');await assert.rejects(service.deleteWaterRecord(first.id),e=>e.code==='NOT_FOUND');
});

test('water rejects invalid quantities, spoofed owners, future timestamps and failed writes without invalidation',async()=>{
 const f=fixture(()=>({status:403,data:{code:'42501'}})),service=f.load('src/services/waterService');let changed=0;f.load('src/lib/healthQueryEvents').subscribeWaterChanges(()=>changed++);
 for(const amount_ml of [0,-1,1.5,5001,NaN,Infinity])await assert.rejects(service.addWaterRecord({amount_ml}),e=>e.code==='INVALID_INPUT');
 await assert.rejects(service.addWaterRecord({amount_ml:250,user_id:B}),e=>e.code==='INVALID_INPUT');
 await assert.rejects(service.addWaterRecord({amount_ml:250,recorded_at:new Date(Date.now()+3600000).toISOString()}),e=>e.message==='water.futureTime');
 assert.equal(f.calls.length,0);
 await assert.rejects(service.addWaterRecord({amount_ml:250}),e=>e.code==='PERMISSION_DENIED');
 await assert.rejects(service.updateWaterRecord(B,{amount_ml:200}),e=>e.code==='PERMISSION_DENIED');
 await assert.rejects(service.deleteWaterRecord(B),e=>e.code==='PERMISSION_DENIED');assert.equal(changed,0);
});

test('concurrent water saves issue a single INSERT and release their lock after completion',async()=>{
 let release,started;const ready=new Promise(resolve=>{started=resolve;});
 const f=fixture(async r=>{started();await new Promise(resolve=>{release=resolve;});return {data:[{...r.body,id:B}]};});const service=f.load('src/services/waterService');
 const first=service.addWaterRecord({amount_ml:250});await ready;await assert.rejects(service.addWaterRecord({amount_ml:250}),e=>e.message==='water.busy');release();await first;assert.equal(f.calls.length,1);
});

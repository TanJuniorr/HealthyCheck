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
 const f=fixture(request => ({data:[{...current,...(request.body ?? {})}]}));
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
test('food filters escape pattern characters and never write the shared catalogue',async () => {
 const f=fixture(() => ({data:[],total:0}));
 const service=f.load('src/services/foodsService');
 await service.searchFoods('rice_%',{category:'Grains'}); await service.getFoodById(A); await service.getFoodCategories();
 assert.equal(f.calls[0].url.searchParams.get('category'),'eq.Grains');
 assert.equal(f.calls[0].url.searchParams.get('name'),'ilike.%rice\\_\\%%');
 assert.ok(f.calls.every(request=>request.method==='GET'));
});

test('profile updates allow only verified editable fields and retain unspecified values',async () => {
 const f=fixture(request => ({data:[{id:A,full_name:request.body?.full_name ?? 'Old',height_cm:'170'}]}));
 const service=f.load('src/services/profileService'); const row=await service.updateMyProfile({full_name:' Lan '});
 assert.equal(row.full_name,'Lan'); assert.equal(row.height_cm,170);
 assert.equal(f.calls[0].url.searchParams.get('id'),'eq.'+A); assert.equal(f.calls[0].body.height_cm,undefined); assert.equal(f.calls[0].body.id,undefined);
 for(const key of ['email','gender','id']) await assert.rejects(service.updateMyProfile({[key]:'bad'}),error=>error.code==='INVALID_INPUT');
 assert.equal(f.calls.length,1);
});
test('meal update and delete scope both ID and owner, and missing by-id is null',async () => {
 const f=fixture(request => ({data:request.method==='GET'?[]:[{id:B,user_id:A,meal_type:'snack',quantity_g:50,food_id:A}]}));
 const service=f.load('src/services/mealsService'); await service.updateMealRecord(B,{quantity_g:50}); await service.deleteMealRecord(B);
 assert.equal(await service.getMealRecordById(B),null);
 for(const request of f.calls) {assert.equal(request.url.searchParams.get('id'),'eq.'+B);assert.equal(request.url.searchParams.get('user_id'),'eq.'+A);}
});
test('sleep add/delete use valid timestamps and owned row filters',async () => {
 const payload={sleep_start:'2026-10-26T22:00:00Z',sleep_end:'2026-10-27T06:00:00Z',quality_rating:4};
 const f=fixture(() => ({data:[{id:B,user_id:A,...payload}]})); const service=f.load('src/services/sleepService');
 await service.addSleepRecord(payload); await service.deleteSleepRecord(B);
 assert.equal(f.calls[0].body.user_id,A); assert.equal(f.calls[1].url.searchParams.get('id'),'eq.'+B); assert.equal(f.calls[1].url.searchParams.get('user_id'),'eq.'+A);
});
test('network errors are classified and missing count metadata is never a fabricated total',async () => {
 const f=fixture(() => ({status:400,data:{message:'Network unavailable'}}));
 await assert.rejects(f.load('src/services/foodsService').getAllFoods(),error=>error.code==='NETWORK');
 const page=await f.load('src/services/queryCore').readPages(async()=>({data:[{id:A}],error:null}),{page:2,pageSize:1});
 assert.equal(page.total,null); assert.equal(page.hasMore,true);
});

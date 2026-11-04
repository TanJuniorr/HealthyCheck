/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const createLoader = require('./load-ts.cjs');
const load = createLoader();
const dates = load('src/lib/dateUtils');
const calc = load('src/lib/healthCalculations');
const validation = load('src/lib/dataValidation');
const { DataAccessError } = load('src/lib/dataErrors');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const food = { id:A,name:'Rice',calories_per_100g:'130',protein_per_100g:'2.7',carbs_per_100g:'28',fat_per_100g:'0.3',calories:9999,serving_size:'one bowl' };
const step = (date,steps,id=A) => ({ id,user_id:A,record_date:date,steps,distance_km:null,active_minutes:null });

test('per-100g nutrition ignores legacy serving calories and sums multiple foods', () => {
 const nutrition = calc.calculateFoodNutrition(food,150);
 assert.equal(nutrition.calories,195); assert.ok(Math.abs(nutrition.protein-4.05)<1e-9);
 const day = dates.toLocalDateKey(new Date('2026-10-27T05:00:00Z'));
 const rows = [100,150].map((quantity_g,index) => ({ id:String(index),food,user_id:A,food_id:A,quantity_g,meal_type:'lunch',consumed_at:'2026-10-27T05:00:00Z' }));
 const summary = calc.aggregateNutrition(rows,day,day,2000);
 assert.equal(summary.calories,325); assert.equal(summary.byMealType.lunch.calories,325);
 assert.equal(calc.getFoodServingGrams(food),null);
 assert.equal(calc.getFoodServingGrams({ serving_size:'0.25 kg' }),250);
 assert.throws(() => calc.aggregateNutrition([{ ...rows[0],food:null }],day,day), /thực phẩm/);
});
test('BMI handles numeric strings, missing and invalid measurements', () => {
 assert.ok(Math.abs(calc.calculateBMI('68','172')-22.9853975)<1e-6);
 for (const value of [null,undefined,'',NaN,Infinity,0,-1]) assert.equal(calc.calculateBMI(value,172),null);
});
test('steps aggregate duplicate dates and distinguish missing from explicit zero', () => {
 const result = calc.aggregateSteps([step('2026-10-26',100),step('2026-10-26',250,B),step('2026-10-27',0)],'2026-10-26','2026-11-01',800);
 assert.equal(result.totalSteps,350); assert.equal(result.daily.length,7); assert.equal(result.averageDailySteps,50);
 assert.equal(result.daysWithRecords,2); assert.equal(result.daysWithActivity,1);
 assert.equal(result.daily[1].hasRecords,true); assert.equal(result.daily[2].hasRecords,false);
 assert.equal(result.daily[0].distanceKm,null); assert.equal(result.bestDay.date,'2026-10-26');
 assert.equal(calc.aggregateSteps([],'2026-10-26','2026-10-26').bestDay,null);
});
test('sleep duration crosses midnight and quality remains a subjective 1–5 rating', () => {
 assert.equal(calc.sleepDurationMinutes('2026-10-26T22:00:00+07:00','2026-10-27T06:30:00+07:00'),510);
 assert.throws(() => calc.sleepDurationMinutes('bad','bad'));
 const row = { id:A,sleep_start:'2026-10-26T22:00:00+07:00',sleep_end:'2026-10-27T06:30:00+07:00',quality_rating:4 };
 const day = dates.timestampDateKey(row.sleep_end); const result = calc.aggregateSleep([row],day,day);
 assert.equal(result.totalMinutes,510); assert.equal(result.averageQualityRating,4);
});
test('water totals include every entry and weight uses latest measurement per local day', () => {
 const stamp = '2026-10-27T05:00:00Z'; const day=dates.timestampDateKey(stamp);
 const water = calc.aggregateWater([250,500,250].map(amount_ml => ({ recorded_at:stamp,amount_ml })),day,day,2000);
 assert.equal(water.totalMl,1000); assert.equal(water.progressPercent,50);
 const weights = [{ id:A,recorded_at:stamp,weight_kg:'70' },{ id:B,recorded_at:'2026-10-27T06:00:00Z',weight_kg:'69.5' }];
 const trend = calc.aggregateWeight(weights,day,day); assert.equal(trend.points.length,1); assert.equal(trend.points[0].weightKg,69.5);
});
test('date utilities validate leap dates and cross month/year boundaries', () => {
 assert.throws(() => dates.toLocalDateKey('2026-02-29')); assert.equal(dates.toLocalDateKey('2024-02-29'),'2024-02-29');
 assert.equal(dates.getDaysInRange('2026-12-31','2027-01-02').join(','),'2026-12-31,2027-01-01,2027-01-02');
 assert.equal(dates.getMonthRange('2024-02-20').end,'2024-02-29');
 assert.equal(dates.getWeekRange('2026-11-01').start,'2026-10-26');
 assert.throws(() => dates.validateDateRange('2026-10-28','2026-10-27'));
});
test('local bounds honor timezone midnight and daylight-saving transitions', () => {
 const script = `const load=require('./tests/load-ts.cjs')(); const d=load('src/lib/dateUtils'); console.log(JSON.stringify({key:d.timestampDateKey('2026-10-26T18:00:00Z'),bounds:d.getLocalDayBounds('2026-03-08')}));`;
 const cwd = path.join(__dirname,'..');
 const vn = JSON.parse(execFileSync(process.execPath,['-e',script],{ cwd,env:{ ...process.env,TZ:'Asia/Ho_Chi_Minh' },encoding:'utf8' }));
 assert.equal(vn.key,'2026-10-27');
 const ny = JSON.parse(execFileSync(process.execPath,['-e',script],{ cwd,env:{ ...process.env,TZ:'America/New_York' },encoding:'utf8' }));
 assert.equal((Date.parse(ny.bounds.end)-Date.parse(ny.bounds.start))/3600000,23);
});
test('goal progress handles absent/zero targets and current-goal selection excludes future', () => {
 assert.equal(calc.goalProgress(100,null),null); assert.equal(calc.goalProgress(100,0),null); assert.equal(calc.goalProgress(120,100),100);
 const rows = [{ id:A,effective_from:'2026-10-20',created_at:'2026-10-20T00:00:00Z',daily_steps:8000 },{ id:B,effective_from:'2026-10-28',created_at:'2026-10-21T00:00:00Z',daily_steps:9000 }];
 assert.equal(calc.selectCurrentGoals(rows,'2026-10-27').daily_steps,8000);
});
test('validation blocks owner spoofing, invalid quantities, dates and empty patches', () => {
 const invalids = [() => validation.validateInput('step_records',{ record_date:'2026-10-27',steps:-1 }),() => validation.validateInput('step_records',{ record_date:'2026-10-27',steps:1.5 }),() => validation.validateInput('step_records',{ record_date:'2026-10-27',steps:2,user_id:B }),() => validation.validateInput('sleep_records',{ sleep_start:'2026-10-27T10:00:00Z',sleep_end:'2026-10-27T09:00:00Z' }),() => validation.validateInput('sleep_records',{ sleep_start:'2026-10-27T00:00:00Z',sleep_end:'2026-10-27T01:00:00Z',quality_rating:6 }),() => validation.validateInput('meal_records',{ food_id:A,meal_type:'snacks',quantity_g:1 }),() => validation.validateInput('meal_records',{ food_id:A,meal_type:'snack',quantity_g:0 }),() => validation.validateInput('water_records',{ amount_ml:1.5 }),() => validation.validateInput('weight_records',{},true),() => validation.validateProfile({ date_of_birth:'2999-01-01' }),() => validation.validateProfile({ height_cm:0 })];
 for (const action of invalids) assert.throws(action,error => error instanceof DataAccessError && error.code==='INVALID_INPUT');
 assert.equal(validation.validateProfile({ full_name:' Lan ' }).full_name,'Lan');
 assert.equal('height_cm' in validation.validateProfile({ full_name:'Lan' }),false);
 for (const value of ['',NaN,Infinity,'bad',null]) assert.throws(() => validation.safeNumber(value));
});
test('pagination uses inclusive range, caps page size and rejects invalid offsets', () => {
 const page = validation.normalizePagination({ page:2,pageSize:20 }); assert.equal(page.from,20); assert.equal(page.to,39);
 assert.equal(validation.normalizePagination({ pageSize:1000 }).pageSize,200);
 for (const page of [0,-1,1.5,Infinity]) assert.throws(() => validation.normalizePagination({ page }));
});

test('invalid/nonfinite numeric outputs fail instead of rendering NaN or Infinity',()=>{
 assert.throws(()=>calc.calculateFoodNutrition({...food,calories_per_100g:1e308},1e308));
 assert.equal(calc.goalProgress(NaN,100),null); assert.equal(calc.calculateBMI(1e308,0.000001),null);
 assert.throws(()=>validation.normalizeRow('weight_records',{weight_kg:'NaN'}),error=>error.code==='DATABASE');
 assert.throws(()=>validation.validateInput('step_records',null),error=>error.code==='INVALID_INPUT');
});

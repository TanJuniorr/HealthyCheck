import { notifyNutritionChanged } from '../lib/healthQueryEvents';
import { supabase } from '../lib/supabase';
import type { MealRecordInsert } from '../types/database';
import type { MealWithFood } from '../types/health';
import { columns, makeRepository, queryResult, readPages, requireAuthenticatedUserId, assertIdentity, type HistoryOptions } from './queryCore';
import { validateInput, validId, normalizeRow, normalizePagination } from '../lib/dataValidation';
import { DataAccessError, invalid } from '../lib/dataErrors';
import { getLocalDayBounds, getWeekRange, toLocalDateKey, validateDateRange, type DateInput } from '../lib/dateUtils';
import { aggregateNutrition } from '../lib/healthCalculations';
import { getCurrentGoals } from './healthGoalsService';
const repo = makeRepository('meal_records');
const mealColumns = `${columns.meal_records},food:foods(${columns.foods})` as const;
export async function getMealHistory(options: HistoryOptions = {}, all = false) {
 normalizePagination(options);
 if (options.startDate !== undefined) toLocalDateKey(options.startDate);
 if (options.endDate !== undefined) toLocalDateKey(options.endDate);
 if (options.startDate && options.endDate) validateDateRange(options.startDate,options.endDate);
 const owner = await requireAuthenticatedUserId();
 const result = await readPages((from,to) => {
  let query = supabase.from('meal_records').select(mealColumns, { count: 'exact' }).eq('user_id',owner);
  if (options.startDate) query = query.gte('consumed_at',getLocalDayBounds(options.startDate).start);
  if (options.endDate) query = query.lt('consumed_at',getLocalDayBounds(options.endDate).end);
  return query.order('consumed_at',{ ascending: options.ascending ?? false }).order('id',{ ascending: options.ascending ?? false }).range(from,to);
 },options,all);
 await assertIdentity(owner);
 return { ...result,data:result.data.map(row => ({ ...normalizeRow('meal_records',row),food:row.food ? normalizeRow('foods',row.food) : null })) };
}
export async function getMealsByDateRange(startDate: string,endDate: string): Promise<MealWithFood[]> { validateDateRange(startDate,endDate); return (await getMealHistory({ startDate,endDate,pageSize:200,ascending:true },true)).data; }
export function getMealsByDate(date: DateInput) { const key = toLocalDateKey(date); return getMealsByDateRange(key,key); }
export async function getMealRecordById(id: string) {
 validId(id); const owner = await requireAuthenticatedUserId();
 return queryResult(supabase.from('meal_records').select(mealColumns).eq('id',id).eq('user_id',owner).maybeSingle(),owner);
}
async function verifyFoods(ids: string[]) {
 const data = await queryResult(supabase.from('foods').select('id').in('id',[...new Set(ids)]));
 const known = new Set((data ?? []).map(row => row.id));
 if (ids.some(id => !known.has(id))) throw new DataAccessError('NOT_FOUND','Thực phẩm không tồn tại hoặc không khả dụng.');
}
const pendingAdds = new Set<string>();
export async function addMealItems(items: MealRecordInsert[]): Promise<MealWithFood[]> {
 if (!Array.isArray(items) || items.length < 1 || items.length > 200) invalid('Mỗi lần lưu cần 1–200 món.');
 const inputs = items.map(item => validateInput('meal_records',item));
 const owner = await requireAuthenticatedUserId();
 if (pendingAdds.has(owner)) throw new DataAccessError('INVALID_INPUT','meals.busy');
 pendingAdds.add(owner);
 try {
 await verifyFoods(inputs.map(item => item.food_id)); await assertIdentity(owner);
 const result = await queryResult(supabase.from('meal_records').insert(inputs.map(input => ({ ...input,user_id:owner }))).select(mealColumns),owner);
 if (!result || result.length !== inputs.length) throw new DataAccessError('DATABASE','Máy chủ chưa xác nhận đầy đủ các món đã lưu.');
 const rows = result.map(row => ({ ...normalizeRow('meal_records',row),food:row.food ? normalizeRow('foods',row.food) : null }));
 notifyNutritionChanged(owner);
 return rows;
 } finally { pendingAdds.delete(owner); }
}
export async function addMealRecord(payload: MealRecordInsert) { return (await addMealItems([payload]))[0]; }
export async function updateMealRecord(id: string,payload: Partial<MealRecordInsert>) { const patch = validateInput('meal_records',payload,true); const owner = await requireAuthenticatedUserId(); if (patch.food_id) await verifyFoods([patch.food_id]); await assertIdentity(owner); const row = await repo.update(id,patch); await assertIdentity(owner); notifyNutritionChanged(owner); return row; }
export async function deleteMealRecord(id: string) { const owner = await requireAuthenticatedUserId(); const result = await repo.remove(id); await assertIdentity(owner); notifyNutritionChanged(owner); return result; }
export async function getNutritionSummary(start: string,end: string) { if (start !== end) return aggregateNutrition(await getMealsByDateRange(start,end),start,end); const [rows,goals] = await Promise.all([getMealsByDateRange(start,end),getCurrentGoals(end)]); return aggregateNutrition(rows,start,end,goals?.daily_calories ?? null); }
export function getDailyNutrition(date: DateInput = new Date()) { const key = toLocalDateKey(date); return getNutritionSummary(key,key); }
export function getWeeklyNutrition(date: DateInput = new Date()) { const range = getWeekRange(date); return getNutritionSummary(range.start,range.end); }

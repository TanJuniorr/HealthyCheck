import { makeRepository, columns, queryResult, requireAuthenticatedUserId, assertIdentity } from './queryCore';
import { supabase } from '../lib/supabase';
import { aggregateWater } from '../lib/healthCalculations';
import { getCurrentGoals, getGoalsForRange } from './healthGoalsService';
import { getWeekRange, toLocalDateKey, type DateInput } from '../lib/dateUtils';
import { validateInput, validId, normalizeRow } from '../lib/dataValidation';
import { DataAccessError } from '../lib/dataErrors';
import { waterAmount } from '../lib/waterValidation';
import { notifyWaterChanged } from '../lib/healthQueryEvents';
import type { WaterRecordInsert } from '../types/database';
const repo = makeRepository('water_records');
export const getWaterHistory = repo.history;
export const getWaterRecordsByDateRange = repo.range;
const pending = new Set<string>();
async function mutate<T>(owner: string, action:()=>Promise<T>) {
 if(pending.has(owner))throw new DataAccessError('INVALID_INPUT','water.busy');
 pending.add(owner);
 try {await assertIdentity(owner);const result=await action();await assertIdentity(owner);notifyWaterChanged(owner);return result;}
 finally {pending.delete(owner);}
}
function validate(payload: Partial<WaterRecordInsert>,patch=false) {
 const input=validateInput('water_records',payload,patch);
 if(input.amount_ml!==undefined) waterAmount(input.amount_ml);
 if(input.recorded_at && Date.parse(input.recorded_at)>Date.now()) throw new DataAccessError('INVALID_INPUT','water.futureTime');
 return input;
}
export async function addWaterRecord(payload: WaterRecordInsert) {
 const input=validate({...payload,recorded_at:payload.recorded_at??new Date().toISOString()});const owner=await requireAuthenticatedUserId();
 return mutate(owner,async()=>{
  const row=await queryResult(supabase.from('water_records').insert({...input,user_id:owner}).select(columns.water_records).single(),owner);
  if(!row)throw new DataAccessError('DATABASE','errors.saveUnconfirmed');return normalizeRow('water_records',row);
 });
}
export async function updateWaterRecord(id: string,payload: Partial<WaterRecordInsert>) {
 validId(id);const input=validate(payload,true),owner=await requireAuthenticatedUserId();
 return mutate(owner,async()=>{
  const row=await queryResult(supabase.from('water_records').update(input).eq('id',id).eq('user_id',owner).select(columns.water_records).maybeSingle(),owner);
  if(!row)throw new DataAccessError('NOT_FOUND','errors.recordMissing');return normalizeRow('water_records',row);
 });
}
export async function deleteWaterRecord(id: string) {
 validId(id);const owner=await requireAuthenticatedUserId();
 return mutate(owner,async()=>{
  const row=await queryResult(supabase.from('water_records').delete().eq('id',id).eq('user_id',owner).select('id').maybeSingle(),owner);
  if(!row)throw new DataAccessError('NOT_FOUND','errors.recordMissing');
 });
}
export function getWaterRecordsByDate(date: DateInput) { const key = toLocalDateKey(date); return repo.range(key,key); }
export async function getDailyWaterTotal(date: DateInput = new Date()) { const key = toLocalDateKey(date); const [rows,goals] = await Promise.all([repo.range(key,key),getCurrentGoals(key)]); return aggregateWater(rows,key,key,goals?.daily_water_ml ?? null); }
export async function getWeeklyWaterSummary(date: DateInput = new Date()) { const range = getWeekRange(date); return aggregateWater(await repo.range(range.start,range.end),range.start,range.end); }

export async function getWaterTrackingRange(start: string,end: string) {
 const [rows,goals] = await Promise.all([repo.range(start,end),getGoalsForRange(start,end)]);
 return { rows, goals };
}

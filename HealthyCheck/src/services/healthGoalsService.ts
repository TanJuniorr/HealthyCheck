import type { HealthGoalRow, HealthGoalInsert } from '../types/database';
import { supabase } from '../lib/supabase';
import { toLocalDateKey, validateDateRange, type DateInput } from '../lib/dateUtils';
import { columns, makeRepository, queryResult, requireAuthenticatedUserId } from './queryCore';
import { notifyGoalsChanged } from '../lib/healthQueryEvents';
const repo = makeRepository('health_goals');
export const getGoalsHistory = repo.history;
export async function createGoals(input:HealthGoalInsert){const row=await repo.add(input);notifyGoalsChanged(row.user_id);return row;}
export async function updateGoals(id:string,input:Partial<HealthGoalInsert>){const row=await repo.update(id,input);notifyGoalsChanged(row.user_id);return row;}
export async function deleteGoals(id:string){const owner=await requireAuthenticatedUserId();await repo.remove(id);notifyGoalsChanged(owner);}
export async function getCurrentGoals(referenceDate: DateInput = new Date()): Promise<HealthGoalRow | null> {
 const date = toLocalDateKey(referenceDate); const id = await requireAuthenticatedUserId();
 return queryResult<HealthGoalRow>(supabase.from('health_goals').select(columns.health_goals).eq('user_id', id).lte('effective_from', date).order('effective_from', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(), id);
}

export async function getGoalsForRange(start: string,end: string) {
 validateDateRange(start,end);
 if (start === end) { const current = await getCurrentGoals(start); return current ? [current] : []; }
 const [baseline,changes] = await Promise.all([getCurrentGoals(start),repo.history({ startDate:start,endDate:end,pageSize:200 },true)]);
 return [...changes.data,...(baseline ? [baseline] : [])];
}

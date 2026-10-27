import type { HealthGoalRow } from '../types/database';
import { supabase } from '../lib/supabase';
import { toLocalDateKey, validateDateRange, type DateInput } from '../lib/dateUtils';
import { columns, makeRepository, queryResult, requireAuthenticatedUserId } from './queryCore';
const repo = makeRepository('health_goals');
export const getGoalsHistory = repo.history;
export const createGoals = repo.add;
export const updateGoals = repo.update;
export const deleteGoals = repo.remove;
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

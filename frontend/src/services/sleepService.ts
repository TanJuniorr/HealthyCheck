import { supabase } from '../lib/supabase';
import { makeRepository, queryResult, columns, requireAuthenticatedUserId } from './queryCore';
import { aggregateSleep } from '../lib/healthCalculations';
import { validateInput, validId } from '../lib/dataValidation';
import { DataAccessError } from '../lib/dataErrors';
import { getWeekRange, type DateInput } from '../lib/dateUtils';
import type { SleepRecordInsert } from '../types/database';
const repo = makeRepository('sleep_records');
export const getSleepRecords = repo.history;
export const getSleepRecordById = repo.byId;
export const getSleepByDateRange = repo.range;
export const addSleepRecord = repo.add;
export const deleteSleepRecord = repo.remove;
export async function updateSleepRecord(id: string, payload: Partial<SleepRecordInsert>) {
 validId(id); const patch = validateInput('sleep_records',payload,true); const current = await repo.byId(id);
 if (!current) throw new DataAccessError('NOT_FOUND','Không tìm thấy giấc ngủ.');
 validateInput('sleep_records',{ sleep_start: patch.sleep_start ?? current.sleep_start, sleep_end: patch.sleep_end ?? current.sleep_end });
 const owner = await requireAuthenticatedUserId();
 const row = await queryResult(supabase.from('sleep_records').update(patch).eq('id',id).eq('user_id',owner).eq('sleep_start',current.sleep_start).eq('sleep_end',current.sleep_end).select(columns.sleep_records).maybeSingle(),owner);
 if (!row) throw new DataAccessError('NOT_FOUND','Giấc ngủ đã thay đổi hoặc không còn khả dụng. Hãy tải lại.');
 return row;
}
export async function getSleepSummary(start: string,end: string) { return aggregateSleep(await repo.range(start,end),start,end); }
export function getWeeklySleep(date: DateInput = new Date()) { const range = getWeekRange(date); return getSleepSummary(range.start,range.end); }

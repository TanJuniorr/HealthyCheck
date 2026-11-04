import { supabase } from '../lib/supabase';
import { queryResult, requireAuthenticatedUserId } from './queryCore';
import { validateSchedule } from '../lib/sleepSchedule';
import { DataAccessError } from '../lib/dataErrors';
import { notifySleepChanged } from '../lib/healthQueryEvents';
import type { SleepScheduleInput, SleepScheduleRow } from '../types/database';
const fields='id,user_id,bedtime,wake_time,active_days,reminder_enabled,reminder_minutes_before,created_at,updated_at';
export async function getMySleepSchedule() {
 const owner=await requireAuthenticatedUserId();
 return queryResult<SleepScheduleRow>(supabase.from('sleep_schedules').select(fields).eq('user_id',owner).maybeSingle(),owner);
}
export async function saveSleepSchedule(payload: SleepScheduleInput) {
 const input=validateSchedule(payload),owner=await requireAuthenticatedUserId();
 const row=await queryResult(supabase.from('sleep_schedules').upsert({...input,user_id:owner},{onConflict:'user_id'}).select(fields).single(),owner);
 if(!row) throw new DataAccessError('DATABASE','errors.saveUnconfirmed');
 notifySleepChanged(owner,'schedule');return row;
}
export const updateSleepSchedule=saveSleepSchedule;
export async function deleteSleepSchedule() {
 const owner=await requireAuthenticatedUserId();
 const row=await queryResult(supabase.from('sleep_schedules').delete().eq('user_id',owner).select('id').maybeSingle(),owner);
 if(!row) throw new DataAccessError('NOT_FOUND','errors.recordMissing');
 notifySleepChanged(owner,'schedule');
}

import { supabase } from '../lib/supabase';
import { makeRepository, queryResult, columns, requireAuthenticatedUserId, assertIdentity } from './queryCore';
import { aggregateSleep } from '../lib/healthCalculations';
import { validateInput, validId, normalizeRow } from '../lib/dataValidation';
import { DataAccessError } from '../lib/dataErrors';
import { getWeekRange, type DateInput } from '../lib/dateUtils';
import { validateCompletedSleep, sleepInvalid } from '../lib/sleepValidation';
import { notifySleepChanged } from '../lib/healthQueryEvents';
import type { SleepRecordInsert } from '../types/database';
const repo = makeRepository('sleep_records');
export const getSleepRecords = repo.history;
export const getSleepRecordById = repo.byId;
export const getSleepByDateRange = repo.range;

// Serialize writes per account in this client, including duplicate taps across forms.
const writing = new Set<string>();
async function mutate<T>(owner: string, action: () => Promise<T>): Promise<T> {
  if (writing.has(owner)) return sleepInvalid('sleep.busy');
  writing.add(owner);
  try {
    await assertIdentity(owner);
    const result = await action();
    await assertIdentity(owner);
    notifySleepChanged(owner);
    return result;
  } finally { writing.delete(owner); }
}
async function checkOverlap(owner: string, input: SleepRecordInsert, exceptId?: string) {
  let query = supabase.from('sleep_records').select('id').eq('user_id', owner)
    .lt('sleep_start', input.sleep_end).gt('sleep_end', input.sleep_start);
  if (exceptId) query = query.neq('id', exceptId);
  const rows = await queryResult(query.limit(1), owner);
  if (rows?.length) return sleepInvalid('sleep.overlap');
}
export async function addSleepRecord(payload: SleepRecordInsert) {
  const input = validateInput('sleep_records', payload);
  validateCompletedSleep(input.sleep_start, input.sleep_end);
  const owner = await requireAuthenticatedUserId();
  return mutate(owner, async () => {
    await checkOverlap(owner, input);
    const row = await queryResult(supabase.from('sleep_records').insert({ ...input, user_id: owner })
      .select(columns.sleep_records).single(), owner);
    if (!row) throw new DataAccessError('DATABASE', 'errors.saveUnconfirmed');
    return normalizeRow('sleep_records', row);
  });
}
export async function updateSleepRecord(id: string, payload: Partial<SleepRecordInsert>) {
  validId(id);
  const patch = validateInput('sleep_records', payload, true);
  const owner = await requireAuthenticatedUserId();
  return mutate(owner, async () => {
    const current = await repo.byId(id);
    await assertIdentity(owner);
    if (!current || current.user_id !== owner) throw new DataAccessError('NOT_FOUND', 'errors.sleepMissing');
    const merged = { sleep_start: patch.sleep_start ?? current.sleep_start, sleep_end: patch.sleep_end ?? current.sleep_end };
    validateCompletedSleep(merged.sleep_start, merged.sleep_end);
    await checkOverlap(owner, merged, id);
    const row = await queryResult(supabase.from('sleep_records').update(patch).eq('id', id).eq('user_id', owner)
      .eq('sleep_start', current.sleep_start).eq('sleep_end', current.sleep_end).select(columns.sleep_records).maybeSingle(), owner);
    if (!row) throw new DataAccessError('NOT_FOUND', 'errors.sleepChanged');
    return normalizeRow('sleep_records', row);
  });
}
export async function deleteSleepRecord(id: string) {
  validId(id);
  const owner = await requireAuthenticatedUserId();
  return mutate(owner, async () => {
    const row = await queryResult(supabase.from('sleep_records').delete().eq('id', id).eq('user_id', owner)
      .select('id').maybeSingle(), owner);
    if (!row) throw new DataAccessError('NOT_FOUND', 'errors.sleepMissing');
  });
}
export async function getSleepSummary(start: string, end: string) { return aggregateSleep(await repo.range(start, end), start, end); }
export function getWeeklySleep(date: DateInput = new Date()) { const range = getWeekRange(date); return getSleepSummary(range.start, range.end); }

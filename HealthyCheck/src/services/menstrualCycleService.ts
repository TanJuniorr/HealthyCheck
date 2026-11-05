import { supabase } from '../lib/supabase';
import { toLocalDateKey, validateDateRange } from '../lib/dateUtils';
import { validId } from '../lib/dataValidation';
import { notifyCycleChanged } from '../lib/menstrualCycleEvents';
import { DataAccessError, invalid } from '../lib/dataErrors';
import type { CycleFlowStatus, CycleMood, MenstrualCycleLogRow, MenstrualCycleSettingsRow, MenstrualCyclePeriodRow, MenstrualCyclePeriodInput } from '../types/database';
import { assertIdentity, queryResult, readPages, requireAuthenticatedUserId, type HistoryOptions } from './queryCore';
export { subscribeCycleSettingsChanges } from '../lib/menstrualCycleEvents';

const settingsFields = 'user_id,last_period_start,cycle_length,period_length,reminder_enabled,reminder_days_before,updated_at';
const logFields = 'id,user_id,log_date,flow_status,mood,symptoms,created_at,updated_at';
const allowedMoods = new Set<CycleMood>(['happy', 'okay', 'low', 'tired', 'stressed']);
const allowedFlows = new Set<CycleFlowStatus>(['none', 'spotting', 'light', 'medium', 'heavy']);
const allowedSymptoms = new Set(['cramps', 'headache', 'bloating', 'fatigue', 'moodSwings', 'backPain']);

async function cycleQueryResult<T>(query: Parameters<typeof queryResult<T>>[0], owner: string): Promise<T | null> {
  try {
    return await queryResult<T>(query, owner);
  } catch (error) {
    if (error instanceof DataAccessError && error.code === 'DATABASE') {
      throw new DataAccessError('DATABASE', 'cycle.databaseMigrationRequired');
    }
    throw error;
  }
}

export async function getMyMenstrualCycleSettings(): Promise<MenstrualCycleSettingsRow | null> {
  const owner = await requireAuthenticatedUserId();
  return cycleQueryResult<MenstrualCycleSettingsRow>(
    supabase.from('menstrual_cycle_settings').select(settingsFields).eq('user_id', owner).maybeSingle(),
    owner,
  );
}

export async function saveMyMenstrualCycleSettings(input: Omit<MenstrualCycleSettingsRow, 'user_id' | 'updated_at'>, expectedOwner?: string): Promise<MenstrualCycleSettingsRow> {
  const today = toLocalDateKey();
  const lastPeriodStart = input.last_period_start === null ? null : toLocalDateKey(input.last_period_start);
  if (lastPeriodStart && lastPeriodStart > today) invalid('cycle.invalidSettings');
  if (!Number.isInteger(input.cycle_length) || input.cycle_length < 21 || input.cycle_length > 45) invalid('cycle.invalidSettings');
  if (!Number.isInteger(input.period_length) || input.period_length < 1 || input.period_length > 10) invalid('cycle.invalidSettings');
  if (!Number.isInteger(input.reminder_days_before) || input.reminder_days_before < 1 || input.reminder_days_before > 7) invalid('cycle.invalidSettings');
  if (typeof input.reminder_enabled !== 'boolean') invalid('cycle.invalidSettings');

  const owner = await requireAuthenticatedUserId();
  if (expectedOwner && expectedOwner !== owner) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
  const row = await cycleQueryResult(
    supabase.from('menstrual_cycle_settings').upsert({
      user_id: owner,
      last_period_start: lastPeriodStart,
      cycle_length: input.cycle_length,
      period_length: input.period_length,
      reminder_enabled: input.reminder_enabled,
      reminder_days_before: input.reminder_days_before,
      updated_at: new Date().toISOString(),
    }).select(settingsFields).single(),
    owner,
  );
  if (!row) invalid('cycle.saveFailed');
  notifyCycleChanged(owner, 'settings');
  return row as MenstrualCycleSettingsRow;
}

export async function getMyMenstrualCycleLog(date: string): Promise<MenstrualCycleLogRow | null> {
  const logDate = toLocalDateKey(date);
  const owner = await requireAuthenticatedUserId();
  return cycleQueryResult<MenstrualCycleLogRow>(
    supabase.from('menstrual_cycle_logs').select(logFields).eq('user_id', owner).eq('log_date', logDate).maybeSingle(),
    owner,
  );
}

export async function saveMyMenstrualCycleLog(input: {
  log_date: string;
  flow_status: CycleFlowStatus | null;
  mood: CycleMood | null;
  symptoms: string[];
}, expectedOwner?: string): Promise<MenstrualCycleLogRow> {
  const logDate = toLocalDateKey(input.log_date);
  if (logDate > toLocalDateKey()) invalid('cycle.invalidLog');
  if (input.flow_status !== null && !allowedFlows.has(input.flow_status)) invalid('cycle.invalidLog');
  if (input.mood !== null && !allowedMoods.has(input.mood)) invalid('cycle.invalidLog');
  if (!Array.isArray(input.symptoms) || input.symptoms.length > allowedSymptoms.size || input.symptoms.some(item => !allowedSymptoms.has(item))) invalid('cycle.invalidLog');

  const owner = await requireAuthenticatedUserId();
  if (expectedOwner && expectedOwner !== owner) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
  const row = await cycleQueryResult(
    supabase.from('menstrual_cycle_logs').upsert({
      user_id: owner,
      log_date: logDate,
      flow_status: input.flow_status,
      mood: input.mood,
      symptoms: [...new Set(input.symptoms)],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,log_date' }).select(logFields).single(),
    owner,
  );
  if (!row) invalid('cycle.saveFailed');
  notifyCycleChanged(owner, 'logs');
  return row as MenstrualCycleLogRow;
}

const periodFields = 'id,user_id,start_date,end_date,notes,recorded_timezone,created_at,updated_at';
export async function getMyMenstrualCyclePeriods(options: HistoryOptions = {}) {
  const owner = await requireAuthenticatedUserId();
  if (options.startDate && options.endDate) validateDateRange(options.startDate, options.endDate);
  const page = await readPages<MenstrualCyclePeriodRow>((from, to) => {
    let query = supabase.from('menstrual_cycle_periods').select(periodFields, { count: 'exact' }).eq('user_id', owner);
    if (options.endDate) query = query.lte('start_date', toLocalDateKey(options.endDate));
    if (options.startDate) query = query.or(`end_date.is.null,end_date.gte.${toLocalDateKey(options.startDate)}`);
    return query.order('start_date', { ascending: false }).order('id', { ascending: false }).range(from, to);
  }, options, Boolean(options.startDate && options.endDate)).catch(error => {
    if (error instanceof DataAccessError && error.code === 'DATABASE') throw new DataAccessError('DATABASE', 'cycle.databaseMigrationRequired');
    throw error;
  });
  await assertIdentity(owner);
  if (page.data.some(period => period.user_id !== owner)) throw new DataAccessError('PERMISSION_DENIED', 'errors.accountChangedReload');
  return page;
}
export async function getMyMenstrualCycleOverview() {
  const owner = await requireAuthenticatedUserId();
  const [settings, history] = await Promise.all([getMyMenstrualCycleSettings(), getMyMenstrualCyclePeriods({ pageSize: 8 })]);
  await assertIdentity(owner);
  return { settings, periods: history.data };
}
export type MenstrualCycleOverview = Awaited<ReturnType<typeof getMyMenstrualCycleOverview>>;
export async function getMyMenstrualCycleHistory(page = 1) {
  if (!Number.isInteger(page) || page < 1) invalid('cycle.invalidLog');
  const owner = await requireAuthenticatedUserId(), from = (page - 1) * 10;
  const rows = await cycleQueryResult<MenstrualCyclePeriodRow[]>(supabase.from('menstrual_cycle_periods').select(periodFields).eq('user_id', owner).order('start_date', { ascending: false }).order('id', { ascending: false }).range(from, from + 10), owner) ?? [];
  return { data: rows.slice(0, 10), previousStart: rows[10]?.start_date ?? null, hasMore: rows.length > 10 };
}
export async function getMyMenstrualCycleCalendar(start: string, end: string) {
  validateDateRange(start, end);
  const owner = await requireAuthenticatedUserId();
  const [periods, logs] = await Promise.all([
    getMyMenstrualCyclePeriods({ startDate: start, endDate: end }),
    cycleQueryResult<MenstrualCycleLogRow[]>(supabase.from('menstrual_cycle_logs').select(logFields).eq('user_id', owner).gte('log_date', start).lte('log_date', end).order('log_date'), owner),
  ]);
  await assertIdentity(owner);
  return { periods: periods.data, logs: logs ?? [] };
}
export function validateMenstrualPeriod(input: MenstrualCyclePeriodInput, today = toLocalDateKey()) {
  validId(input.id);
  const start = toLocalDateKey(input.start_date), end = input.end_date === null ? null : toLocalDateKey(input.end_date);
  if (start > today || (end && end > today) || (end && end < start)) invalid('cycle.invalidPeriodDates');
  if (input.notes !== null && (typeof input.notes !== 'string' || input.notes.length > 2000)) invalid('cycle.invalidNotes');
  return { id: input.id, start_date: start, end_date: end, notes: input.notes?.trim() || null };
}
async function periodResult<T>(query: Parameters<typeof queryResult<T>>[0], owner: string) {
  // Map only cycle errors here: the shared mapper treats exclusion violations as sleep overlap.
  const result = await query;
  const error = result.error as { code?: string } | null;
  if (error?.code?.startsWith('23')) throw new DataAccessError('CONSTRAINT', 'cycle.periodConflict');
  return cycleQueryResult<T>(Promise.resolve(result), owner);
}
export async function saveMyMenstrualCyclePeriod(input: MenstrualCyclePeriodInput, expectedOwner: string, expectedUpdatedAt?: string) {
  const payload = validateMenstrualPeriod(input), owner = await requireAuthenticatedUserId();
  if (owner !== expectedOwner) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
  const recorded_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let saved: MenstrualCyclePeriodRow | null;
  if (expectedUpdatedAt) {
    saved = await periodResult<MenstrualCyclePeriodRow>(supabase.from('menstrual_cycle_periods').update({ ...payload, recorded_timezone }).eq('id', payload.id).eq('user_id', owner).eq('updated_at', expectedUpdatedAt).select(periodFields).maybeSingle(), owner);
  } else {
    saved = await periodResult<MenstrualCyclePeriodRow>(supabase.from('menstrual_cycle_periods').upsert({ ...payload, user_id: owner, recorded_timezone }, { onConflict: 'id', ignoreDuplicates: true }).select(periodFields).maybeSingle(), owner);
    if (!saved) {
      const existing = await cycleQueryResult<MenstrualCyclePeriodRow>(supabase.from('menstrual_cycle_periods').select(periodFields).eq('user_id', owner).eq('id', payload.id).maybeSingle(), owner);
      if (existing && existing.start_date === payload.start_date && existing.end_date === payload.end_date && existing.notes === payload.notes) saved = existing;
    }
  }
  if (!saved) throw new DataAccessError('CONSTRAINT', 'cycle.stalePeriod');
  notifyCycleChanged(owner, 'periods');
  return saved;
}
export async function deleteMyMenstrualCyclePeriod(period: MenstrualCyclePeriodRow, expectedOwner: string) {
  validId(period.id);
  const owner = await requireAuthenticatedUserId();
  if (owner !== expectedOwner || period.user_id !== owner) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
  const deleted = await periodResult(supabase.from('menstrual_cycle_periods').delete().eq('id', period.id).eq('user_id', owner).eq('updated_at', period.updated_at).select('id').maybeSingle(), owner);
  if (!deleted) throw new DataAccessError('CONSTRAINT', 'cycle.stalePeriod');
  notifyCycleChanged(owner, 'periods');
}

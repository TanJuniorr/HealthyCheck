import { supabase } from '../lib/supabase';
import { toLocalDateKey } from '../lib/dateUtils';
import { DataAccessError, invalid } from '../lib/dataErrors';
import type { CycleFlowStatus, CycleMood, MenstrualCycleLogRow, MenstrualCycleSettingsRow } from '../types/database';
import { queryResult, requireAuthenticatedUserId } from './queryCore';

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

type CycleSettingsListener = (ownerId: string) => void;
const cycleSettingsListeners = new Set<CycleSettingsListener>();

export function subscribeCycleSettingsChanges(listener: CycleSettingsListener) {
  cycleSettingsListeners.add(listener);
  return () => cycleSettingsListeners.delete(listener);
}

function notifyCycleSettingsChanged(ownerId: string) {
  for (const listener of cycleSettingsListeners) listener(ownerId);
}

export async function getMyMenstrualCycleSettings(): Promise<MenstrualCycleSettingsRow | null> {
  const owner = await requireAuthenticatedUserId();
  return cycleQueryResult<MenstrualCycleSettingsRow>(
    supabase.from('menstrual_cycle_settings').select(settingsFields).eq('user_id', owner).maybeSingle(),
    owner,
  );
}

export async function saveMyMenstrualCycleSettings(input: Omit<MenstrualCycleSettingsRow, 'user_id' | 'updated_at'>): Promise<MenstrualCycleSettingsRow> {
  const today = toLocalDateKey();
  const lastPeriodStart = input.last_period_start === null ? null : toLocalDateKey(input.last_period_start);
  if (lastPeriodStart && lastPeriodStart > today) invalid('Ngày bắt đầu kỳ kinh không thể ở tương lai.');
  if (!Number.isInteger(input.cycle_length) || input.cycle_length < 21 || input.cycle_length > 45) invalid('Độ dài chu kỳ phải từ 21 đến 45 ngày.');
  if (!Number.isInteger(input.period_length) || input.period_length < 1 || input.period_length > 10) invalid('Số ngày hành kinh phải từ 1 đến 10 ngày.');
  if (!Number.isInteger(input.reminder_days_before) || input.reminder_days_before < 1 || input.reminder_days_before > 7) invalid('Thời gian nhắc phải từ 1 đến 7 ngày trước kỳ dự kiến.');
  if (typeof input.reminder_enabled !== 'boolean') invalid('Trạng thái nhắc chu kỳ không hợp lệ.');

  const owner = await requireAuthenticatedUserId();
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
  if (!row) invalid('Không thể lưu cài đặt chu kỳ.');
  notifyCycleSettingsChanged(owner);
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
  flow_status: CycleFlowStatus;
  mood: CycleMood | null;
  symptoms: string[];
}): Promise<MenstrualCycleLogRow> {
  const logDate = toLocalDateKey(input.log_date);
  if (logDate > toLocalDateKey()) invalid('Chỉ có thể ghi nhận chu kỳ đến ngày hiện tại.');
  if (!allowedFlows.has(input.flow_status)) invalid('Trạng thái kinh nguyệt không hợp lệ.');
  if (input.mood !== null && !allowedMoods.has(input.mood)) invalid('Tâm trạng không hợp lệ.');
  if (!Array.isArray(input.symptoms) || input.symptoms.length > allowedSymptoms.size || input.symptoms.some(item => !allowedSymptoms.has(item))) invalid('Danh sách triệu chứng không hợp lệ.');

  const owner = await requireAuthenticatedUserId();
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
  if (!row) invalid('Không thể lưu ghi nhận chu kỳ.');
  return row as MenstrualCycleLogRow;
}

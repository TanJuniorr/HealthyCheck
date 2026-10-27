import { makeRepository } from './queryCore';
import { aggregateWater } from '../lib/healthCalculations';
import { getCurrentGoals } from './healthGoalsService';
import { getWeekRange, toLocalDateKey, type DateInput } from '../lib/dateUtils';
const repo = makeRepository('water_records');
export const getWaterHistory = repo.history;
export const getWaterRecordsByDateRange = repo.range;
export const addWaterRecord = repo.add;
export const updateWaterRecord = repo.update;
export const deleteWaterRecord = repo.remove;
export function getWaterRecordsByDate(date: DateInput) { const key = toLocalDateKey(date); return repo.range(key,key); }
export async function getDailyWaterTotal(date: DateInput = new Date()) { const key = toLocalDateKey(date); const [rows,goals] = await Promise.all([repo.range(key,key),getCurrentGoals(key)]); return aggregateWater(rows,key,key,goals?.daily_water_ml ?? null); }
export async function getWeeklyWaterSummary(date: DateInput = new Date()) { const range = getWeekRange(date); return aggregateWater(await repo.range(range.start,range.end),range.start,range.end); }

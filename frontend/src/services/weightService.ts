import { makeRepository } from './queryCore';
import { aggregateWeight } from '../lib/healthCalculations';
import { toLocalDateKey, type DateInput } from '../lib/dateUtils';
export { calculateBMI } from '../lib/healthCalculations';
const repo = makeRepository('weight_records');
export const getWeightHistory = repo.history;
export const getWeightByDateRange = repo.range;
export const addWeightRecord = repo.add;
export const updateWeightRecord = repo.update;
export const deleteWeightRecord = repo.remove;
export async function getLatestWeight(referenceDate?: DateInput) { return (await repo.history({ pageSize: 1, endDate: referenceDate ? toLocalDateKey(referenceDate) : toLocalDateKey() })).data[0] ?? null; }
export async function getWeightTrend(start: string,end: string) { return aggregateWeight(await repo.range(start,end),start,end); }

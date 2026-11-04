import { makeRepository, requireAuthenticatedUserId } from './queryCore';
import { notifyWeightChanged } from '../lib/healthQueryEvents';
import type { WeightRecordInsert } from '../types/database';
import { aggregateWeight } from '../lib/healthCalculations';
import { toLocalDateKey, type DateInput } from '../lib/dateUtils';
export { calculateBMI } from '../lib/healthCalculations';
const repo = makeRepository('weight_records');
export const getWeightHistory = repo.history;
export const getWeightByDateRange = repo.range;
export async function addWeightRecord(input:WeightRecordInsert,expectedOwnerId?:string){const row=await repo.add(input,expectedOwnerId);notifyWeightChanged(row.user_id);return row;}
export async function updateWeightRecord(id:string,input:Partial<WeightRecordInsert>){const row=await repo.update(id,input);notifyWeightChanged(row.user_id);return row;}
export async function deleteWeightRecord(id:string){const owner=await requireAuthenticatedUserId();await repo.remove(id);notifyWeightChanged(owner);}
export async function getLatestWeight(referenceDate?: DateInput) { return (await repo.history({ pageSize: 1, endDate: referenceDate ? toLocalDateKey(referenceDate) : toLocalDateKey() })).data[0] ?? null; }
export async function getWeightTrend(start: string,end: string) { return aggregateWeight(await repo.range(start,end),start,end); }

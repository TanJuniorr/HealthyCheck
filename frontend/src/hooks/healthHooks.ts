import { useHealthQuery } from './useHealthQuery';
import { getDashboardSummary,getWeeklyDashboardSummary } from '../services/dashboardService';
import { getStepsSummary } from '../services/stepsService';
import { getSleepSummary } from '../services/sleepService';
import { getNutritionSummary } from '../services/mealsService';
import { getWaterRecordsByDateRange } from '../services/waterService';
import { getWeightTrend } from '../services/weightService';
import { getCurrentGoals } from '../services/healthGoalsService';
import { aggregateWater } from '../lib/healthCalculations';
import { getWeekRange,toLocalDateKey } from '../lib/dateUtils';
export type DateRange = { start: string; end: string };
export function useSteps(range: DateRange) { return useHealthQuery(() => getStepsSummary(range.start,range.end),'steps:'+range.start+':'+range.end); }
export function useSleep(range: DateRange) { return useHealthQuery(() => getSleepSummary(range.start,range.end),'sleep:'+range.start+':'+range.end); }
export function useNutrition(range: DateRange) { return useHealthQuery(() => getNutritionSummary(range.start,range.end),'nutrition:'+range.start+':'+range.end); }
export function useWater(range: DateRange) { return useHealthQuery(async () => aggregateWater(await getWaterRecordsByDateRange(range.start,range.end),range.start,range.end),'water:'+range.start+':'+range.end); }
export function useWeight(range: DateRange) { return useHealthQuery(() => getWeightTrend(range.start,range.end),'weight:'+range.start+':'+range.end); }
export function useHealthGoals(date = toLocalDateKey()) { return useHealthQuery(() => getCurrentGoals(date),'goals:'+date); }
export function useHealthOverview(date = toLocalDateKey()) { return useHealthQuery(() => getDashboardSummary(date),'overview:'+date); }
export function useWeeklyOverview(date = toLocalDateKey()) { const range = getWeekRange(date); return useHealthQuery(() => getWeeklyDashboardSummary(date),'weekly-overview:'+range.start); }

import type { DashboardSummary } from '../types/health';
import type { HealthGoalRow, ProfileRow, WeightRecordRow } from '../types/database';
import { getMyProfile } from './profileService';
import { getCurrentGoals, getGoalsHistory } from './healthGoalsService';
import { getStepsByDateRange } from './stepsService';
import { getSleepByDateRange } from './sleepService';
import { getMealsByDateRange } from './mealsService';
import { getWaterRecordsByDateRange } from './waterService';
import { getLatestWeight, getWeightByDateRange } from './weightService';
import { aggregateSteps, aggregateSleep, aggregateNutrition, aggregateWater, calculateBMI, selectCurrentGoals } from '../lib/healthCalculations';
import { getWeekRange, toLocalDateKey, timestampDateKey, type DateInput } from '../lib/dateUtils';
import { safeNumber } from '../lib/dataValidation';
export function buildDashboard(date: string, steps: ReturnType<typeof aggregateSteps>, sleep: ReturnType<typeof aggregateSleep>, nutrition: ReturnType<typeof aggregateNutrition>, water: ReturnType<typeof aggregateWater>, latest: WeightRecordRow | null, profile: ProfileRow | null, goals: HealthGoalRow | null): DashboardSummary {
 return { date, steps: { total: steps.totalSteps, hasRecords: steps.daysWithRecords > 0, goal: goals?.daily_steps ?? null, progressPercent: steps.daily[0]?.progressPercent ?? null }, sleep: { minutes: sleep.latestSession ? sleep.totalMinutes : null, goalMinutes: goals?.target_sleep_minutes ?? null }, nutrition: { calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, hasRecords: nutrition.hasRecords, calorieGoal: goals?.daily_calories ?? null }, water: { totalMl: water.totalMl, hasRecords: water.hasRecords, goalMl: goals?.daily_water_ml ?? null }, weight: { latestKg: latest ? safeNumber(latest.weight_kg) : null, bmi: calculateBMI(latest?.weight_kg,profile?.height_cm) } };
}
export async function getDashboardSummary(value: DateInput = new Date()): Promise<DashboardSummary> {
 const date = toLocalDateKey(value);
 const [profile,goals,steps,sleep,meals,water,weight] = await Promise.all([getMyProfile(),getCurrentGoals(date),getStepsByDateRange(date,date),getSleepByDateRange(date,date),getMealsByDateRange(date,date),getWaterRecordsByDateRange(date,date),getLatestWeight(date)]);
 return buildDashboard(date,aggregateSteps(steps,date,date,goals?.daily_steps ?? null),aggregateSleep(sleep,date,date),aggregateNutrition(meals,date,date,goals?.daily_calories ?? null),aggregateWater(water,date,date,goals?.daily_water_ml ?? null),weight,profile,goals);
}
export async function getWeeklyDashboardSummary(value: DateInput = new Date()): Promise<DashboardSummary[]> {
 const { start,end } = getWeekRange(value);
 // Fixed number of range queries, not seven copies of the daily dashboard query.
 const [profile,baseline,changes,steps,sleep,meals,water,weightBefore,weights] = await Promise.all([getMyProfile(),getCurrentGoals(start),getGoalsHistory({ startDate:start,endDate:end,pageSize:200 },true),getStepsByDateRange(start,end),getSleepByDateRange(start,end),getMealsByDateRange(start,end),getWaterRecordsByDateRange(start,end),getLatestWeight(start),getWeightByDateRange(start,end)]);
 const goalRows = [...changes.data,...(baseline ? [baseline] : [])];
 return aggregateSteps(steps,start,end).daily.map(day => {
  const date = day.date; const goals = selectCurrentGoals(goalRows,date);
  const latest = [...weights,...(weightBefore ? [weightBefore] : [])].filter(row => timestampDateKey(row.recorded_at) <= date).sort((a,b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime() || b.id.localeCompare(a.id))[0] ?? null;
  return buildDashboard(date,aggregateSteps(steps,date,date,goals?.daily_steps ?? null),aggregateSleep(sleep,date,date),aggregateNutrition(meals,date,date,goals?.daily_calories ?? null),aggregateWater(water,date,date,goals?.daily_water_ml ?? null),latest,profile,goals);
 });
}

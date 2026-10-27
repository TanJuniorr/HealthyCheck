import type { FoodRow, HealthGoalRow, StepRecordRow, SleepRecordRow, WeightRecordRow, WaterRecordRow } from '../types/database';
import type { DailyStepsSummary, WeeklyStepsSummary, SleepSummary, MealWithFood, Nutrition, NutritionSummary, WaterSummary, WeightTrend } from '../types/health';
import { getDaysInRange, timestampDateKey, timestamp } from './dateUtils';
import { safeNumber, positive, nonnegative } from './dataValidation';
import { DataAccessError } from './dataErrors';
export function goalProgress(value: number, goal: number | null | undefined): number | null { return Number.isFinite(value) && goal != null && Number.isFinite(goal) && goal > 0 ? Math.min(100, Math.max(0, value / goal * 100)) : null; }
export function calculateBMI(weightKg: unknown, heightCm: unknown): number | null {
 try { const weight = positive(weightKg); const height = positive(heightCm); const bmi = weight / ((height / 100) ** 2); return Number.isFinite(bmi) ? bmi : null; } catch { return null; }
}
export function calculateFoodNutrition(food: FoodRow, quantityGrams: number): Nutrition {
 const ratio = positive(quantityGrams) / 100;
 return { calories: safeNumber(nonnegative(food.calories_per_100g) * ratio), protein: safeNumber(nonnegative(food.protein_per_100g) * ratio), carbs: safeNumber(nonnegative(food.carbs_per_100g) * ratio), fat: safeNumber(nonnegative(food.fat_per_100g) * ratio) };
}
export function getFoodServingGrams(food: Pick<FoodRow, 'serving_size'>): number | null {
 const match = /^\s*(\d+(?:\.\d+)?)\s*(g|grams?|kg)\s*$/i.exec(food.serving_size ?? '');
 if (!match) return null; const grams = Number(match[1]) * (match[2].toLowerCase() === 'kg' ? 1000 : 1); return grams > 0 && Number.isFinite(grams) ? grams : null;
}
export function aggregateSteps(rows: StepRecordRow[], start: string, end: string, goal: number | null = null): WeeklyStepsSummary {
 const daily: DailyStepsSummary[] = getDaysInRange(start,end).map(date => {
  const records = rows.filter(row => row.record_date === date); const totalSteps = records.reduce((sum,row) => sum + safeNumber(row.steps),0);
  return { date, totalSteps, hasRecords: records.length > 0, recordCount: records.length, distanceKm: records.length && records.every(row => row.distance_km !== null) ? records.reduce((sum,row) => sum + safeNumber(row.distance_km),0) : null, activeMinutes: records.length && records.every(row => row.active_minutes !== null) ? records.reduce((sum,row) => sum + safeNumber(row.active_minutes),0) : null, goal, progressPercent: goalProgress(totalSteps,goal) };
 });
 const totalSteps = daily.reduce((sum,row) => sum + row.totalSteps,0);
 const recorded = daily.filter(row => row.hasRecords);
 return { startDate: start, endDate: end, daily, totalSteps, averageDailySteps: totalSteps / daily.length, daysWithRecords: recorded.length, daysWithActivity: daily.filter(row => row.totalSteps > 0).length, bestDay: recorded.length ? recorded.reduce((best,row) => row.totalSteps > best.totalSteps ? row : best) : null };
}
export function sleepDurationMinutes(start: string, end: string) { const duration = (Date.parse(timestamp(end)) - Date.parse(timestamp(start))) / 60000; if (!Number.isFinite(duration) || duration <= 0) throw new DataAccessError('INVALID_INPUT','Giấc ngủ cần thời điểm bắt đầu/kết thúc hợp lệ.'); return duration; }
export function aggregateSleep(rows: SleepRecordRow[], start: string, end: string): SleepSummary {
 // Count repeated copies of a row/interval only once; retain distinct naps on a day.
 const seenIds = new Set<string>(), seenIntervals = new Set<string>();
 rows = rows.filter(row => {
  const interval = `${row.user_id}:${Date.parse(row.sleep_start)}:${Date.parse(row.sleep_end)}`;
  if (seenIds.has(row.id) || seenIntervals.has(interval)) return false;
  seenIds.add(row.id); seenIntervals.add(interval); return true;
 });
 const daily = getDaysInRange(start,end).map(date => { const records = rows.filter(row => timestampDateKey(row.sleep_end) === date); return { date, minutes: records.length ? records.reduce((sum,row) => sum + sleepDurationMinutes(row.sleep_start,row.sleep_end),0) : null, sessionCount: records.length }; });
 const included = rows.filter(row => { const date = timestampDateKey(row.sleep_end); return date >= start && date <= end; });
 const totalMinutes = daily.reduce((sum,row) => sum + (row.minutes ?? 0),0); const qualities = included.filter(row => row.quality_rating !== null);
 const latestSession = [...included].sort((a,b) => Date.parse(b.sleep_end) - Date.parse(a.sleep_end) || b.id.localeCompare(a.id))[0] ?? null;
 return { daily, totalMinutes, averageDurationMinutes: included.length ? totalMinutes / included.length : null, averageDailyMinutes: included.length ? totalMinutes / daily.filter(row => row.sessionCount > 0).length : null, latestSession, averageQualityRating: qualities.length ? qualities.reduce((sum,row) => sum + row.quality_rating!,0) / qualities.length : null };
}
const zeroNutrition = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
function sumNutrition(target: Nutrition, source: Nutrition) { target.calories = safeNumber(target.calories + source.calories); target.protein = safeNumber(target.protein + source.protein); target.carbs = safeNumber(target.carbs + source.carbs); target.fat = safeNumber(target.fat + source.fat); }
export function aggregateNutrition(rows: MealWithFood[], start: string, end: string, calorieGoal: number | null = null): NutritionSummary {
 const daily = getDaysInRange(start,end).map(date => ({ date, ...zeroNutrition(), hasRecords: false }));
 const byMealType = { breakfast: zeroNutrition(), lunch: zeroNutrition(), dinner: zeroNutrition(), snack: zeroNutrition() }; const total = zeroNutrition(); let recordCount = 0;
 for (const row of rows) {
  const day = daily.find(item => item.date === timestampDateKey(row.consumed_at)); if (!day) continue;
  if (!row.food) throw new DataAccessError('NOT_FOUND','Không tìm thấy thực phẩm liên quan. Không thể tính dinh dưỡng chính xác.');
  const nutrition = calculateFoodNutrition(row.food, positive(row.quantity_g));
  sumNutrition(total,nutrition); sumNutrition(byMealType[row.meal_type],nutrition); sumNutrition(day,nutrition); day.hasRecords = true; recordCount++;
 }
 return { ...total, byMealType, daily, recordCount, hasRecords: recordCount > 0, calorieGoal: start === end ? calorieGoal : null, progressPercent: start === end ? goalProgress(total.calories,calorieGoal) : null };
}
export function aggregateWater(rows: WaterRecordRow[], start: string, end: string, goalMl: number | null = null): WaterSummary {
 const daily = getDaysInRange(start,end).map(date => { const records = rows.filter(row => timestampDateKey(row.recorded_at) === date); return { date, totalMl: records.reduce((sum,row) => sum + safeNumber(row.amount_ml),0), hasRecords: records.length > 0 }; });
 const totalMl = daily.reduce((sum,row) => sum + row.totalMl,0); return { daily, totalMl, hasRecords: daily.some(row => row.hasRecords), goalMl, progressPercent: goalProgress(totalMl,goalMl) };
}
export function aggregateWeight(rows: WeightRecordRow[], start: string, end: string): WeightTrend {
 const ordered = [...rows].sort((a,b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime() || a.id.localeCompare(b.id));
 const byDay = new Map<string,WeightRecordRow>();
 for (const row of ordered) { const day = timestampDateKey(row.recorded_at); if (day >= start && day <= end) byDay.set(day,row); }
 const points = [...byDay].sort(([a],[b]) => a.localeCompare(b)).map(([date,row]) => ({ date, weightKg: safeNumber(row.weight_kg) }));
 return { points, latest: [...byDay.values()].at(-1) ?? null, changeKg: points.length > 1 ? points[points.length-1].weightKg - points[0].weightKg : null };
}
export function selectCurrentGoals(rows: HealthGoalRow[], date: string) { return [...rows].filter(row => row.effective_from <= date).sort((a,b) => b.effective_from.localeCompare(a.effective_from) || Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id))[0] ?? null; }

import type { HealthReport, ReportDay, ReportMetric, ReportSource } from '../types/healthReport';
import { aggregateNutrition, aggregateSleep, aggregateSteps, aggregateWater, calculateBMI, selectCurrentGoals } from './healthCalculations';
import { getDaysInRange, shiftDay, timestampDateKey, toLocalDateKey, validateDateRange } from './dateUtils';
import { nonnegative, positive } from './dataValidation';
import { DataAccessError } from './dataErrors';

export const MAX_REPORT_DAYS = 90;
export function validateReportRange(start: string, end: string, today = toLocalDateKey()) {
  try { validateDateRange(start, end); } catch { throw new DataAccessError('INVALID_INPUT', 'report.invalidRange'); }
  if (end > today) throw new DataAccessError('INVALID_INPUT', 'report.futureRange');
  if (end > shiftDay(start, MAX_REPORT_DAYS - 1)) throw new DataAccessError('INVALID_INPUT', 'report.rangeLimit');
  return { start, end };
}
const validGoal = (value: number | null | undefined) => value != null && Number.isFinite(value) && value > 0 ? value : null;
function metric(daily: ReportDay[]): ReportMetric {
  const recorded = daily.filter((day): day is ReportDay & { value: number } => day.value !== null);
  const eligible = recorded.filter(day => day.goal !== null);
  const total = recorded.length ? recorded.reduce((sum, day) => sum + day.value, 0) : null;
  return {
    daily, total, average: total === null ? null : total / recorded.length,
    recordedDays: recorded.length, eligibleDays: eligible.length,
    achievedDays: eligible.filter(day => day.value >= day.goal!).length,
    best: recorded.reduce<ReportDay | null>((best, day) => best === null || day.value > best.value! ? day : best, null),
    least: recorded.reduce<ReportDay | null>((least, day) => least === null || day.value < least.value! ? day : least, null),
  };
}

export function buildHealthReport(source: ReportSource, start: string, end: string, now = new Date()): HealthReport {
  validateReportRange(start, end, toLocalDateKey(now));
  const days = getDaysInRange(start, end);
  const rows = [...source.steps, ...source.sleep, ...source.water, ...source.meals, ...source.weights, ...source.goals, ...(source.latestWeight ? [source.latestWeight] : [])];
  if (rows.some(row => row.user_id !== source.owner) || (source.profile && source.profile.id !== source.owner)) {
    throw new DataAccessError('AUTH_CHANGED', 'report.accountChanged');
  }
  // Refuse incomplete food totals, rather than silently treating absent nutrients as zero.
  try {
    for (const meal of source.meals) {
      if (!meal.food) throw new Error('Missing food');
      positive(meal.quantity_g);
      for (const value of [meal.food.calories_per_100g, meal.food.protein_per_100g, meal.food.carbs_per_100g, meal.food.fat_per_100g]) nonnegative(value);
    }
  } catch { throw new DataAccessError('DATABASE', 'report.incompleteNutrition'); }
  const goalByDay = new Map(days.map(date => [date, selectCurrentGoals(source.goals, date)]));
  const stepsSummary = aggregateSteps(source.steps, start, end);
  const sleepSummary = aggregateSleep(source.sleep, start, end);
  const waterSummary = aggregateWater(source.water, start, end);
  const nutritionSummary = aggregateNutrition(source.meals, start, end);
  const steps = metric(stepsSummary.daily.map(day => ({ date: day.date, value: day.hasRecords ? day.totalSteps : null, goal: validGoal(goalByDay.get(day.date)?.daily_steps) })));
  const sleep = metric(sleepSummary.daily.map(day => ({ date: day.date, value: day.minutes, goal: validGoal(goalByDay.get(day.date)?.target_sleep_minutes) })));
  const water = metric(waterSummary.daily.map(day => ({ date: day.date, value: day.hasRecords ? day.totalMl : null, goal: validGoal(goalByDay.get(day.date)?.daily_water_ml) })));
  const nutrition = metric(nutritionSummary.daily.map(day => ({ date: day.date, value: day.hasRecords ? day.calories : null, goal: validGoal(goalByDay.get(day.date)?.daily_calories) })));
  // Calories are displayed against their target, never scored as "more is better".
  nutrition.eligibleDays = 0;
  nutrition.achievedDays = 0;
  const points = [...source.weights].filter(row => {
    const date = timestampDateKey(row.recorded_at);
    return date >= start && date <= end;
  }).sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || a.id.localeCompare(b.id))
    .map(row => ({ date: timestampDateKey(row.recorded_at), timestamp: row.recorded_at, value: positive(row.weight_kg) }));
  const latest = source.latestWeight && timestampDateKey(source.latestWeight.recorded_at) <= end ? source.latestWeight : null;
  if (latest) positive(latest.weight_kg);
  let eligibleDays = 0, achievedDays = 0;
  for (let i = 0; i < days.length; i++) {
    const configured = [steps.daily[i], sleep.daily[i], water.daily[i]].filter(day => day.goal !== null);
    if (configured.length && configured.every(day => day.value !== null)) {
      eligibleDays++;
      if (configured.every(day => day.value! >= day.goal!)) achievedDays++;
    }
  }
  const recorded = new Set<string>(points.map(point => point.date));
  for (const group of [steps, sleep, water, nutrition]) for (const day of group.daily) if (day.value !== null) recorded.add(day.date);
  return {
    owner: source.owner, start, end, generatedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    profile: source.profile, dayCount: days.length, daysWithData: recorded.size,
    steps, sleep: { ...sleep, quality: sleepSummary.averageQualityRating }, water,
    nutrition: { ...nutrition, macros: nutritionSummary.hasRecords ? {
      calories: nutritionSummary.calories, protein: nutritionSummary.protein, carbs: nutritionSummary.carbs, fat: nutritionSummary.fat,
    } : null },
    weight: { latest, points, change: points.length >= 2 ? points.at(-1)!.value - points[0].value : null,
      bmi: calculateBMI(latest?.weight_kg, source.profile?.height_cm) },
    goals: { eligibleDays, achievedDays },
  };
}

/** At most thirteen weekly buckets. Missing days stay missing; zeros remain observations. */
export function reportChartBuckets(daily: ReportDay[]) {
  const size = daily.length > 14 ? 7 : 1;
  return Array.from({ length: Math.ceil(daily.length / size) }, (_, index) => {
    const bucket = daily.slice(index * size, (index + 1) * size);
    const recorded = bucket.filter(day => day.value !== null);
    const targeted = recorded.filter(day => day.goal !== null);
    return { date: bucket[0].date, end: bucket.at(-1)!.date, count: recorded.length, days: bucket.length,
      value: recorded.length ? recorded.reduce((sum, day) => sum + day.value!, 0) / recorded.length : null,
      goal: targeted.length === recorded.length && targeted.length ? targeted.reduce((sum, day) => sum + day.goal!, 0) / targeted.length : null };
  });
}

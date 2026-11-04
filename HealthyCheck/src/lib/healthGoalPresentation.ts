import i18n from '../i18n/index';
import { formatNumber } from '../i18n/formatting';
import type { GoalValues } from './healthGoalEditing';
import type { ProfileGender } from '../types/database';
import { CALORIE_SCREENING } from './calorieRecommendationConfig';
import { STEP_POLICY } from './stepRecommendationConfig';

/** Presentation only. These notes never approve, reject or modify a saved goal. */
export function lowGoalNotes(values: Partial<Record<keyof GoalValues,number|null>>, gender?: ProfileGender | null): ('calories' | 'steps')[] {
  const notes: ('calories' | 'steps')[] = [];
  const calorieReference = gender === 'male' || gender === 'female'
    ? CALORIE_SCREENING.lowEnergyCalories[gender]
    : Math.min(...Object.values(CALORIE_SCREENING.lowEnergyCalories));
  if (typeof values.daily_calories === 'number' && Number.isFinite(values.daily_calories) && values.daily_calories >= 0 && values.daily_calories < calorieReference) notes.push('calories');
  if (typeof values.daily_steps === 'number' && Number.isFinite(values.daily_steps) && values.daily_steps >= 0 && values.daily_steps < STEP_POLICY.lowBaselineSteps) notes.push('steps');
  return notes;
}

export function formatGoalDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return i18n.t('goals.notSet');
  const total = Math.round(value), hours = Math.floor(total / 60), minutes = total % 60;
  if (hours && minutes) return i18n.t('units.duration', { hours: formatNumber(hours), minutes: formatNumber(minutes) });
  return hours ? i18n.t('goals.hoursOnly', { value: formatNumber(hours) }) : i18n.t('goals.minutesOnly', { value: formatNumber(minutes) });
}

export function formatGoalAmount(key: keyof GoalValues, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return i18n.t('goals.notSet');
  if (key === 'target_sleep_minutes') return formatGoalDuration(value);
  const unit = key === 'daily_calories' ? 'kcal' : key === 'daily_water_ml' ? 'ml' : i18n.t('units.steps');
  return i18n.t('goals.dailyAmount', { value: formatNumber(value, 0), unit });
}

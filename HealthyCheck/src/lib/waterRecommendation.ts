import type { ActivityLevel, Numeric, WeightGoal } from '../types/database';
import { ageFromBirthDate } from './healthOnboarding';
import { isActivityLevel, isWeightGoal } from './healthPreferences';
import { toLocalDateKey } from './dateUtils';
import { WATER_ACTIVITY_ADJUSTMENTS, WATER_LIMITATIONS, WATER_POLICY } from './waterRecommendationConfig';

export type WaterRecommendationInput = {
  age?: number | null; // Pure callers may provide age; services derive it from the birth date.
  dateOfBirth?: string | null;
  weightKg?: Numeric | null;
  activityLevel?: ActivityLevel | null;
  weightGoal?: WeightGoal | null; // Context only, never changes the estimate.
  fluidRestrictionRequired?: boolean | null;
};
type WaterData = {
  age: number; weightKg: number; activityLevel: ActivityLevel;
  baseWaterMl: number; activityAdjustmentMl: number;
  fluidRestrictionAssessment: 'not_assessed' | 'reported_not_required' | 'reported_required';
};
type WaterMetadata = {
  recommendationMethod: 'weight_based_drinking_fluid_estimate';
  confidence: 'low';
  limitations: typeof WATER_LIMITATIONS;
  explanationKey: string;
};
export type WaterRecommendationResult = WaterMetadata & (
  | ({ status: 'success'; recommendedWaterMl: number } & WaterData)
  | { status: 'missing_data'; reason: 'required_fields_missing'; missingFields: string[]; data: Partial<WaterData> }
  | { status: 'out_of_scope'; reason: 'invalid_data' | 'under_18'; invalidFields: string[]; data: Partial<WaterData> }
  | { status: 'needs_review'; reason: 'fluid_restriction' | 'unusual_weight' | 'unusual_water_estimate'; data: Partial<WaterData> & { candidateWaterMl?: number } }
);
const missing = (value: unknown) => value == null || (typeof value === 'string' && !value.trim());
export function calculateWaterRecommendation(input: WaterRecommendationInput, referenceDate = toLocalDateKey()): WaterRecommendationResult {
  const meta: WaterMetadata = { recommendationMethod: 'weight_based_drinking_fluid_estimate', confidence: 'low', limitations: WATER_LIMITATIONS, explanationKey: 'recommendations.water.drinkingFluidsEstimate' };
  const data: Partial<WaterData> = { fluidRestrictionAssessment: 'not_assessed' };
  const invalidFields: string[] = [], missingFields: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...meta, explanationKey: 'recommendations.water.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields: ['input'], data };
  let today: string;
  try { today = toLocalDateKey(referenceDate); } catch { return { ...meta, explanationKey: 'recommendations.water.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields: ['referenceDate'], data }; }
  for (const field of ['weightKg', 'activityLevel'] as const) if (missing(input[field])) missingFields.push(field);
  if (missing(input.dateOfBirth) && missing(input.age)) missingFields.push('age');
  const birthAge = typeof input.dateOfBirth === 'string' ? ageFromBirthDate(input.dateOfBirth, today) : null;
  const suppliedAge = typeof input.age === 'number' && Number.isInteger(input.age) && input.age >= 0 && input.age <= WATER_POLICY.maxAge ? input.age : null;
  const age = !missing(input.dateOfBirth) ? birthAge : suppliedAge;
  const weightKg = typeof input.weightKg === 'number' ? input.weightKg : typeof input.weightKg === 'string' && /^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.weightKg.trim()) ? Number(input.weightKg) : null;
  const validWeight = weightKg !== null && Number.isFinite(weightKg) && weightKg > 0 && weightKg <= WATER_POLICY.maxValidWeightKg;
  if (!missing(input.dateOfBirth) && (birthAge === null || birthAge > WATER_POLICY.maxAge)) invalidFields.push('dateOfBirth');
  if (!missing(input.age) && (suppliedAge === null || (!missing(input.dateOfBirth) && suppliedAge !== birthAge))) invalidFields.push('age');
  if (!missing(input.weightKg) && !validWeight) invalidFields.push('weightKg');
  if (!missing(input.activityLevel) && !isActivityLevel(input.activityLevel)) invalidFields.push('activityLevel');
  if (!missing(input.weightGoal) && !isWeightGoal(input.weightGoal)) invalidFields.push('weightGoal');
  if (input.fluidRestrictionRequired != null && typeof input.fluidRestrictionRequired !== 'boolean') invalidFields.push('fluidRestrictionRequired');
  if (age !== null && age <= WATER_POLICY.maxAge) data.age = age;
  if (validWeight) data.weightKg = weightKg;
  if (isActivityLevel(input.activityLevel)) data.activityLevel = input.activityLevel;
  if (invalidFields.length) return { ...meta, explanationKey: 'recommendations.water.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields, data };
  if (age !== null && age < WATER_POLICY.minAge) return { ...meta, explanationKey: 'recommendations.water.under18', status: 'out_of_scope', reason: 'under_18', invalidFields: [], data };
  if (input.fluidRestrictionRequired === true) return { ...meta, explanationKey: 'recommendations.water.fluidRestriction', status: 'needs_review', reason: 'fluid_restriction', data: { ...data, fluidRestrictionAssessment: 'reported_required' } };
  if (missingFields.length || age === null || !validWeight || weightKg === null || !isActivityLevel(input.activityLevel)) return { ...meta, explanationKey: 'recommendations.water.missingData', status: 'missing_data', reason: 'required_fields_missing', missingFields, data };
  const fluidRestrictionAssessment = input.fluidRestrictionRequired === false ? 'reported_not_required' : 'not_assessed';
  const baseWaterMl = weightKg * WATER_POLICY.mlPerKg, activityAdjustmentMl = WATER_ACTIVITY_ADJUSTMENTS[input.activityLevel];
  const candidateWaterMl = baseWaterMl + activityAdjustmentMl;
  const details: WaterData = { age, weightKg, activityLevel: input.activityLevel, baseWaterMl, activityAdjustmentMl, fluidRestrictionAssessment };
  if (weightKg < WATER_POLICY.minWeightForAutomaticEstimate || weightKg > WATER_POLICY.maxWeightForAutomaticEstimate) return { ...meta, explanationKey: 'recommendations.water.reviewWeight', status: 'needs_review', reason: 'unusual_weight', data: { ...details, candidateWaterMl } };
  if (!Number.isFinite(candidateWaterMl) || candidateWaterMl < WATER_POLICY.minAutomaticMl || candidateWaterMl > WATER_POLICY.maxAutomaticMl) return { ...meta, explanationKey: 'recommendations.water.reviewEstimate', status: 'needs_review', reason: 'unusual_water_estimate', data: details };
  const recommendedWaterMl = Math.round(candidateWaterMl / WATER_POLICY.roundingMl) * WATER_POLICY.roundingMl;
  return { ...meta, ...details, status: 'success', recommendedWaterMl };
}

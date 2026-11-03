import type { ActivityLevel, Numeric, ProfileGender, WeightGoal } from '../types/database';
import { safeNumber } from './dataValidation';
import { toLocalDateKey } from './dateUtils';
import { calculateBMI } from './healthCalculations';
import { ageFromBirthDate } from './healthOnboarding';
import { isActivityLevel, isWeightGoal } from './healthPreferences';
import {
  ACTIVITY_MULTIPLIERS, CALORIE_ESTIMATE_LIMITATIONS, CALORIE_GOAL_STRATEGIES,
  CALORIE_METHOD, CALORIE_POLICY_VERSION, CALORIE_SCREENING,
} from './calorieRecommendationConfig';

export type FormulaSex = Extract<ProfileGender, 'male' | 'female'>;
export type CalorieRecommendationInput = {
  dateOfBirth?: string | null;
  gender?: ProfileGender | null;
  heightCm?: Numeric | null;
  weightKg?: Numeric | null;
  activityLevel?: ActivityLevel | null;
  weightGoal?: WeightGoal | null;
};
type InputField = keyof CalorieRecommendationInput;
export type CalorieCalculationData = {
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  weightGoal: WeightGoal;
  calorieAdjustment: number;
};
type ResultMetadata = {
  calculationMethod: typeof CALORIE_METHOD;
  policyVersion: typeof CALORIE_POLICY_VERSION;
  limitations: typeof CALORIE_ESTIMATE_LIMITATIONS;
};
// Only success exposes recommendedCalories. A review candidate cannot be
// accidentally consumed as an accepted goal without narrowing the status first.
export type CalorieRecommendationResult = ResultMetadata & (
  | ({ status: 'success'; recommendedCalories: number } & CalorieCalculationData)
  | { status: 'missing_data'; reason: 'required_fields_missing' | 'formula_coefficient_required'; missingFields: InputField[]; data: Partial<CalorieCalculationData> }
  | { status: 'out_of_scope'; reason: 'invalid_data' | 'under_18'; invalidFields: (InputField | 'referenceDate')[]; data: Partial<CalorieCalculationData> }
  | { status: 'needs_review'; reason: 'nonpositive_energy_estimate' | 'underweight_deficit' | 'low_energy_estimate' | 'excessive_surplus'; data: Partial<CalorieCalculationData> & { candidateCalories?: number } }
);

const metadata: ResultMetadata = { calculationMethod: CALORIE_METHOD, policyVersion: CALORIE_POLICY_VERSION, limitations: CALORIE_ESTIMATE_LIMITATIONS };
const isFormulaSex = (value: unknown): value is FormulaSex => value === 'male' || value === 'female';
const isMissing = (value: unknown) => value == null || (typeof value === 'string' && !value.trim());
function numeric(value: unknown): number | null {
  // Accept PostgreSQL numeric strings, without coercing booleans, arrays or hex.
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  try { return safeNumber(value); } catch { return null; }
}
function height(value: unknown): number | null {
  const n = numeric(value);
  return n !== null && n >= CALORIE_SCREENING.minHeightCm && n <= CALORIE_SCREENING.maxHeightCm ? n : null;
}
function weight(value: unknown): number | null {
  const n = numeric(value);
  return n !== null && n > 0 && n <= CALORIE_SCREENING.maxWeightKg ? n : null;
}

/** Simplified Mifflin–St Jeor REE estimate (called BMR in the app), kcal/day.
 * https://pubmed.ncbi.nlm.nih.gov/2305711/ — gender is a proxy, not a biological assessment.
 * Helpers return null for invalid inputs; recommendation safety rules live below.
 */
export function calculateBMR(input: { age: number; gender: FormulaSex; heightCm: Numeric; weightKg: Numeric }): number | null {
  if (!input || typeof input !== 'object') return null;
  const h = height(input.heightCm), w = weight(input.weightKg);
  if (!Number.isInteger(input.age) || input.age < CALORIE_SCREENING.minAge || input.age > CALORIE_SCREENING.maxAge || !isFormulaSex(input.gender) || h === null || w === null) return null;
  const bmr = 10 * w + 6.25 * h - 5 * input.age + (input.gender === 'male' ? 5 : -161);
  return Number.isFinite(bmr) && bmr > 0 ? bmr : null;
}

export function getActivityMultiplier(level: unknown): number | null {
  return isActivityLevel(level) ? ACTIVITY_MULTIPLIERS[level] : null;
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number | null {
  const multiplier = getActivityMultiplier(activityLevel);
  if (!Number.isFinite(bmr) || bmr <= 0 || multiplier === null) return null;
  const tdee = bmr * multiplier;
  return Number.isFinite(tdee) && tdee > 0 ? tdee : null;
}

/** Policy adjustment before screening. Does not by itself approve a recommendation. */
export function getCalorieAdjustment(tdee: number, goal: WeightGoal): number | null {
  if (!Number.isFinite(tdee) || tdee <= 0 || !isWeightGoal(goal)) return null;
  const strategy = CALORIE_GOAL_STRATEGIES[goal];
  if (strategy.kind === 'deficit') return -Math.min(strategy.maxCalories, tdee * strategy.maxTdeeFraction);
  return strategy.kind === 'surplus' ? strategy.calories : 0;
}

/** No rounding, defaults for missing health data, database reads or writes.
 * Pass a local YYYY-MM-DD reference date for deterministic calculations/tests.
 * Pregnancy, breastfeeding and medical nutrition needs are outside this estimate's design.
 */
export function calculateCalorieRecommendation(input: CalorieRecommendationInput, referenceDate = toLocalDateKey()): CalorieRecommendationResult {
  const data: Partial<CalorieCalculationData> = {};
  const invalidFields: (InputField | 'referenceDate')[] = [];
  const missingFields: InputField[] = [];
  // A malformed payload is distinct from an incomplete profile.
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...metadata, status: 'out_of_scope', reason: 'invalid_data', invalidFields: [], data };
  let today: string;
  try { today = toLocalDateKey(referenceDate); } catch { return { ...metadata, status: 'out_of_scope', reason: 'invalid_data', invalidFields: ['referenceDate'], data }; }
  for (const field of ['dateOfBirth', 'gender', 'heightCm', 'weightKg', 'activityLevel', 'weightGoal'] as const) {
    if (isMissing(input[field])) missingFields.push(field);
  }
  const age = typeof input.dateOfBirth === 'string' ? ageFromBirthDate(input.dateOfBirth, today) : null;
  const heightCm = height(input.heightCm), weightKg = weight(input.weightKg);
  if (!isMissing(input.dateOfBirth) && (age === null || age > CALORIE_SCREENING.maxAge)) invalidFields.push('dateOfBirth');
  else if (age !== null) data.age = age;
  if (!isMissing(input.heightCm) && heightCm === null) invalidFields.push('heightCm');
  else if (heightCm !== null) data.heightCm = heightCm;
  if (!isMissing(input.weightKg) && weightKg === null) invalidFields.push('weightKg');
  else if (weightKg !== null) data.weightKg = weightKg;
  const coefficientUnavailable = input.gender === 'other' || input.gender === 'prefer_not_to_say';
  if (!isMissing(input.gender) && !isFormulaSex(input.gender) && !coefficientUnavailable) invalidFields.push('gender');
  if (!isMissing(input.activityLevel) && !isActivityLevel(input.activityLevel)) invalidFields.push('activityLevel');
  if (!isMissing(input.weightGoal) && !isWeightGoal(input.weightGoal)) invalidFields.push('weightGoal');
  if (isWeightGoal(input.weightGoal)) data.weightGoal = input.weightGoal;
  const activityMultiplier = getActivityMultiplier(input.activityLevel);
  if (activityMultiplier !== null) data.activityMultiplier = activityMultiplier;
  const bmi = heightCm !== null && weightKg !== null ? calculateBMI(weightKg, heightCm) : null;
  if (bmi !== null) data.bmi = bmi;
  if (invalidFields.length) return { ...metadata, status: 'out_of_scope', reason: 'invalid_data', invalidFields, data };
  if (age !== null && age < CALORIE_SCREENING.minAge) return { ...metadata, status: 'out_of_scope', reason: 'under_18', invalidFields: [], data };
  const bmr = age !== null && isFormulaSex(input.gender) && heightCm !== null && weightKg !== null
    ? calculateBMR({ age, gender: input.gender, heightCm, weightKg }) : null;
  if (bmr !== null) data.bmr = bmr;
  const tdee = bmr !== null && isActivityLevel(input.activityLevel) ? calculateTDEE(bmr, input.activityLevel) : null;
  if (tdee !== null) data.tdee = tdee;
  if (coefficientUnavailable) missingFields.push('gender');
  if (missingFields.length) return { ...metadata, status: 'missing_data', reason: coefficientUnavailable ? 'formula_coefficient_required' : 'required_fields_missing', missingFields, data };
  if (age === null || heightCm === null || weightKg === null || bmi === null || bmr === null || tdee === null || activityMultiplier === null || !isWeightGoal(input.weightGoal) || !isFormulaSex(input.gender)) {
    return { ...metadata, status: 'needs_review', reason: 'nonpositive_energy_estimate', data };
  }
  const strategy = CALORIE_GOAL_STRATEGIES[input.weightGoal];
  if (strategy.kind === 'deficit' && bmi < CALORIE_SCREENING.underweightBmi) return { ...metadata, status: 'needs_review', reason: 'underweight_deficit', data };
  const calorieAdjustment = getCalorieAdjustment(tdee, input.weightGoal);
  if (calorieAdjustment === null) return { ...metadata, status: 'needs_review', reason: 'nonpositive_energy_estimate', data };
  const candidateCalories = tdee + calorieAdjustment;
  data.calorieAdjustment = calorieAdjustment;
  if (!Number.isFinite(candidateCalories) || candidateCalories <= 0) return { ...metadata, status: 'needs_review', reason: 'nonpositive_energy_estimate', data };
  const reviewData = { ...data, candidateCalories };
  if (strategy.kind === 'surplus' && calorieAdjustment > tdee * CALORIE_SCREENING.maxSurplusTdeeFraction) return { ...metadata, status: 'needs_review', reason: 'excessive_surplus', data: reviewData };
  // Also screen maintenance/gain estimates: a positive number alone isn't approval.
  if (candidateCalories < CALORIE_SCREENING.lowEnergyCalories[input.gender]) return { ...metadata, status: 'needs_review', reason: 'low_energy_estimate', data: reviewData };
  return { ...metadata, status: 'success', age, heightCm, weightKg, bmi, bmr, activityMultiplier, tdee, weightGoal: input.weightGoal, calorieAdjustment, recommendedCalories: candidateCalories };
}

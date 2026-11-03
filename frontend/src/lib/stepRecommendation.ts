import type { ActivityLevel, WeightGoal } from '../types/database';
import { ageFromBirthDate } from './healthOnboarding';
import { isActivityLevel, isWeightGoal } from './healthPreferences';
import { shiftDay, toLocalDateKey } from './dateUtils';
import { STEP_GOAL_INCREMENTS, STEP_LIMITATIONS, STEP_POLICY, STEP_STARTING_TARGETS } from './stepRecommendationConfig';

/** A daily total with explicit acquisition quality. Complete means independently
 * verified coverage of the full local day, including a verified zero-step day.
 * Never infer complete coverage from a positive count, row timestamps or sample volume.
 */
export type StepHistoryDay = {
  date: string;
  steps: number;
  coverage: 'complete' | 'partial' | 'unknown' | 'unavailable';
  source: 'device' | 'verified_import' | 'legacy_step_record' | 'simulated';
};
export type StepRecommendationInput = {
  dateOfBirth?: string | null;
  activityLevel?: ActivityLevel | null;
  weightGoal?: WeightGoal | null;
  history?: readonly StepHistoryDay[];
};
export type StepHistorySummary = {
  baselineSteps: number | null;
  validHistoryDays: number;
  observedHistoryDays: number;
  excludedHistoryDays: number;
  historyQuality: 'none' | 'unverified' | 'insufficient' | 'verified';
};
type StepMetadata = {
  recommendationMethod: 'activity_starting_point' | 'verified_history_progression';
  confidence: 'low' | 'moderate';
  explanationKey: string;
  limitations: typeof STEP_LIMITATIONS;
};
type StepData = StepHistorySummary & {
  age: number;
  ageGroup: 'adult_under_60' | 'adult_60_plus';
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  referenceRange: Readonly<{ min: number; max: number }>;
};
export type StepRecommendationResult = StepMetadata & (
  | ({ status: 'success'; recommendedSteps: number } & StepData)
  | { status: 'missing_data'; reason: 'required_fields_missing'; missingFields: string[]; data: Partial<StepData> }
  | { status: 'out_of_scope'; reason: 'invalid_data' | 'under_18'; invalidFields: string[]; data: Partial<StepData> }
  | { status: 'needs_review'; reason: 'unusual_baseline'; data: StepData }
);
const missing = (value: unknown) => value == null || (typeof value === 'string' && !value.trim());

/** Use only unique, verified, completed local days within the last 14 days.
 * Duplicate daily totals are ambiguous, so exclude that whole day rather than
 * sum snapshots or silently double the baseline. Missing days never become zero.
 */
export function summarizeStepHistory(history: readonly StepHistoryDay[], referenceDate: string): StepHistorySummary {
  const today = toLocalDateKey(referenceDate), start = shiftDay(today, -STEP_POLICY.historyDays);
  const byDay = new Map<string, StepHistoryDay[]>();
  for (const day of history) {
    if (!day || typeof day.date !== 'string') continue;
    try { toLocalDateKey(day.date); } catch { continue; }
    if (day.date < start || day.date >= today) continue;
    const rows = byDay.get(day.date) ?? []; rows.push(day); byDay.set(day.date, rows);
  }
  const valid: number[] = [];
  for (const rows of byDay.values()) {
    if (rows.length !== 1) continue;
    const day = rows[0];
    if (day.coverage !== 'complete' || !['device', 'verified_import'].includes(day.source)) continue;
    if (!Number.isSafeInteger(day.steps) || day.steps < 0 || day.steps > STEP_POLICY.maxPlausibleDailySteps) continue;
    valid.push(day.steps);
  }
  const sufficient = valid.length >= STEP_POLICY.minValidHistoryDays;
  return {
    baselineSteps: sufficient ? valid.reduce((sum, steps) => sum + steps, 0) / valid.length : null,
    validHistoryDays: valid.length,
    observedHistoryDays: byDay.size,
    excludedHistoryDays: byDay.size - valid.length,
    historyQuality: sufficient ? 'verified' : valid.length ? 'insufficient' : byDay.size ? 'unverified' : 'none',
  };
}

export function calculateStepRecommendation(input: StepRecommendationInput, referenceDate = toLocalDateKey()): StepRecommendationResult {
  const meta: StepMetadata = { recommendationMethod: 'activity_starting_point', confidence: 'low', explanationKey: 'recommendations.steps.startingPoint', limitations: STEP_LIMITATIONS };
  const data: Partial<StepData> = {};
  const invalidFields: string[] = [], missingFields: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...meta, explanationKey: 'recommendations.steps.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields: ['input'], data };
  let today: string;
  try { today = toLocalDateKey(referenceDate); } catch { return { ...meta, explanationKey: 'recommendations.steps.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields: ['referenceDate'], data }; }
  for (const key of ['dateOfBirth', 'activityLevel', 'weightGoal'] as const) if (missing(input[key])) missingFields.push(key);
  const age = typeof input.dateOfBirth === 'string' ? ageFromBirthDate(input.dateOfBirth, today) : null;
  if (!missing(input.dateOfBirth) && (age === null || age > STEP_POLICY.maxAge)) invalidFields.push('dateOfBirth');
  if (!missing(input.activityLevel) && !isActivityLevel(input.activityLevel)) invalidFields.push('activityLevel');
  if (!missing(input.weightGoal) && !isWeightGoal(input.weightGoal)) invalidFields.push('weightGoal');
  if (input.history !== undefined && !Array.isArray(input.history)) invalidFields.push('history');
  if (age !== null && age <= STEP_POLICY.maxAge) data.age = age;
  if (invalidFields.length) return { ...meta, explanationKey: 'recommendations.steps.invalidData', status: 'out_of_scope', reason: 'invalid_data', invalidFields, data };
  if (age !== null && age < STEP_POLICY.minAge) return { ...meta, explanationKey: 'recommendations.steps.under18', status: 'out_of_scope', reason: 'under_18', invalidFields: [], data };
  if (missingFields.length || age === null || !isActivityLevel(input.activityLevel) || !isWeightGoal(input.weightGoal)) return { ...meta, explanationKey: 'recommendations.steps.missingData', status: 'missing_data', reason: 'required_fields_missing', missingFields, data };
  const older = age >= STEP_POLICY.olderAge;
  const referenceRange = older ? STEP_POLICY.olderReference : STEP_POLICY.youngerReference;
  const history = summarizeStepHistory(input.history ?? [], today);
  const details: StepData = { ...history, age, ageGroup: older ? 'adult_60_plus' : 'adult_under_60', activityLevel: input.activityLevel, weightGoal: input.weightGoal, referenceRange };
  if (history.baselineSteps === null) {
    return { ...meta, ...details, status: 'success', recommendedSteps: Math.min(STEP_STARTING_TARGETS[input.activityLevel], referenceRange.max), explanationKey: `recommendations.steps.${history.historyQuality === 'unverified' ? 'unverifiedHistory' : history.historyQuality === 'insufficient' ? 'insufficientHistory' : 'startingPoint'}` };
  }
  const baseline = history.baselineSteps;
  const verifiedMeta: StepMetadata = { ...meta, recommendationMethod: 'verified_history_progression', confidence: 'moderate', explanationKey: 'recommendations.steps.gradualProgression' };
  if (baseline < STEP_POLICY.minBaselineForAutomaticTarget || baseline > STEP_POLICY.maxBaselineForAutomaticTarget) return { ...verifiedMeta, explanationKey: 'recommendations.steps.reviewBaseline', status: 'needs_review', reason: 'unusual_baseline', data: details };
  const conservative = older || baseline < STEP_POLICY.lowBaselineSteps;
  const increment = baseline >= referenceRange.max ? 0 : Math.min(
    STEP_GOAL_INCREMENTS[input.weightGoal],
    conservative ? STEP_POLICY.conservativeIncrement : Infinity,
    baseline * (conservative ? STEP_POLICY.conservativeIncreaseFraction : STEP_POLICY.maxIncreaseFraction),
    referenceRange.max - baseline,
  );
  // Round down once so rounding cannot breach the gradual-increase cap.
  const recommendedSteps = Math.floor((baseline + increment) / STEP_POLICY.roundingSteps) * STEP_POLICY.roundingSteps;
  return { ...verifiedMeta, ...details, status: 'success', recommendedSteps, explanationKey: recommendedSteps <= baseline ? 'recommendations.steps.maintainBaseline' : verifiedMeta.explanationKey };
}

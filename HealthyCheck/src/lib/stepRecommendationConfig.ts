import type { ActivityLevel, WeightGoal } from '../types/database';

// Initial product starting points, not CDC step prescriptions or immediate quotas.
export const STEP_STARTING_TARGETS = Object.freeze({
  sedentary: 4000, lightly_active: 5000, moderately_active: 7000, very_active: 8000, extremely_active: 9000,
} satisfies Record<ActivityLevel, number>);
export const STEP_GOAL_INCREMENTS = Object.freeze({
  lose_fat_slow: 500, lose_fat: 1000, maintain: 0, gain_weight_slow: 0, gain_weight: 0,
} satisfies Record<WeightGoal, number>);
export const STEP_POLICY = Object.freeze({
  minAge: 18, maxAge: 120, olderAge: 60,
  historyDays: 14, minValidHistoryDays: 4,
  roundingSteps: 100,
  lowBaselineSteps: 4000,
  conservativeIncrement: 500,
  maxIncreaseFraction: 0.15,
  conservativeIncreaseFraction: 0.1,
  // Product screening bounds, not medical limits. Do not silently clamp anomalies.
  minBaselineForAutomaticTarget: 500,
  maxBaselineForAutomaticTarget: 20000,
  maxPlausibleDailySteps: 50000,
  youngerReference: Object.freeze({ min: 8000, max: 10000 }),
  olderReference: Object.freeze({ min: 6000, max: 8000 }),
});
export const STEP_LIMITATIONS = Object.freeze({
  source: 'https://www.cdc.gov/physical-activity-basics/benefits/',
  targetsAreProductEstimates: true,
  ageRangesAreGradualReferencesNotImmediateQuotas: true,
  stepsDoNotReplaceDurationIntensityStrengthOrBalanceGuidance: true,
  doesNotGuaranteeWeightLoss: true,
  doesNotAdjustTdeeOrEstimateBurnedCalories: true,
  healthAndMobilityNotAssessed: true,
  // watchStepCount is a session counter; existing rows have no full-day coverage
  // or provenance marker. They must not be certified from steps/timestamps alone.
  legacyStepRecordsDoNotVerifyFullDayCoverage: true,
});

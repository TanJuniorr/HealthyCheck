import type { ActivityLevel, WeightGoal } from '../types/database';

// Conventional activity estimates, not measured energy expenditure. Steps must
// not be added to the resulting TDEE a second time.
export const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
} as const satisfies Record<ActivityLevel, number>);

type GoalStrategy =
  | { readonly kind: 'deficit'; readonly maxCalories: number; readonly maxTdeeFraction: number }
  | { readonly kind: 'maintain' }
  | { readonly kind: 'surplus'; readonly calories: number };

// Initial product policy, not a nutritional prescription. Keep policy changes
// here, separate from both the formula and the user's saved health_goals.
export const CALORIE_GOAL_STRATEGIES = Object.freeze({
  lose_fat_slow: Object.freeze({ kind: 'deficit', maxCalories: 250, maxTdeeFraction: 0.1 }),
  lose_fat: Object.freeze({ kind: 'deficit', maxCalories: 500, maxTdeeFraction: 0.2 }),
  maintain: Object.freeze({ kind: 'maintain' }),
  gain_weight_slow: Object.freeze({ kind: 'surplus', calories: 150 }),
  gain_weight: Object.freeze({ kind: 'surplus', calories: 300 }),
} as const satisfies Record<WeightGoal, GoalStrategy>);

export const CALORIE_SCREENING = Object.freeze({
  minAge: 18,
  maxAge: 120, // Input plausibility bound, not a validated age range for the equation.
  minHeightCm: 30,
  maxHeightCm: 300,
  maxWeightKg: 500,
  underweightBmi: 18.5,
  // Review thresholds only: these are not universal safe intake limits.
  lowEnergyCalories: Object.freeze({ male: 1500, female: 1200 }),
  // Product review rule for an unusually large surplus relative to a low TDEE.
  // Preserve the requested +150/+300 strategy; flag it rather than silently cap it.
  maxSurplusTdeeFraction: 0.2,
});

export const CALORIE_METHOD = 'mifflin_st_jeor' as const;
export const CALORIE_POLICY_VERSION = 'initial-v1' as const;
export const CALORIE_ESTIMATE_LIMITATIONS = Object.freeze({
  formulaSource: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  isEstimateNotMeasurement: true,
  activityFactorsAreConventionalEstimates: true,
  genderIsOnlyAProxyForFormulaCoefficient: true,
  adjustmentsAreInitialEstimates: true,
  screeningThresholdsAreNotUniversalSafetyLimits: true,
  // These conditions are not collected by the app. Do not infer their absence.
  notDesignedFor: Object.freeze(['pregnancy', 'breastfeeding', 'medical_nutrition_needs'] as const),
});

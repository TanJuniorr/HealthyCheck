import type { ActivityLevel } from '../types/database';

// Product heuristic for drinking fluids, not a measurement of total water needs.
// Do not subtract an assumed food fraction or equate this with logged plain water.
export const WATER_ACTIVITY_ADJUSTMENTS = Object.freeze({
  sedentary: 0, lightly_active: 150, moderately_active: 300, very_active: 450, extremely_active: 600,
} satisfies Record<ActivityLevel, number>);
export const WATER_POLICY = Object.freeze({
  minAge: 18, maxAge: 120,
  mlPerKg: 30,
  maxValidWeightKg: 500,
  minWeightForAutomaticEstimate: 40,
  maxWeightForAutomaticEstimate: 120,
  minAutomaticMl: 1200,
  maxAutomaticMl: 3500,
  roundingMl: 50,
});
export const WATER_LIMITATIONS = Object.freeze({
  source: 'https://www.nationalacademies.org/read/10925/chapter/6',
  heuristicIsProductPolicyNotAUniversalRequirement: true,
  activityAdjustmentIsNotMeasuredSweatLoss: true,
  screeningThresholdsAreNotUniversalMedicalLimits: true,
  dependsOnWeatherDietActualActivityAndHealth: true,
  doNotDrinkExtraJustToReachTheNumber: true,
  // No disease status is collected by profiles. Unknown does not mean healthy.
  requiresIndividualSuitabilityCheck: true,
  notDesignedFor: Object.freeze(['fluid_restriction', 'kidney_disease', 'heart_failure', 'pregnancy', 'breastfeeding', 'medical_nutrition_needs'] as const),
  intakeScope: 'drinking_fluids' as const,
  trackingScope: 'user_logged_water_entries' as const,
  isTotalWaterFromFoodAndBeverages: false,
  canApplyDirectlyToWaterOnlyGoal: false,
  foodWaterContributionMl: null,
  unloggedBeverageContributionMl: null,
});

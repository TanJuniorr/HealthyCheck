import type { ActivityLevel, WeightGoal } from '../types/database';

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'];
export const WEIGHT_GOALS: readonly WeightGoal[] = ['lose_fat_slow', 'lose_fat', 'maintain', 'gain_weight_slow', 'gain_weight'];

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return typeof value === 'string' && ACTIVITY_LEVELS.includes(value as ActivityLevel);
}

export function isWeightGoal(value: unknown): value is WeightGoal {
  return typeof value === 'string' && WEIGHT_GOALS.includes(value as WeightGoal);
}

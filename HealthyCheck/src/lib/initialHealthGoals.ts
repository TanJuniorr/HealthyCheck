import type { HealthOnboardingInput } from './healthOnboarding';
import { calculateCalorieRecommendation } from './calorieRecommendation';
import { calculateStepRecommendation } from './stepRecommendation';
import { recommendationValue } from './healthGoalEditing';
import { toLocalDateKey } from './dateUtils';

/** Use the same policies as the recommendation cards, without inventing targets
 * when a profile is outside their scope. Water keeps its separate acknowledgment. */
export function initialHealthGoals(input: HealthOnboardingInput, date = toLocalDateKey()) {
  const context = {
    dateOfBirth: input.date_of_birth,
    gender: input.gender,
    heightCm: input.height_cm,
    weightKg: input.weight_kg,
    activityLevel: input.activity_level,
    weightGoal: input.weight_goal,
  };
  return {
    daily_steps: recommendationValue('steps', calculateStepRecommendation(context, date)),
    daily_calories: recommendationValue('calories', calculateCalorieRecommendation(context, date)),
  };
}

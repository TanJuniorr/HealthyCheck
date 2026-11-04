import { calculateCalorieRecommendation, type CalorieRecommendationResult } from '../lib/calorieRecommendation';
import { HealthRecommendationSources } from './healthRecommendationSources';

/** Read-only, uncached estimate. Saved goals and consumed calories remain independent.
 * Requires the activity_level/weight_goal columns from the onboarding preferences migration.
 * Network/schema errors are propagated; they must not become missing data or a 2,000 kcal fallback.
 */
export async function getMyCalorieRecommendation(sources?: HealthRecommendationSources): Promise<CalorieRecommendationResult> {
  const context = sources ?? await HealthRecommendationSources.create();
  const [profile, latestWeight] = await Promise.all([context.getProfile(), context.getWeight()]);
  await context.assertCurrentIdentity();
  return calculateCalorieRecommendation({
    dateOfBirth: profile?.date_of_birth,
    gender: profile?.gender,
    heightCm: profile?.height_cm,
    weightKg: latestWeight?.weight_kg,
    activityLevel: profile?.activity_level,
    weightGoal: profile?.weight_goal,
  }, context.referenceDate);
}

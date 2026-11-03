import { calculateWaterRecommendation, type WaterRecommendationResult } from '../lib/waterRecommendation';
import { HealthRecommendationSources } from './healthRecommendationSources';

export async function getMyWaterRecommendation(sources?: HealthRecommendationSources): Promise<WaterRecommendationResult> {
  const context = sources ?? await HealthRecommendationSources.create();
  const [profile, latestWeight] = await Promise.all([context.getProfile(), context.getWeight()]);
  await context.assertCurrentIdentity();
  return calculateWaterRecommendation({
    dateOfBirth: profile?.date_of_birth,
    weightKg: latestWeight?.weight_kg,
    activityLevel: profile?.activity_level,
    weightGoal: profile?.weight_goal,
    // profiles does not collect fluid restrictions: leave the assessment unknown.
  }, context.referenceDate);
}

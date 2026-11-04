import { calculateStepRecommendation, type StepRecommendationResult } from '../lib/stepRecommendation';
import { HealthRecommendationSources } from './healthRecommendationSources';

export async function getMyStepRecommendation(sources?: HealthRecommendationSources): Promise<StepRecommendationResult> {
  const context = sources ?? await HealthRecommendationSources.create();
  const [profile, history] = await Promise.all([context.getProfile(), context.getStepHistory()]);
  await context.assertCurrentIdentity();
  return calculateStepRecommendation({
    dateOfBirth: profile?.date_of_birth,
    activityLevel: profile?.activity_level,
    weightGoal: profile?.weight_goal,
    history,
  }, context.referenceDate);
}

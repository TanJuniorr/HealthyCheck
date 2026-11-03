import type { CalorieRecommendationResult } from '../lib/calorieRecommendation';
import type { StepRecommendationResult } from '../lib/stepRecommendation';
import type { WaterRecommendationResult } from '../lib/waterRecommendation';
import { dataError, type DataErrorCode } from '../lib/dataErrors';
import { getMyCalorieRecommendation } from './calorieRecommendationService';
import { getMyStepRecommendation } from './stepRecommendationService';
import { getMyWaterRecommendation } from './waterRecommendationService';
import { HealthRecommendationSources } from './healthRecommendationSources';

export type RecommendationQueryError = { status: 'query_error'; error: { code: DataErrorCode; message: string } };
export type HealthRecommendations = {
  calories: CalorieRecommendationResult | RecommendationQueryError;
  steps: StepRecommendationResult | RecommendationQueryError;
  water: WaterRecommendationResult | RecommendationQueryError;
};

function outcome<T>(result: PromiseSettledResult<T>): T | RecommendationQueryError {
  if (result.status === 'fulfilled') return result.value;
  const error = dataError(result.reason);
  // Identity failures invalidate the whole response, not just one tile.
  if (error.code === 'AUTH_CHANGED' || error.code === 'UNAUTHENTICATED') throw error;
  return { status: 'query_error', error: { code: error.code, message: error.message } };
}

/** One fresh profile read, one latest weight read, one bounded step history read.
 * Query errors remain separate from missing profile fields; independent estimates
 * can still succeed. No health_goals/actual-intake reads or writes are performed.
 */
export async function getMyHealthRecommendations(): Promise<HealthRecommendations> {
  const context = await HealthRecommendationSources.create();
  const [calories, steps, water] = await Promise.allSettled([
    getMyCalorieRecommendation(context), getMyStepRecommendation(context), getMyWaterRecommendation(context),
  ]);
  await context.assertCurrentIdentity();
  return { calories: outcome(calories), steps: outcome(steps), water: outcome(water) };
}

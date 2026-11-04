import type { CalorieRecommendationResult } from '../lib/calorieRecommendation';
import type { StepRecommendationResult } from '../lib/stepRecommendation';
import type { WaterRecommendationResult } from '../lib/waterRecommendation';
import { DataAccessError, dataError, type DataErrorCode } from '../lib/dataErrors';
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
  return await getMySelectedHealthRecommendations(['calories','steps','water']) as HealthRecommendations;
}

/** Detail screens load only their requested estimates; absent keys mean not
 * requested, never missing health data. Shared reads stay request-scoped.
 */
export async function getMySelectedHealthRecommendations(kinds:readonly (keyof HealthRecommendations)[]):Promise<Partial<HealthRecommendations>> {
  if(!Array.isArray(kinds)||!kinds.length||kinds.some(kind=>!['calories','steps','water'].includes(kind))||new Set(kinds).size!==kinds.length)throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
  const context = await HealthRecommendationSources.create();
  const loaders={calories:()=>getMyCalorieRecommendation(context),steps:()=>getMyStepRecommendation(context),water:()=>getMyWaterRecommendation(context)};
  const results=await Promise.allSettled(kinds.map(kind=>loaders[kind as keyof HealthRecommendations]()));
  await context.assertCurrentIdentity();
  return Object.fromEntries(kinds.map((kind,index)=>[kind,outcome(results[index])]));
}

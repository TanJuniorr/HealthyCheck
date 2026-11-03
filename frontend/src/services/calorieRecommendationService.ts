import { calculateCalorieRecommendation, type CalorieRecommendationResult } from '../lib/calorieRecommendation';
import { DataAccessError } from '../lib/dataErrors';
import { toLocalDateKey } from '../lib/dateUtils';
import { getMyProfile } from './profileService';
import { assertIdentity, requireAuthenticatedUserId } from './queryCore';
import { getLatestWeight } from './weightService';

/** Read-only, uncached estimate. Saved goals and consumed calories remain independent.
 * Requires the activity_level/weight_goal columns from the onboarding preferences migration.
 * Network/schema errors are propagated; they must not become missing data or a 2,000 kcal fallback.
 */
export async function getMyCalorieRecommendation(): Promise<CalorieRecommendationResult> {
  const owner = await requireAuthenticatedUserId();
  const today = toLocalDateKey();
  const [profile, latestWeight] = await Promise.all([getMyProfile(), getLatestWeight(today)]);
  await assertIdentity(owner);
  // Check the rows as well as the live session, including an A -> B -> A switch
  // while the two existing services are loading independently.
  if ((profile && profile.id !== owner) || (latestWeight && latestWeight.user_id !== owner)) {
    throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
  }
  return calculateCalorieRecommendation({
    dateOfBirth: profile?.date_of_birth,
    gender: profile?.gender,
    heightCm: profile?.height_cm,
    weightKg: latestWeight?.weight_kg,
    activityLevel: profile?.activity_level,
    weightGoal: profile?.weight_goal,
  }, today);
}

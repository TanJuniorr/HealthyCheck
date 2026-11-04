import type { HealthGoalRow } from '../types/database';
import type { HealthRecommendations } from '../services/healthRecommendationService';
import { DataAccessError } from './dataErrors';
export const EDITABLE_GOAL_KEYS = ['daily_steps','daily_calories','daily_water_ml','target_sleep_minutes'] as const;
export type GoalValues = Record<(typeof EDITABLE_GOAL_KEYS)[number],number>;
export type GoalChanges = Partial<GoalValues>;
export type RecommendationKind = keyof HealthRecommendations;
export const RECOMMENDATION_GOAL_FIELDS = {
 calories: 'daily_calories',
 steps: 'daily_steps',
 water: 'daily_water_ml',
} as const satisfies Record<RecommendationKind, keyof GoalValues>;
export function goalValues(row: HealthGoalRow | null): GoalValues | null {
 if(!row)return null;
 if(EDITABLE_GOAL_KEYS.some(key=>row[key]==null||!Number.isInteger(row[key])||row[key]!<0))throw new DataAccessError('INVALID_INPUT','goals.completeFirst');
 return Object.fromEntries(EDITABLE_GOAL_KEYS.map(key=>[key,row[key]])) as GoalValues;
}
export function validateGoalChanges(changes: GoalChanges): GoalChanges {
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!EDITABLE_GOAL_KEYS.includes(key as keyof GoalValues)))throw new DataAccessError('INVALID_INPUT','goals.invalid');
 if(Object.values(changes).some(value=>!Number.isInteger(value)||value!<=0||value!>2147483647))throw new DataAccessError('INVALID_INPUT','goals.invalid');
 return {...changes};
}
export function recommendationValue(kind: RecommendationKind, result: HealthRecommendations[RecommendationKind] | null | undefined): number | null {
 if (!result || result.status !== 'success') return null;
 let value: number;
 if (kind === 'calories' && 'recommendedCalories' in result) {
  value = Math.round(result.recommendedCalories);
 } else if (kind === 'steps' && 'recommendedSteps' in result) {
  value = result.recommendedSteps;
 } else if (kind === 'water' && 'recommendedWaterMl' in result && result.fluidRestrictionAssessment !== 'reported_required') {
  value = result.recommendedWaterMl;
 } else {
  return null;
 }
 return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}
export function applicableGoalChanges(
 selected: readonly RecommendationKind[],
 recommendations: Partial<HealthRecommendations>,
 waterAcknowledged = false,
): GoalChanges {
 if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length)throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
 if(selected.includes('water') && (selected.length !== 1 || waterAcknowledged !== true)) {
  throw new DataAccessError('INVALID_INPUT', 'goals.waterConfirmationRequired');
 }
 const changes:GoalChanges={};
 for(const kind of selected as readonly RecommendationKind[]){
  if(!Object.hasOwn(RECOMMENDATION_GOAL_FIELDS, kind))throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
  const value=recommendationValue(kind,recommendations[kind]);
  if(value===null)throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
  changes[RECOMMENDATION_GOAL_FIELDS[kind]]=value;
 }
 return changes;
}

import type { HealthGoalRow } from '../types/database';
import type { HealthRecommendations } from '../services/healthRecommendationService';
import { DataAccessError } from './dataErrors';
export const EDITABLE_GOAL_KEYS = ['daily_steps','daily_calories','daily_water_ml','target_sleep_minutes'] as const;
export type GoalValues = Record<(typeof EDITABLE_GOAL_KEYS)[number],number>;
export type GoalChanges = Partial<GoalValues>;
export type RecommendationKind = keyof HealthRecommendations;
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
 if(!result||result.status!=='success')return null;
 const value=kind==='calories'&&'recommendedCalories' in result?Math.round(result.recommendedCalories)
  :kind==='steps'&&'recommendedSteps' in result?result.recommendedSteps
  :kind==='water'&&'recommendedWaterMl' in result?result.recommendedWaterMl:null;
 return value!==null&&Number.isSafeInteger(value)&&value>0&&value<=2147483647?value:null;
}
export function applicableGoalChanges(selected: readonly RecommendationKind[], recommendations: Partial<HealthRecommendations>): GoalChanges {
 if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length)throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
 const changes:GoalChanges={};
 for(const kind of selected as readonly RecommendationKind[]){
  // The fluid estimate has a different measurement scope. Manual editing is a
  // separate, explicit decision; never relabel it as an automatic water target.
  if(kind!=='calories'&&kind!=='steps')throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
  const value=recommendationValue(kind,recommendations[kind]);
  if(value===null)throw new DataAccessError('INVALID_INPUT','goals.notApplicable');
  changes[kind==='calories'?'daily_calories':'daily_steps']=value;
 }
 return changes;
}

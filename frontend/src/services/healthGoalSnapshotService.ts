import { supabase } from '../lib/supabase';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { normalizeRow } from '../lib/dataValidation';
import { toLocalDateKey } from '../lib/dateUtils';
import { EDITABLE_GOAL_KEYS, applicableGoalChanges, goalValues, recommendationValue, validateGoalChanges, type GoalChanges, type RecommendationKind } from '../lib/healthGoalEditing';
import type { HealthGoalRow } from '../types/database';
import type { HealthRecommendations } from './healthRecommendationService';
import { getMyCalorieRecommendation } from './calorieRecommendationService';
import { getMyStepRecommendation } from './stepRecommendationService';
import { HealthRecommendationSources } from './healthRecommendationSources';
import { assertIdentity, requireAuthenticatedUserId } from './queryCore';
import { notifyGoalsChanged } from '../lib/healthQueryEvents';
const pending=new Set<string>();
export type GoalSaveContext={ownerId:string;expectedGoal:HealthGoalRow|null;date:string};
async function save(context:GoalSaveContext,changes:GoalChanges,owner:string):Promise<HealthGoalRow>{
 if(owner!==context.ownerId||(context.expectedGoal&&context.expectedGoal.user_id!==owner))throw new DataAccessError('AUTH_CHANGED','errors.accountChangedReload');
 if(context.date!==toLocalDateKey())throw new DataAccessError('INVALID_INPUT','goals.dayChanged');
 const expected=goalValues(context.expectedGoal),input=validateGoalChanges(changes);
 if(!expected&&EDITABLE_GOAL_KEYS.some(key=>input[key]===undefined))throw new DataAccessError('INVALID_INPUT','goals.completeFirst');
 const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 if(!timeZone)throw new DataAccessError('INVALID_INPUT','goals.dayChanged');
 await assertIdentity(owner);
 const response=await supabase.rpc('save_health_goal_snapshot',{p_expected_owner:owner,p_expected_id:context.expectedGoal?.id??null,p_expected_values:expected,p_changes:input,p_local_date:context.date,p_time_zone:timeZone});
 await assertIdentity(owner);
 if(response.error){
  if(response.error.code==='40001')throw new DataAccessError('CONSTRAINT','goals.conflict');
  if(response.error.code==='22023'&&['goals.completeFirst','goals.dayChanged','goals.invalid'].includes(response.error.message))throw new DataAccessError('INVALID_INPUT',response.error.message);
  throw dataError(response.error);
 }
 const rows=response.data;
 if(!rows||rows.length!==1||rows[0].user_id!==owner||Object.entries(input).some(([key,value])=>rows[0][key as keyof GoalChanges]!==value))throw new DataAccessError('DATABASE','errors.saveUnconfirmed');
 const row=normalizeRow('health_goals',rows[0]);goalValues(row);notifyGoalsChanged(owner);return row;
}
async function locked<T>(context:GoalSaveContext,action:(owner:string)=>Promise<T>):Promise<T>{
 const owner=await requireAuthenticatedUserId();
 if(owner!==context.ownerId)throw new DataAccessError('AUTH_CHANGED','errors.accountChangedReload');
 if(pending.has(owner))throw new DataAccessError('INVALID_INPUT','goals.busy');
 pending.add(owner);try{return await action(owner);}finally{pending.delete(owner);}
}
export function saveManualHealthGoals(context:GoalSaveContext,changes:GoalChanges){return locked(context,owner=>save(context,changes,owner));}
export function applyHealthGoalRecommendation(context:GoalSaveContext,selected:readonly RecommendationKind[],preview:Partial<HealthRecommendations>){
 return locked(context,async owner=>{
  const changes=applicableGoalChanges(selected,preview);
  if(!context.expectedGoal)throw new DataAccessError('INVALID_INPUT','goals.completeFirst');
  const sources=await HealthRecommendationSources.create();
  if(sources.ownerId!==owner)throw new DataAccessError('AUTH_CHANGED','errors.accountChangedReload');
  const fresh=await Promise.all(selected.map(async kind=>({key:kind==='calories'?'daily_calories':'daily_steps',value:recommendationValue(kind,kind==='calories'?await getMyCalorieRecommendation(sources):await getMyStepRecommendation(sources))})));
  await assertIdentity(owner);
  if(fresh.some(({key,value})=>changes[key as keyof GoalChanges]!==value))throw new DataAccessError('CONSTRAINT','goals.recommendationChanged');
  return save(context,changes,owner);
 });
}

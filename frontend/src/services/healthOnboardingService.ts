import { supabase } from '../lib/supabase';
import { validateOnboarding, onboardingComplete, type HealthOnboardingInput } from '../lib/healthOnboarding';
import { assertIdentity, requireAuthenticatedUserId, queryResult } from './queryCore';
import { normalizeRow } from '../lib/dataValidation';
import { DataAccessError } from '../lib/dataErrors';
const pending=new Set<string>();
export async function completeHealthOnboarding(payload:HealthOnboardingInput) {
 const input=validateOnboarding(payload),owner=await requireAuthenticatedUserId();
 if(pending.has(owner))throw new DataAccessError('INVALID_INPUT','onboarding.busy');
 pending.add(owner);
 try {
  await assertIdentity(owner);
  const result=await queryResult(supabase.rpc('complete_health_onboarding',{p_date_of_birth:input.date_of_birth,p_gender:input.gender,p_height_cm:input.height_cm,p_weight_kg:input.weight_kg}),owner);
  if(!result || result.length!==1 || result[0].id!==owner || !onboardingComplete(result[0]))throw new DataAccessError('DATABASE','errors.saveUnconfirmed');
  return normalizeRow('profiles',result[0]);
 }finally{pending.delete(owner);}
}

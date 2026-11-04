import type { PersonalProfileDraft } from '../components/profile/ProfileEditModals';
import type { ProfileUpdate } from '../types/database';
import { healthDecimal } from './healthOnboarding';
import { validateProfile } from './dataValidation';
import { DataAccessError } from './dataErrors';
/** Compare against the draft captured when the editor opened, not a later
 * background refresh. Only fields the person actually edited are patched.
 */
export function personalHealthEdits(initial:PersonalProfileDraft,draft:PersonalProfileDraft){
 const patch:ProfileUpdate={};
 if(draft.fullName.trim()!==initial.fullName.trim())patch.full_name=draft.fullName.trim()||null;
 if(draft.dateOfBirth!==initial.dateOfBirth)patch.date_of_birth=draft.dateOfBirth||null;
 if(draft.gender!==initial.gender)patch.gender=draft.gender||null;
 if(draft.activityLevel!==initial.activityLevel)patch.activity_level=draft.activityLevel||null;
 if(draft.weightGoal!==initial.weightGoal)patch.weight_goal=draft.weightGoal||null;
 if(draft.heightCm!==initial.heightCm){const value=draft.heightCm.trim()?healthDecimal(draft.heightCm):null;if(draft.heightCm.trim()&&value===null)throw new DataAccessError('INVALID_INPUT','profile.invalidPersonal');if(value!==healthDecimal(initial.heightCm))patch.height_cm=value;}
 let weightKg:number|null=null;
 if(draft.weightKg!==initial.weightKg&&draft.weightKg.trim()){
  const value=healthDecimal(draft.weightKg);
  if(value===null||value<=0||value>500||Math.round(value*100)<=0)throw new DataAccessError('INVALID_INPUT','profile.invalidPersonal');
  if(value!==healthDecimal(initial.weightKg))weightKg=value;
 }
 return {patch:Object.keys(patch).length?validateProfile(patch):patch,weightKg};
}

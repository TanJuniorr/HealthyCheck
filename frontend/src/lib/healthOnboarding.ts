import type { ProfileGender, ProfileRow } from '../types/database';
import { validateProfile } from './dataValidation';
import { toLocalDateKey, parseLocalDate } from './dateUtils';
import { DataAccessError } from './dataErrors';
export const PROFILE_GENDERS: ProfileGender[] = ['male','female','other','prefer_not_to_say'];
export type HealthOnboardingDraft = {dateOfBirth:string;gender:ProfileGender|'';heightCm:string;weightKg:string};
export type HealthOnboardingInput = {date_of_birth:string;gender:ProfileGender;height_cm:number;weight_kg:number};
export function healthDecimal(value:string):number|null {
 if(!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim()))return null;
 const number=Number(value.trim().replace(',','.'));return Number.isFinite(number)?number:null;
}
export function ageFromBirthDate(value:string, today=toLocalDateKey()):number|null {
 try {const date=parseLocalDate(value),now=parseLocalDate(today);if(value>today)return null;
  return now.getFullYear()-date.getFullYear()-(now.getMonth()<date.getMonth() || (now.getMonth()===date.getMonth() && now.getDate()<date.getDate())?1:0);
 }catch{return null;}
}
export function onboardingErrors(draft:HealthOnboardingDraft) {
 const errors:Partial<Record<keyof HealthOnboardingDraft,string>>={};
 if(!draft.dateOfBirth)errors.dateOfBirth='onboarding.required';
 else if(ageFromBirthDate(draft.dateOfBirth)===null)errors.dateOfBirth='onboarding.invalidBirthDate';
 if(!PROFILE_GENDERS.includes(draft.gender as ProfileGender))errors.gender='onboarding.requiredGender';
 const height=healthDecimal(draft.heightCm),weight=healthDecimal(draft.weightKg);
 if(height===null||height<30||height>300)errors.heightCm=draft.heightCm.trim()?'onboarding.invalidHeight':'onboarding.required';
 if(weight===null||weight<=0||weight>500||Math.round(weight*100)<=0)errors.weightKg=draft.weightKg.trim()?'onboarding.invalidWeight':'onboarding.required';
 return errors;
}
export function validateOnboarding(input:HealthOnboardingInput):HealthOnboardingInput {
 if(!input || typeof input!=='object' || Object.keys(input).some(key=>!['date_of_birth','gender','height_cm','weight_kg'].includes(key)))throw new DataAccessError('INVALID_INPUT','onboarding.invalidInput');
 const draft:HealthOnboardingDraft={dateOfBirth:input.date_of_birth,gender:input.gender,heightCm:String(input.height_cm??''),weightKg:String(input.weight_kg??'')};
 if(typeof draft.dateOfBirth!=='string'||Object.keys(onboardingErrors(draft)).length)throw new DataAccessError('INVALID_INPUT','onboarding.invalidInput');
 validateProfile({date_of_birth:input.date_of_birth,gender:input.gender,height_cm:input.height_cm});
 return {...input,height_cm:healthDecimal(draft.heightCm)!,weight_kg:healthDecimal(draft.weightKg)!};
}
export function onboardingComplete(profile:ProfileRow|null|undefined):boolean {
 return Boolean(profile?.health_onboarding_completed_at && Number.isFinite(Date.parse(profile.health_onboarding_completed_at)));
}

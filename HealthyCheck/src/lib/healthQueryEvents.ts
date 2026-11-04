// Focused queries subscribe; inactive screens already reload when focused.
type Listener = (owner: string, kind?: 'schedule') => void;
const sleepListeners = new Set<Listener>();
export function subscribeSleepChanges(listener: Listener) {
  sleepListeners.add(listener);
  return () => { sleepListeners.delete(listener); };
}
export function notifySleepChanged(owner: string, kind?: 'schedule') {
  for (const listener of sleepListeners) listener(owner, kind);
}
export function dependsOnSleep(key: string) {
  return /^(sleep|sleep-schedule|sleep-records|overview|weekly-overview):/.test(key);
}

const waterListeners = new Set<(owner: string) => void>();
export function subscribeWaterChanges(listener: (owner: string) => void) {
 waterListeners.add(listener); return () => { waterListeners.delete(listener); };
}
export function notifyWaterChanged(owner: string) { for (const listener of waterListeners) listener(owner); }
export function dependsOnWater(key: string) { return /^(water|water-records|overview|weekly-overview):/.test(key); }

const nutritionListeners = new Set<(owner: string) => void>();
export function subscribeNutritionChanges(listener: (owner: string) => void) {
 nutritionListeners.add(listener); return () => { nutritionListeners.delete(listener); };
}
export function notifyNutritionChanged(owner: string) { for (const listener of nutritionListeners) listener(owner); }
export function dependsOnNutrition(key: string) { return /^(nutrition|nutrition-screen|meal-editor|overview|weekly-overview):/.test(key); }

export type HealthChangeKind='goals'|'profile'|'weight';
const healthListeners=new Set<(owner:string,kind:HealthChangeKind)=>void>();
export function subscribeHealthChanges(listener:(owner:string,kind:HealthChangeKind)=>void){healthListeners.add(listener);return()=>{healthListeners.delete(listener);};}
function notify(owner:string,kind:HealthChangeKind){for(const listener of healthListeners)listener(owner,kind);}
export const notifyGoalsChanged=(owner:string)=>notify(owner,'goals');
export const notifyProfileChanged=(owner:string)=>notify(owner,'profile');
export const notifyWeightChanged=(owner:string)=>notify(owner,'weight');
export function dependsOnHealthChange(key:string,kind:HealthChangeKind){
 if(kind==='goals')return /^(goals|profile-health|overview|weekly-overview|steps|water|water-records|nutrition|nutrition-screen|sleep):/.test(key);
 return /^(health-recommendations|profile-health|overview|weekly-overview|weight):/.test(key);
}

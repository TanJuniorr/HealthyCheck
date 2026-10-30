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

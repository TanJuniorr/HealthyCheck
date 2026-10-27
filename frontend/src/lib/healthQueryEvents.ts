// Focused queries subscribe; inactive screens already reload when focused.
type Listener = (owner: string) => void;
const sleepListeners = new Set<Listener>();
export function subscribeSleepChanges(listener: Listener) {
  sleepListeners.add(listener);
  return () => { sleepListeners.delete(listener); };
}
export function notifySleepChanged(owner: string) {
  for (const listener of sleepListeners) listener(owner);
}
export function dependsOnSleep(key: string) {
  return /^(sleep|sleep-records|overview|weekly-overview):/.test(key);
}

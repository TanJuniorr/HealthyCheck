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

export type CycleChangeKind = 'settings' | 'periods' | 'logs';
const listeners = new Set<(owner: string, kind: CycleChangeKind) => void>();
export function subscribeCycleSettingsChanges(listener: (owner: string, kind: CycleChangeKind) => void) {
 listeners.add(listener); return () => { listeners.delete(listener); };
}
export function notifyCycleChanged(owner: string, kind: CycleChangeKind) { for (const listener of listeners) listener(owner, kind); }
export function dependsOnCycle(key: string, kind?: CycleChangeKind) {
 if (!/^(menstrual-cycle|overview-cycle)/.test(key)) return false;
 if (!kind) return true;
 if (key.startsWith('menstrual-cycle-log:')) return kind === 'logs';
 if (key.startsWith('menstrual-cycle-history:')) return kind === 'periods';
 if (key.startsWith('menstrual-cycle-calendar:')) return kind !== 'settings';
 return kind !== 'logs';
}

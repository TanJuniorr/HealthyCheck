import { parseLocalDate, shiftDay, toLocalDateKey } from './dateUtils';
import type { MenstrualCyclePeriodRow, MenstrualCycleSettingsRow } from '../types/database';
// Tracking heuristics, not diagnostic thresholds. No observations are removed as outliers.
export const CYCLE_POLICY = Object.freeze({ recentIntervals: 6, minimumReliableIntervals: 3, irregularSpreadDays: 9, minimumEstimateDays: 15, maximumEstimateDays: 90, prolongedPeriodDays: 7 });
type Period = Pick<MenstrualCyclePeriodRow, 'id' | 'start_date' | 'end_date'>;
export function daysBetween(from: string, to: string) {
 const ordinal = (value: string) => {
  const date = parseLocalDate(value), utc = new Date(0);
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate()); utc.setUTCHours(0, 0, 0, 0);
  return utc.getTime() / 86_400_000;
 };
 return Math.round(ordinal(to) - ordinal(from));
}
export function median(values: number[]) {
 if (!values.length) return null;
 const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
 return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}
export function confirmedPeriods(periods: readonly Period[]) {
 const starts = new Set<string>(), ids = new Set<string>();
 return [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date)).filter(period => {
  if (starts.has(period.start_date) || ids.has(period.id)) return false;
  starts.add(period.start_date); ids.add(period.id); return true;
 });
}
export function getCycleStatistics(periods: readonly Period[]) {
 const ordered = confirmedPeriods(periods);
 const intervals = ordered.slice(1).map((period, index) => daysBetween(ordered[index].start_date, period.start_date)).slice(-CYCLE_POLICY.recentIntervals);
 const durations = ordered.filter(period => period.end_date !== null).slice(-6).map(period => daysBetween(period.start_date, period.end_date!) + 1);
 const spread = intervals.length ? Math.max(...intervals) - Math.min(...intervals) : 0;
 const unusual = intervals.some(value => value < CYCLE_POLICY.minimumEstimateDays || value > CYCLE_POLICY.maximumEstimateDays);
 return { ordered, intervals, estimatedCycleLength: median(intervals), averagePeriodLength: median(durations), irregular: spread > CYCLE_POLICY.irregularSpreadDays || unusual, spread };
}
export function getCyclePrediction(date: string, settings: MenstrualCycleSettingsRow | null, periods: readonly Period[] = []) {
 const stats = getCycleStatistics(periods.filter(period => period.start_date <= date)), latest = stats.ordered.at(-1) ?? null;
 const anchorDate = latest?.start_date ?? settings?.last_period_start;
 const estimatedCycleLength = stats.estimatedCycleLength ?? settings?.cycle_length ?? (latest ? 28 : null);
 if (!anchorDate || anchorDate > date || !estimatedCycleLength) return null;
 const expectedNextPeriodStart = shiftDay(anchorDate, estimatedCycleLength);
 const expectedWindowStart = stats.irregular ? shiftDay(anchorDate, Math.min(...stats.intervals)) : expectedNextPeriodStart;
 const expectedWindowEnd = stats.irregular ? shiftDay(anchorDate, Math.max(...stats.intervals)) : expectedNextPeriodStart;
 const activePeriod = stats.ordered.find(period => period.start_date <= date && (!period.end_date || period.end_date >= date)) ?? null;
 return { ...stats, anchorDate, latestConfirmedStart: latest?.start_date ?? null, activePeriod,
  cycleDay: daysBetween(anchorDate, date) + 1, isPeriodDay: Boolean(activePeriod), estimatedCycleLength, estimatedPeriodLength: stats.averagePeriodLength ?? settings?.period_length ?? 5,
  expectedNextPeriodStart, expectedWindowStart, expectedWindowEnd,
  daysUntilNextPeriod: Math.max(0, daysBetween(date, expectedWindowStart)), overdueDays: Math.max(0, daysBetween(expectedWindowEnd, date)),
  source: stats.intervals.length ? 'history' as const : 'manual' as const,
  confidence: !stats.irregular && stats.intervals.length >= CYCLE_POLICY.minimumReliableIntervals ? 'moderate' as const : 'low' as const,
  reminderEligible: !stats.irregular,
 };
}
export type CyclePrediction = ReturnType<typeof getCyclePrediction>;
export function cycleSummaryKey(prediction: CyclePrediction) {
 return !prediction ? 'cycle.insufficientData' : prediction.activePeriod ? 'cycle.ongoing' : prediction.overdueDays > 0 ? 'cycle.overdue' : 'cycle.daysUntil';
}
export function getCycleDayState(date: string, today: string, periods: readonly Period[], prediction: CyclePrediction) {
 const actual = date <= today && periods.some(period => period.start_date <= date && (!period.end_date || period.end_date >= date));
 const start = date <= today && periods.some(period => period.start_date === date);
 const predicted = !actual && date >= today && Boolean(prediction && date >= prediction.expectedWindowStart && date <= shiftDay(prediction.expectedWindowEnd, prediction.estimatedPeriodLength - 1));
 return { actual, start, predicted };
}
export function getNextPeriodReminderDates(settings: MenstrualCycleSettingsRow, periods: readonly Period[] = [], today = toLocalDateKey()) {
 const prediction = getCyclePrediction(today, settings, periods);
 if (!prediction?.reminderEligible || prediction.activePeriod || prediction.expectedNextPeriodStart < today) return null;
 const reminderDate = shiftDay(prediction.expectedNextPeriodStart, -settings.reminder_days_before);
 if (reminderDate < today) return null;
 return { expectedPeriodStart: prediction.expectedNextPeriodStart, reminderDate };
}
export function localDateAtHour(date: string, hour: number, minute = 0) { const value = parseLocalDate(date); value.setHours(hour, minute, 0, 0); return value; }

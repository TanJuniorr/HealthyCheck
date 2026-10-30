import { parseLocalDate, shiftDay, toLocalDateKey } from './dateUtils';
import type { MenstrualCycleSettingsRow } from '../types/database';

function ordinal(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function daysBetween(from: string, to: string) {
  return Math.round(ordinal(to) - ordinal(from));
}

export function getCyclePrediction(date: string, settings: MenstrualCycleSettingsRow | null) {
  if (!settings?.last_period_start) return null;
  const elapsed = daysBetween(settings.last_period_start, date);
  const cycleDay = ((elapsed % settings.cycle_length) + settings.cycle_length) % settings.cycle_length + 1;
  const cycleIndex = Math.floor(elapsed / settings.cycle_length);
  const activeCycleStart = shiftDay(settings.last_period_start, cycleIndex * settings.cycle_length);
  const expectedNextPeriodStart = shiftDay(activeCycleStart, settings.cycle_length);
  const ovulationDay = Math.max(2, settings.cycle_length - 13);
  const phase = cycleDay <= settings.period_length
    ? 'menstrual'
    : Math.abs(cycleDay - ovulationDay) <= 1
      ? 'ovulation'
      : cycleDay < ovulationDay
        ? 'follicular'
        : 'luteal';
  return {
    cycleDay,
    phase,
    isPeriodDay: cycleDay <= settings.period_length,
    expectedNextPeriodStart,
    daysUntilNextPeriod: Math.max(0, daysBetween(date, expectedNextPeriodStart)),
  };
}

export function getNextPeriodReminderDates(settings: MenstrualCycleSettingsRow) {
  if (!settings.last_period_start) return null;
  const today = toLocalDateKey();
  const daysSinceAnchor = daysBetween(settings.last_period_start, today);
  let candidateIndex = Math.floor(daysSinceAnchor / settings.cycle_length);
  let expected = shiftDay(settings.last_period_start, candidateIndex * settings.cycle_length);
  while (expected < today) expected = shiftDay(expected, settings.cycle_length);
  let reminderDate = shiftDay(expected, -settings.reminder_days_before);
  while (reminderDate < today) {
    expected = shiftDay(expected, settings.cycle_length);
    reminderDate = shiftDay(expected, -settings.reminder_days_before);
  }
  return { expectedPeriodStart: expected, reminderDate };
}

export function localDateAtHour(date: string, hour: number, minute = 0) {
  const value = parseLocalDate(date);
  value.setHours(hour, minute, 0, 0);
  return value;
}

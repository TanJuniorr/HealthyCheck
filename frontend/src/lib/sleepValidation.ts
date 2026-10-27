import { DataAccessError } from './dataErrors';
import { parseLocalDate, timestamp } from './dateUtils';

export function sleepInvalid(key: string): never {
  throw new DataAccessError('INVALID_INPUT', key);
}

// Dates are explicit local calendar dates. Never infer a next-day wake-up.
export function sleepLocalTimestamp(date: string, time: string): string {
  if (!date || !time) return sleepInvalid('sleep.requiredTimes');
  let local: Date;
  try { local = parseLocalDate(date); } catch { return sleepInvalid('sleep.invalidDate'); }
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return sleepInvalid('sleep.invalidTime');
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return sleepInvalid('sleep.invalidTime');
  local.setHours(hour, minute, 0, 0);
  // Reject nonexistent local times at daylight-saving transitions.
  if (local.getHours() !== hour || local.getMinutes() !== minute) return sleepInvalid('sleep.invalidTime');
  return local.toISOString();
}

export function validateCompletedSleep(start: string, end: string, now = Date.now()) {
  let startMs: number, endMs: number;
  try { startMs = Date.parse(timestamp(start)); endMs = Date.parse(timestamp(end)); }
  catch { return sleepInvalid('sleep.invalidTimes'); }
  if (endMs <= startMs) return sleepInvalid('sleep.invalidOrder');
  if (endMs > now || startMs > now) return sleepInvalid('sleep.futureTimes');
  return (endMs - startMs) / 60000;
}

export function unusualSleepDuration(minutes: number) {
  return minutes < 60 || minutes > 16 * 60;
}

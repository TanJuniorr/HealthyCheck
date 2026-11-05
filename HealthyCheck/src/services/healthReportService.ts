import { buildHealthReport, validateReportRange } from '../lib/healthReportCalculations';
import { DataAccessError } from '../lib/dataErrors';
import { getMyProfile } from './profileService';
import { getStepsByDateRange } from './stepsService';
import { getSleepByDateRange } from './sleepService';
import { getWaterRecordsByDateRange } from './waterService';
import { getMealsByDateRange } from './mealsService';
import { getLatestWeight, getWeightByDateRange } from './weightService';
import { getGoalsForRange } from './healthGoalsService';
import { assertIdentity, requireAuthenticatedUserId } from './queryCore';

export async function reportTimeout<T>(operation: Promise<T>, milliseconds = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DataAccessError('NETWORK', 'report.timeout')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

/** Read-only, fresh range queries; existing range services exhaust every page. */
export async function loadHealthReport(start: string, end: string, expectedOwner: string) {
  validateReportRange(start, end);
  return reportTimeout((async () => {
    const owner = await requireAuthenticatedUserId();
    if (owner !== expectedOwner) throw new DataAccessError('AUTH_CHANGED', 'report.accountChanged');
    const [profile, steps, sleep, water, meals, weights, latestWeight, goals] = await Promise.all([
      getMyProfile(), getStepsByDateRange(start, end), getSleepByDateRange(start, end),
      getWaterRecordsByDateRange(start, end), getMealsByDateRange(start, end),
      getWeightByDateRange(start, end), getLatestWeight(end), getGoalsForRange(start, end),
    ]);
    await assertIdentity(owner);
    return buildHealthReport({ owner, profile, steps, sleep, water, meals, weights, latestWeight, goals }, start, end);
  })());
}

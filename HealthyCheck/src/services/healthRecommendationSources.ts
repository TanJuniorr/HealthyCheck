import type { ProfileRow, WeightRecordRow } from '../types/database';
import type { StepHistoryDay } from '../lib/stepRecommendation';
import { DataAccessError } from '../lib/dataErrors';
import { shiftDay, toLocalDateKey } from '../lib/dateUtils';
import { STEP_POLICY } from '../lib/stepRecommendationConfig';
import { getMyProfile } from './profileService';
import { getLatestWeight } from './weightService';
import { getStepsHistory } from './stepsService';
import { assertIdentity, requireAuthenticatedUserId } from './queryCore';

/** Request-scoped shared reads. Never retain this context in a global cache or
 * across refreshes: each public recommendation call creates a fresh context.
 */
export class HealthRecommendationSources {
  private profileRequest?: Promise<ProfileRow | null>;
  private weightRequest?: Promise<WeightRecordRow | null>;
  private historyRequest?: Promise<StepHistoryDay[]>;

  private constructor(readonly ownerId: string, readonly referenceDate: string) {}

  static async create(): Promise<HealthRecommendationSources> {
    const owner = await requireAuthenticatedUserId();
    return new HealthRecommendationSources(owner, toLocalDateKey());
  }

  async assertCurrentIdentity(): Promise<void> { await assertIdentity(this.ownerId); }

  private async read<T>(request: () => Promise<T>, owned: (value: T) => boolean): Promise<T> {
    await this.assertCurrentIdentity();
    let result: T;
    try { result = await request(); }
    catch (error) { await this.assertCurrentIdentity(); throw error; }
    await this.assertCurrentIdentity();
    if (!owned(result)) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
    return result;
  }

  getProfile(): Promise<ProfileRow | null> {
    return this.profileRequest ??= this.read(getMyProfile, row => !row || row.id === this.ownerId);
  }

  getWeight(): Promise<WeightRecordRow | null> {
    return this.weightRequest ??= this.read(() => getLatestWeight(this.referenceDate), row => !row || row.user_id === this.ownerId);
  }

  getStepHistory(): Promise<StepHistoryDay[]> {
    return this.historyRequest ??= this.read(async () => {
      // Actual schema has UNIQUE(user_id, record_date). One bounded page covers
      // the entire 14-day window; never fetch the user's whole step history.
      const page = await getStepsHistory({
        startDate: shiftDay(this.referenceDate, -STEP_POLICY.historyDays),
        endDate: shiftDay(this.referenceDate, -1),
        pageSize: STEP_POLICY.historyDays,
      });
      if (page.data.some(row => row.user_id !== this.ownerId)) throw new DataAccessError('AUTH_CHANGED', 'errors.accountChangedReload');
      // Existing StepSensorContext persists foreground session deltas. Neither
      // an old record_date nor active_minutes verifies full-day sensor coverage.
      return page.data.map(row => ({ date: row.record_date, steps: row.steps, coverage: 'unknown' as const, source: 'legacy_step_record' as const }));
    }, () => true);
  }
}

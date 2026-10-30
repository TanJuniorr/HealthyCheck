import type { InboxNotification } from './notificationInboxService';
import { formatDate } from '../i18n/formatting';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function notificationPresentation(item: InboxNotification, t: Translate) {
  const payload = item.payload ?? {};
  switch (item.kind) {
    case 'step_goal':
      return {
        title: t('notifications.stepGoalTitle'),
        body: t('notifications.stepGoalBody', { steps: Number(payload.steps) || 0, goal: Number(payload.goal) || 0 }),
      };
    case 'health_score_low':
      return {
        title: t('notifications.lowHealthScoreTitle'),
        body: t('notifications.lowHealthScoreBody', { score: Number(payload.score) || 0 }),
      };
    case 'sleep_missing':
      return { title: t('notifications.missingSleepTitle'), body: t('notifications.missingSleepBody') };
    case 'wellness_daily':
      return { title: t('notifications.wellnessTitle'), body: t('notifications.wellnessBody') };
    case 'cycle_reminder':
      return {
        title: t('cycle.notificationTitle'),
        body: t('cycle.notificationBody', { date: typeof payload.expectedPeriodStart === 'string' ? formatDate(payload.expectedPeriodStart) : '' }),
      };
    case 'sharing_received': {
      const categories = [
        payload.shareSteps ? t('notifications.categorySteps') : '',
        payload.shareSleep ? t('notifications.categorySleep') : '',
        payload.shareNutrition ? t('notifications.categoryNutrition') : '',
      ].filter(Boolean).join(', ');
      return {
        title: t('notifications.sharingTitle'),
        body: t('notifications.sharingBody', {
          email: typeof payload.sharerEmail === 'string' && payload.sharerEmail ? payload.sharerEmail : t('notifications.someone'),
          categories: categories || t('notifications.healthData'),
        }),
      };
    }
    default:
      return { title: item.title, body: item.body };
  }
}

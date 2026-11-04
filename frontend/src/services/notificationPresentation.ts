import type { InboxNotification } from './notificationInboxService';
import { formatDate } from '../i18n/formatting';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const sharingEvents = {
  sharing_received: 'recipient', sharing_accepted: 'sender', sharing_rejected: 'sender',
  sharing_permissions_updated: 'recipient', sharing_paused: 'recipient',
  sharing_resumed: 'recipient', sharing_revoked: 'recipient',
} as const;

function sharingSide(kind?: string) {
  return kind && Object.hasOwn(sharingEvents, kind) ? sharingEvents[kind as keyof typeof sharingEvents] : null;
}

export function sharingNoticeDestination(item: InboxNotification) {
  const side = sharingSide(item.kind);
  if (item.source !== 'remote' || !item.referenceId || !side) return null;
  return {
    pathname: side === 'sender' ? '/(tabs)/sharing' as const : '/shared-with-me' as const,
    params: { inviteId: item.referenceId },
  };
}

export function notificationPresentation(item: InboxNotification, t: Translate) {
  const payload = item.payload ?? {};
  if (sharingSide(item.kind)) return {
    title: t(`notifications.sharingEvents.${item.kind}.title`),
    body: t(`notifications.sharingEvents.${item.kind}.body`),
  };
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
    default:
      return { title: item.title, body: item.body };
  }
}

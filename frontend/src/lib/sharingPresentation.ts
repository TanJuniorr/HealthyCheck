import { appLocale, formatDate, formatTime } from '../i18n/formatting';
import type { SharingStatus } from '../types/database';

export function groupSharingInvites<T extends { status: SharingStatus }>(invites: readonly T[]) {
  const groups = { pending: [] as T[], active: [] as T[], paused: [] as T[], history: [] as T[] };
  for (const invite of invites) {
    const group = invite.status === 'revoked' || invite.status === 'rejected' ? 'history' : invite.status;
    groups[group].push(invite);
  }
  return groups;
}

export const sharingDateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;

export function formatSharingDateTime(value: string) {
  if (!Number.isFinite(Date.parse(value))) return '—';
  if (appLocale() === 'vi-VN') {
    return `${formatDate(value, sharingDateOptions)}, ${formatTime(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
  }
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}
